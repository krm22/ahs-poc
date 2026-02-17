import { Injectable, computed, signal } from '@angular/core';

export type LngLat = [number, number];

export interface TipEdge {
  id: string;
  name: string;
  coord: LngLat;
}

export interface DumpSite {
  id: string;
  name: string;
  coord: LngLat;
  tipEdges: TipEdge[];
  defaultTipEdgeId: string;
}

export interface DigFace {
  id: string;
  name: string;
  coord: LngLat;
}

export interface SiteLocation {
  id: string;
  kind: 'dig' | 'dump' | 'fuel' | 'workshop' | 'crusher';
  name: string;
  coord: LngLat;
}

export interface RouteDef {
  id: string;
  name: string;
  coords: LngLat[];
}

export type VehiclePhase =
  | 'TO_DIG'
  | 'LOADING'
  | 'TO_DUMP'
  | 'DUMPING'
  | 'RETURNING'
  | 'STOPPED'
  | 'FAULT';

export interface VehicleState {
  id: string;
  phase: VehiclePhase;

  speedKph: number;
  payloadTons: number;
  fuelPct: number;
  healthPct: number;

  position: { lng: number; lat: number };

  // Assignment
  digId: string;
  dumpId: string;
  tipEdgeId: string;

  // Routing
  routeId: string;
  t: number; // 0..1 progress along route
  speedMps: number; // used for motion model
}

@Injectable({ providedIn: 'root' })
export class FleetSimulationService {
  // --- Public signals for UI ---
  readonly routes = signal<RouteDef[]>([]);
  readonly sites = signal<SiteLocation[]>([]);
  readonly digFaces = signal<DigFace[]>([]);
  readonly dumpSites = signal<DumpSite[]>([]);
  readonly vehicles = signal<VehicleState[]>([]);
  readonly running = signal<boolean>(true);

  readonly vehicleById = computed(() => {
    // Use globalThis.Map to avoid future name-collisions with MapLibre's Map
    const map = new globalThis.Map<string, VehicleState>();
    for (const v of this.vehicles()) map.set(v.id, v);
    return map;
  });

  private raf: number | null = null;
  private lastTs = 0;

  setMineScenario(routes: RouteDef[], sites: SiteLocation[], digFaces: DigFace[], dumpSites: DumpSite[]) {
    this.routes.set(routes);
    this.sites.set(sites);
    this.digFaces.set(digFaces);
    this.dumpSites.set(dumpSites);
  }

  seed(count: number) {
    const routes = this.routes();
    const digs = this.digFaces();
    const dumps = this.dumpSites();

    if (!routes.length || !digs.length || !dumps.length) {
      console.warn('[FleetSimulation] Scenario missing routes/digs/dumps. Call setMineScenario(...) first.');
      return;
    }

    const next: VehicleState[] = Array.from({ length: count }).map((_, i) => {
      const route = routes[i % routes.length];
      const dig = digs[i % digs.length];
      const dump = dumps[i % dumps.length];
      const tip = dump.tipEdges.find(e => e.id === dump.defaultTipEdgeId) ?? dump.tipEdges[0];

      const start = route.coords[0];
      return {
        id: `TRK-${(i + 1).toString().padStart(2, '0')}`,
        phase: 'TO_DIG',

        speedKph: 28 + Math.random() * 10,
        payloadTons: 0,
        fuelPct: 65 + Math.random() * 30,
        healthPct: 85 + Math.random() * 15,

        position: { lng: start[0], lat: start[1] },

        digId: dig.id,
        dumpId: dump.id,
        tipEdgeId: tip.id,

        routeId: route.id,
        t: Math.random() * 0.25,
        speedMps: 6 + Math.random() * 4
      };
    });

    this.vehicles.set(next);
    this.start();
  }

  clear() {
    this.stop();
    this.vehicles.set([]);
  }

  setRunning(on: boolean) {
    this.running.set(on);
    if (on) this.start();
    else this.stop();
  }

  setVehicleDig(vehicleId: string, digId: string) {
    this.vehicles.set(this.vehicles().map(v => (v.id === vehicleId ? { ...v, digId } : v)));
  }

  setVehicleDump(vehicleId: string, dumpId: string) {
    const dump = this.dumpSites().find(d => d.id === dumpId);
    const tipEdgeId = dump ? dump.defaultTipEdgeId : '';
    this.vehicles.set(this.vehicles().map(v => (v.id === vehicleId ? { ...v, dumpId, tipEdgeId } : v)));
  }

  setVehicleTipEdge(vehicleId: string, tipEdgeId: string) {
    this.vehicles.set(this.vehicles().map(v => (v.id === vehicleId ? { ...v, tipEdgeId } : v)));
  }

  setDumpDefaultTipEdge(dumpId: string, tipEdgeId: string) {
    this.dumpSites.set(
      this.dumpSites().map(d => (d.id === dumpId ? { ...d, defaultTipEdgeId: tipEdgeId } : d))
    );
    // intentionally does NOT overwrite existing vehicles
  }

  // --- Motion loop ---
  private start() {
    if (this.raf != null) return;
    this.lastTs = performance.now();
    const tick = (ts: number) => {
      const dt = Math.max(0, (ts - this.lastTs) / 1000);
      this.lastTs = ts;

      if (this.running()) this.step(dt);

      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stop() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  private step(dt: number) {
    const routes = this.routes();
    const vehicles = this.vehicles();
    if (!routes.length || !vehicles.length) return;

    const routeById = new globalThis.Map(routes.map(r => [r.id, r]));

    const next = vehicles.map(v => {
      const route = routeById.get(v.routeId);
      if (!route || route.coords.length < 2) return v;

      const total = polylineLengthMeters(route.coords);
      const ds = v.speedMps * dt;
      const dtNorm = total > 0 ? ds / total : 0;

      let t = v.t + dtNorm;
      if (t >= 1) t = t - 1; // loop for POC

      const coord = pointAlongPolyline(route.coords, t);

      const fuel = Math.max(0, v.fuelPct - dt * 0.02);
      const health = Math.max(0, v.healthPct - dt * 0.001);

      return {
        ...v,
        t,
        position: { lng: coord[0], lat: coord[1] },
        fuelPct: fuel,
        healthPct: health
      };
    });

    this.vehicles.set(next);
  }
}

/** --- Geo helpers --- */
function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function polylineLengthMeters(coords: LngLat[]): number {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += haversineMeters(coords[i - 1], coords[i]);
  return sum;
}

function pointAlongPolyline(coords: LngLat[], t: number): LngLat {
  if (coords.length === 1) return coords[0];

  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversineMeters(coords[i - 1], coords[i]);
    segLens.push(d);
    total += d;
  }
  if (total === 0) return coords[0];

  const target = total * t;
  let acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    const seg = segLens[i];
    if (acc + seg >= target) {
      const local = (target - acc) / seg;
      const a = coords[i];
      const b = coords[i + 1];
      return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local];
    }
    acc += seg;
  }
  return coords[coords.length - 1];
}
