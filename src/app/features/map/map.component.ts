import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import maplibregl, { Map as MlMap, Marker, LngLatLike } from 'maplibre-gl';

import { ShovelQueueService, ShovelJob } from '../../core/services/shovel-queue.service';

export type VehicleStatus = 'ACTIVE' | 'QUEUED' | 'FUEL' | 'MAINT' | 'FAULT' | 'STOPPED';
export type VehicleTask = 'TO_WORKSHOP' | 'TO_DIG' | 'LOADING' | 'TO_DUMP' | 'DUMPING';

export interface VehicleState {
  id: string;

  // local "world" coords
  x: number;
  y: number;

  headingDeg: number;
  speedMps: number;

  status: VehicleStatus;
  task: VehicleTask;

  payloadTons: number;
  fuelPct: number;
  healthPct: number;

  // routing
  waypointIndex: number;
  dwellSecRemaining: number;
}

export interface VehicleMapVM {
  id: string;
  position: { lat: number; lng: number };
  headingDeg: number;
  speedKph: number;
  status: VehicleStatus;
  task: VehicleTask;
  payloadTons: number;
  fuelPct: number;
  healthPct: number;
}

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry>;

const MINE_CENTER: LngLatLike = [115.86, -31.9505];

// Routing anchors (lng,lat)
const WORKSHOP_LL: [number, number] = [115.8626, -31.9491];
const PIT_LL: [number, number] = [115.8610, -31.9519];
const DUMP_LL: [number, number] = [115.8589, -31.9489];

const MINE_LAYOUT: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { kind: 'haul_road', name: 'Main Haul Loop' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [115.8578, -31.9518],
          [115.8592, -31.9530],
          [115.8620, -31.9522],
          [115.8634, -31.9506],
          [115.8612, -31.9495],
          [115.8588, -31.9499],
          [115.8578, -31.9518],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'pit', name: 'Pit 1' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [115.8602, -31.9521],
            [115.8613, -31.9526],
            [115.8621, -31.9518],
            [115.8611, -31.9511],
            [115.8600, -31.9514],
            [115.8602, -31.9521],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'dump', name: 'Waste Dump A' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [115.8584, -31.9492],
            [115.8594, -31.9494],
            [115.8595, -31.9486],
            [115.8585, -31.9484],
            [115.8584, -31.9492],
          ],
        ],
      },
    },
    { type: 'Feature', properties: { kind: 'infrastructure', name: 'Crusher' }, geometry: { type: 'Point', coordinates: [115.8630, -31.9500] } },
    { type: 'Feature', properties: { kind: 'infrastructure', name: 'Workshop' }, geometry: { type: 'Point', coordinates: WORKSHOP_LL } },
    { type: 'Feature', properties: { kind: 'infrastructure', name: 'Pit (Dig)' }, geometry: { type: 'Point', coordinates: PIT_LL } },
    { type: 'Feature', properties: { kind: 'infrastructure', name: 'Dump' }, geometry: { type: 'Point', coordinates: DUMP_LL } },
  ],
};

// Transform constants
const ORIGIN_LNG = 115.86;
const ORIGIN_LAT = -31.9505;
const SCALE = 0.00001;

function worldToLngLat(x: number, y: number): { lng: number; lat: number } {
  return { lng: ORIGIN_LNG + x * SCALE, lat: ORIGIN_LAT + y * SCALE };
}
function lngLatToWorld(lng: number, lat: number): { x: number; y: number } {
  return { x: (lng - ORIGIN_LNG) / SCALE, y: (lat - ORIGIN_LAT) / SCALE };
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
function angleDeg(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly shovelQueue = inject(ShovelQueueService);

  @ViewChild('mapEl', { static: true }) private mapEl!: ElementRef<HTMLDivElement>;

  private map: MlMap | null = null;
  private readonly markers = new Map<string, Marker>();

  readonly mapReady = signal<boolean>(false);
  readonly mapStatus = signal<string>('Initializing…');

  private readonly _vehicles = signal<VehicleState[]>([]);
  readonly vehicles = computed(() => this._vehicles());
  readonly vehiclesVm = computed<VehicleMapVM[]>(() => this._vehicles().map((v) => this.vehicleToMapView(v)));

  private readonly _selectedVehicleId = signal<string | null>(null);
  readonly selectedVehicle = computed<VehicleMapVM | null>(() => {
    const id = this._selectedVehicleId();
    if (!id) return null;
    return this.vehiclesVm().find((v) => v.id === id) ?? null;
  });

  clearSelection(): void {
    this._selectedVehicleId.set(null);
  }
  selectVehicle(id: string): void {
    this._selectedVehicleId.set(id);
  }

  readonly simRunning = signal<boolean>(true);

  private _raf: number | null = null;
  private _lastTs = 0;

  // World waypoints: Workshop -> Pit -> Dump -> Workshop
  private readonly waypointWorld = (() => {
    const w = lngLatToWorld(WORKSHOP_LL[0], WORKSHOP_LL[1]);
    const p = lngLatToWorld(PIT_LL[0], PIT_LL[1]);
    const d = lngLatToWorld(DUMP_LL[0], DUMP_LL[1]);
    return [
      { name: 'WORKSHOP', x: w.x, y: w.y },
      { name: 'PIT', x: p.x, y: p.y },
      { name: 'DUMP', x: d.x, y: d.y },
      { name: 'WORKSHOP', x: w.x, y: w.y },
    ];
  })();

  constructor() {
    effect(() => {
      const running = this.simRunning();
      const ready = this.mapReady();
      if (!running || !ready) {
        this.stopLoop();
        return;
      }
      untracked(() => this.startLoop());
    });

    effect(() => {
      if (!this.mapReady()) return;
      const list = this.vehiclesVm();
      untracked(() => this.syncMarkers(list));
    });

    this.destroyRef.onDestroy(() => {
      this.stopLoop();
      this.clearMarkers();
      this.map?.remove();
      this.map = null;
    });
  }

  ngAfterViewInit(): void {
    this.createMap();
  }

  private createMap(): void {
    const lightBlankStyle: any = {
      version: 8,
      name: 'AHS POC Light',
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f3f4f6' } }],
    };

    this.mapStatus.set('Creating MapLibre instance…');

    this.map = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: lightBlankStyle,
      center: MINE_CENTER,
      zoom: 14,
      attributionControl: { compact: true },
    });

    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    this.map.on('load', () => {
      this.mapStatus.set('Map loaded. Adding mine layout…');
      this.addMineLayoutLayers();
      this.mapReady.set(true);
      this.mapStatus.set('Ready');

      if (this._vehicles().length === 0) this.seedVehicles(10);

      this.map?.on('click', () => this.clearSelection());
    });

    this.map.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.error('MapLibre error:', e?.error ?? e);
      this.mapStatus.set('Map error (see console).');
    });
  }

  private addMineLayoutLayers(): void {
    if (!this.map) return;

    if (!this.map.getSource('mine-layout')) {
      this.map.addSource('mine-layout', { type: 'geojson', data: MINE_LAYOUT as any });
    }

    if (!this.map.getLayer('haul-roads')) {
      this.map.addLayer({
        id: 'haul-roads',
        type: 'line',
        source: 'mine-layout',
        filter: ['==', ['get', 'kind'], 'haul_road'],
        paint: { 'line-color': '#111827', 'line-width': 5, 'line-opacity': 0.85 },
      });
    }

    if (!this.map.getLayer('pit-fill')) {
      this.map.addLayer({
        id: 'pit-fill',
        type: 'fill',
        source: 'mine-layout',
        filter: ['==', ['get', 'kind'], 'pit'],
        paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.14 },
      });
    }
    if (!this.map.getLayer('pit-outline')) {
      this.map.addLayer({
        id: 'pit-outline',
        type: 'line',
        source: 'mine-layout',
        filter: ['==', ['get', 'kind'], 'pit'],
        paint: { 'line-color': '#991b1b', 'line-width': 2, 'line-opacity': 0.85 },
      });
    }

    if (!this.map.getLayer('dump-fill')) {
      this.map.addLayer({
        id: 'dump-fill',
        type: 'fill',
        source: 'mine-layout',
        filter: ['==', ['get', 'kind'], 'dump'],
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.14 },
      });
    }
    if (!this.map.getLayer('dump-outline')) {
      this.map.addLayer({
        id: 'dump-outline',
        type: 'line',
        source: 'mine-layout',
        filter: ['==', ['get', 'kind'], 'dump'],
        paint: { 'line-color': '#92400e', 'line-width': 2, 'line-opacity': 0.85 },
      });
    }

    if (!this.map.getLayer('infrastructure')) {
      this.map.addLayer({
        id: 'infrastructure',
        type: 'circle',
        source: 'mine-layout',
        filter: ['==', ['get', 'kind'], 'infrastructure'],
        paint: {
          'circle-color': '#2563eb',
          'circle-radius': 7,
          'circle-opacity': 0.95,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f172a',
          'circle-stroke-opacity': 0.6,
        },
      });
    }

    if (!this.map.getLayer('infrastructure-labels')) {
      this.map.addLayer({
        id: 'infrastructure-labels',
        type: 'symbol',
        source: 'mine-layout',
        filter: ['==', ['get', 'kind'], 'infrastructure'],
        layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.2] },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.2,
          'text-opacity': 0.95,
        },
      });
    }

    try {
      this.map.fitBounds(
        [
          [115.8570, -31.9534],
          [115.8642, -31.9480],
        ],
        { padding: 40, duration: 400 }
      );
    } catch {
      // ignore
    }
  }

  // ===== Simulation + Routing =====

  seedVehicles(count = 10): void {
    const start = lngLatToWorld(WORKSHOP_LL[0], WORKSHOP_LL[1]);

    const seeded: VehicleState[] = Array.from({ length: count }).map((_, i) => ({
      id: `TRUCK-${String(i + 1).padStart(2, '0')}`,
      x: start.x + (i % 5) * 6,
      y: start.y + Math.floor(i / 5) * 6,
      headingDeg: 90,
      speedMps: 7 + (i % 3),
      status: 'ACTIVE',
      task: 'TO_DIG',
      payloadTons: 0,
      fuelPct: 70 + (i % 5) * 5,
      healthPct: 85 + (i % 4) * 3,
      waypointIndex: 1,
      dwellSecRemaining: 0,
    }));

    this._vehicles.set(seeded);

    const sel = this._selectedVehicleId();
    if (sel && !seeded.some((v) => v.id === sel)) this._selectedVehicleId.set(null);
  }

  private startLoop(): void {
    if (this._raf !== null) return;

    this._lastTs = performance.now();
    const step = (ts: number) => {
      this._raf = requestAnimationFrame(step);

      const dtSec = Math.max(0, (ts - this._lastTs) / 1000);
      this._lastTs = ts;

      this.advanceSimulation(dtSec);
    };

    this._raf = requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this._raf !== null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  private advanceSimulation(dtSec: number): void {
    this._vehicles.update((list) => list.map((v) => this.tickVehicle(v, dtSec)));
  }

  private tickVehicle(v: VehicleState, dtSec: number): VehicleState {
    // If stopped or faulted, do nothing
    if (v.status === 'STOPPED' || v.status === 'FAULT') return v;

    // Dwell / loading / dumping
    if (v.dwellSecRemaining > 0) {
      const nextDwell = Math.max(0, v.dwellSecRemaining - dtSec);

      let payload = v.payloadTons;
      let task = v.task;

      if (v.task === 'LOADING') {
        const loadRateTps = 220 / 8;
        payload = Math.min(220, payload + loadRateTps * dtSec);
        if (nextDwell === 0) task = 'TO_DUMP';
      }

      if (v.task === 'DUMPING') {
        const dumpRateTps = 220 / 6;
        payload = Math.max(0, payload - dumpRateTps * dtSec);
        if (nextDwell === 0) task = 'TO_WORKSHOP';
      }

      return {
        ...v,
        dwellSecRemaining: nextDwell,
        payloadTons: payload,
        task,
        fuelPct: clamp(v.fuelPct - 0.005 * dtSec, 0, 100),
        healthPct: clamp(v.healthPct - 0.001 * dtSec, 0, 100),
      };
    }

    // Wear & consumption
    const fuel = clamp(v.fuelPct - 0.02 * (v.speedMps / 7) * dtSec, 0, 100);
    const health = clamp(v.healthPct - 0.002 * dtSec, 0, 100);

    // ✅ No need for "if (status !== 'FAULT')" here — we already returned for FAULT above.
    // Compute operational status directly:
    let status: VehicleStatus = 'ACTIVE';
    if (fuel <= 10) status = 'FUEL';
    else if (health <= 15) status = 'MAINT';

    // Target waypoint
    const wp = this.waypointWorld[clamp(v.waypointIndex, 0, this.waypointWorld.length - 1)];
    const toX = wp.x;
    const toY = wp.y;

    const dist = Math.hypot(toX - v.x, toY - v.y);
    const arriveThreshold = 6;

    if (dist <= arriveThreshold) {
      // PIT (index 1)
      if (v.waypointIndex === 1) {
        this.shovelQueue.enqueue({
          vehicleId: v.id,
          payload: { kind: 'ARRIVED_DIG' },
          createdAt: Date.now(),
        } satisfies ShovelJob);

        return {
          ...v,
          x: toX,
          y: toY,
          fuelPct: fuel,
          healthPct: health,
          status,
          task: 'LOADING',
          dwellSecRemaining: 8,
          payloadTons: Math.max(0, v.payloadTons),
          waypointIndex: 2,
        };
      }

      // DUMP (index 2)
      if (v.waypointIndex === 2) {
        this.shovelQueue.enqueue({
          vehicleId: v.id,
          payload: { kind: 'ARRIVED_DUMP' },
          createdAt: Date.now(),
        } satisfies ShovelJob);

        return {
          ...v,
          x: toX,
          y: toY,
          fuelPct: fuel,
          healthPct: health,
          status,
          task: 'DUMPING',
          dwellSecRemaining: 6,
          payloadTons: v.payloadTons,
          waypointIndex: 3,
        };
      }

      // WORKSHOP (index 3)
      if (v.waypointIndex === 3) {
        const servicedFuel = clamp(fuel + 35, 0, 100);
        const servicedHealth = clamp(health + 20, 0, 100);

        return {
          ...v,
          x: toX,
          y: toY,
          fuelPct: servicedFuel,
          healthPct: servicedHealth,
          status: 'ACTIVE',
          task: 'TO_DIG',
          waypointIndex: 1,
        };
      }

      return { ...v, waypointIndex: (v.waypointIndex + 1) % this.waypointWorld.length };
    }

    // Move toward target
    const speedFactor = status === 'FUEL' || status === 'MAINT' ? 0.6 : 1.0;
    const speed = Math.max(0.1, v.speedMps * speedFactor);

    const step = Math.min(dist, speed * dtSec);
    const nx = v.x + ((toX - v.x) / dist) * step;
    const ny = v.y + ((toY - v.y) / dist) * step;
    const headingDeg = angleDeg(v.x, v.y, nx, ny);

    const task: VehicleTask = v.waypointIndex === 1 ? 'TO_DIG' : v.waypointIndex === 2 ? 'TO_DUMP' : 'TO_WORKSHOP';

    return {
      ...v,
      x: nx,
      y: ny,
      headingDeg,
      fuelPct: fuel,
      healthPct: health,
      status,
      task,
    };
  }

  // ===== Markers =====

  private syncMarkers(list: VehicleMapVM[]): void {
    if (!this.map) return;

    const keep = new Set(list.map((v) => v.id));

    for (const [id, marker] of this.markers.entries()) {
      if (!keep.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }

    for (const v of list) {
      let marker = this.markers.get(v.id);

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'truck-marker';
        el.title = `${v.id} • ${v.task}`;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectVehicle(v.id);
        });

        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([v.position.lng, v.position.lat])
          .addTo(this.map);

        this.markers.set(v.id, marker);
      } else {
        marker.setLngLat([v.position.lng, v.position.lat]);
      }

      const el = marker.getElement();
      el.setAttribute('data-status', v.status);
      el.setAttribute('data-task', v.task);
      el.title = `${v.id} • ${v.task} • ${v.speedKph.toFixed(1)} kph`;
    }
  }

  private clearMarkers(): void {
    for (const m of this.markers.values()) m.remove();
    this.markers.clear();
  }

  private vehicleToMapView(v: VehicleState): VehicleMapVM {
    const ll = worldToLngLat(v.x, v.y);
    return {
      id: v.id,
      position: { lat: ll.lat, lng: ll.lng },
      headingDeg: v.headingDeg,
      speedKph: v.speedMps * 3.6,
      status: v.status,
      task: v.task,
      payloadTons: v.payloadTons,
      fuelPct: v.fuelPct,
      healthPct: v.healthPct,
    };
  }
}
