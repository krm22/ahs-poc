import { Injectable, signal, computed } from '@angular/core';

export type CoreVehicleStatus =
  | 'IDLE'
  | 'DISPATCHED'
  | 'LOADING'
  | 'HAULING'
  | 'DUMPING'
  | 'RETURNING'
  | 'REFUEL'
  | 'MAINT'
  | 'FAULT';

export type VehicleStatus = CoreVehicleStatus | 'PAUSED';

export interface VehicleTelemetry {
  speedKph: number;
  payloadTons: number;
  fuelPct: number;
  engineTempC: number;
  healthPct: number;
}

export interface FleetVehicle {
  id: string;
  name: string;
  status: VehicleStatus;
  lastUpdateIso: string;
  telemetry: VehicleTelemetry;
}

type SimMeta = {
  dwellUntilMs: number;
  phaseOffsetMs: number;
};

@Injectable({ providedIn: 'root' })
export class FleetStateService {
  private simHandle: any = null;

  private readonly _vehicles = signal<FleetVehicle[]>([]);
  private readonly simMeta = new globalThis.Map<string, SimMeta>();

  readonly vehiclesSig = computed(() => this._vehicles());
  readonly vehicleIdsSig = computed(() => this._vehicles().map(v => v.id));

  vehicles(): FleetVehicle[] {
    return this._vehicles();
  }

  vehicleIds(): string[] {
    return this._vehicles().map(v => v.id);
  }

  readonly kpis = computed(() => {
    const list = this._vehicles();
    return {
      total: list.length,
      hauling: list.filter(v => v.status === 'HAULING').length,
      returning: list.filter(v => v.status === 'RETURNING').length,
      loading: list.filter(v => v.status === 'LOADING').length,
      dumping: list.filter(v => v.status === 'DUMPING').length,
      refuel: list.filter(v => v.status === 'REFUEL').length,
      maint: list.filter(v => v.status === 'MAINT').length,
      faults: list.filter(v => v.status === 'FAULT').length,
      paused: list.filter(v => v.status === 'PAUSED').length,
    };
  });

  // ---------------------------
  // Simulation Control
  // ---------------------------

  startSimulation(count = 10) {
    if (this.simHandle) return;

    const initial: FleetVehicle[] = Array.from({ length: count }).map((_, i) =>
      this.makeVehicle(`T-${(i + 1).toString().padStart(2, '0')}`),
    );

    this._vehicles.set(initial);

    // 5Hz tick
    this.simHandle = setInterval(() => this.tick(), 200);
  }

  stopSimulation() {
    if (this.simHandle) {
      clearInterval(this.simHandle);
      this.simHandle = null;
    }
  }

  // ---------------------------
  // Operator Controls (public API)
  // ---------------------------

  pauseVehicle(id: string) {
    this.setStatus(id, 'PAUSED');
  }

  resumeVehicle(id: string) {
    // resume to IDLE (dispatch will pick up next tick)
    this.setStatus(id, 'IDLE');
  }

  raiseFault(id: string) {
    this.setStatus(id, 'FAULT');
  }

  clearFault(id: string) {
    this.setStatus(id, 'IDLE');
  }

  stopAll() {
    this._vehicles.update(list =>
      list.map(v => (v.status === 'PAUSED' ? v : { ...v, status: 'PAUSED', lastUpdateIso: new Date().toISOString() })),
    );
    // clear dwell so they react immediately
    for (const m of this.simMeta.values()) m.dwellUntilMs = 0;
  }

  resumeAll() {
    this._vehicles.update(list =>
      list.map(v => ({ ...v, status: 'IDLE', lastUpdateIso: new Date().toISOString() })),
    );
    for (const m of this.simMeta.values()) m.dwellUntilMs = 0;
  }

  dispatchVehicle(id: string) {
    // operator dispatch: start next cycle immediately
    this.setCoreStatus(id, 'DISPATCHED');
  }

  sendToFuel(id: string) {
    // operator directive: go refuel now
    this.setCoreStatus(id, 'REFUEL');
  }

  sendToMaint(id: string) {
    // operator directive: go maintenance now
    this.setCoreStatus(id, 'MAINT');
  }

  // ---------------------------
  // Simulation Tick (Pilbara realism)
  // ---------------------------

  private tick() {
    const now = Date.now();

    this._vehicles.update(list =>
      list.map(v => {
        if (v.status === 'PAUSED' || v.status === 'FAULT') return v;

        const meta = this.getMeta(v.id);

        if (meta.dwellUntilMs > now) {
          return {
            ...v,
            lastUpdateIso: new Date().toISOString(),
            telemetry: this.telemetryDuringDwell(v.telemetry, v.status as CoreVehicleStatus),
          };
        }

        const next = this.nextStatusPilbara(v.status as CoreVehicleStatus, v.telemetry);

        const dwellMs = this.dwellFor(next, meta.phaseOffsetMs);
        if (dwellMs > 0) meta.dwellUntilMs = now + dwellMs;

        return {
          ...v,
          status: next,
          lastUpdateIso: new Date().toISOString(),
          telemetry: this.telemetryStep(v.telemetry, next),
        };
      }),
    );
  }

  private nextStatusPilbara(current: CoreVehicleStatus, t: VehicleTelemetry): CoreVehicleStatus {
    switch (current) {
      case 'IDLE':
        return 'DISPATCHED';

      case 'DISPATCHED':
        return 'LOADING';

      case 'LOADING':
        return t.payloadTons >= 210 ? 'HAULING' : 'LOADING';

      case 'HAULING':
        return 'DUMPING';

      case 'DUMPING':
        return t.payloadTons <= 5 ? 'RETURNING' : 'DUMPING';

      case 'RETURNING':
        if (t.fuelPct <= 18) return 'REFUEL';
        if (t.healthPct <= 55) return 'MAINT';
        return 'IDLE';

      case 'REFUEL':
        return t.fuelPct >= 92 ? 'IDLE' : 'REFUEL';

      case 'MAINT':
        return t.healthPct >= 88 ? 'IDLE' : 'MAINT';

      default:
        return 'IDLE';
    }
  }

  // ---------------------------
  // Internal helpers
  // ---------------------------

  private setStatus(id: string, status: VehicleStatus) {
    this._vehicles.update(list =>
      list.map(v => (v.id === id ? { ...v, status, lastUpdateIso: new Date().toISOString() } : v)),
    );
    const meta = this.simMeta.get(id);
    if (meta) meta.dwellUntilMs = 0;
  }

  private setCoreStatus(id: string, status: CoreVehicleStatus) {
    this._vehicles.update(list =>
      list.map(v => {
        if (v.id !== id) return v;
        // If fault/paused, operator override still applies
        return { ...v, status, lastUpdateIso: new Date().toISOString() };
      }),
    );
    const meta = this.simMeta.get(id);
    if (meta) meta.dwellUntilMs = 0;
  }

  private makeVehicle(id: string): FleetVehicle {
    this.simMeta.set(id, {
      dwellUntilMs: 0,
      phaseOffsetMs: Math.floor(hash01(id) * 1200),
    });

    return {
      id,
      name: `Autonomous Truck ${id}`,
      status: 'IDLE',
      lastUpdateIso: new Date().toISOString(),
      telemetry: {
        speedKph: 0,
        payloadTons: 0,
        fuelPct: 70 + hash01(id + '#fuel') * 25,
        engineTempC: 78,
        healthPct: 85 + hash01(id + '#health') * 12,
      },
    };
  }

  private getMeta(id: string): SimMeta {
    const m = this.simMeta.get(id);
    if (m) return m;

    const fresh: SimMeta = { dwellUntilMs: 0, phaseOffsetMs: Math.floor(hash01(id) * 1200) };
    this.simMeta.set(id, fresh);
    return fresh;
  }

  private dwellFor(status: CoreVehicleStatus, offsetMs: number): number {
    switch (status) {
      case 'LOADING':
        return 1200 + offsetMs;
      case 'DUMPING':
        return 900 + offsetMs;
      case 'REFUEL':
        return 900 + offsetMs;
      case 'MAINT':
        return 1200 + offsetMs;
      default:
        return 0;
    }
  }

  private telemetryDuringDwell(t: VehicleTelemetry, status: CoreVehicleStatus): VehicleTelemetry {
    if (status === 'LOADING') {
      return {
        ...t,
        speedKph: 0,
        payloadTons: clamp(t.payloadTons + rand(6, 14), 0, 220),
        fuelPct: clamp(t.fuelPct + rand(-0.08, 0.02), 0, 100),
        engineTempC: clamp(t.engineTempC + rand(-0.2, 0.5), 60, 110),
        healthPct: clamp(t.healthPct + rand(0.0, 0.03), 30, 100),
      };
    }

    if (status === 'DUMPING') {
      return {
        ...t,
        speedKph: 0,
        payloadTons: clamp(t.payloadTons + rand(-16, -7), 0, 220),
        fuelPct: clamp(t.fuelPct + rand(-0.08, 0.02), 0, 100),
        engineTempC: clamp(t.engineTempC + rand(-0.4, 0.4), 60, 110),
        healthPct: clamp(t.healthPct + rand(0.0, 0.02), 30, 100),
      };
    }

    if (status === 'REFUEL') {
      return {
        ...t,
        speedKph: 0,
        payloadTons: clamp(t.payloadTons, 0, 220),
        fuelPct: clamp(t.fuelPct + rand(6, 10), 0, 100),
        engineTempC: clamp(t.engineTempC + rand(-0.6, 0.2), 60, 110),
        healthPct: clamp(t.healthPct + rand(0.01, 0.05), 30, 100),
      };
    }

    if (status === 'MAINT') {
      return {
        ...t,
        speedKph: 0,
        payloadTons: clamp(t.payloadTons, 0, 220),
        fuelPct: clamp(t.fuelPct + rand(-0.05, 0.05), 0, 100),
        engineTempC: clamp(t.engineTempC + rand(-0.8, 0.2), 60, 110),
        healthPct: clamp(t.healthPct + rand(3, 6), 30, 100),
      };
    }

    return {
      ...t,
      speedKph: 0,
      fuelPct: clamp(t.fuelPct + rand(-0.05, 0.03), 0, 100),
      engineTempC: clamp(t.engineTempC + rand(-0.3, 0.4), 60, 110),
      healthPct: clamp(t.healthPct + rand(0.0, 0.02), 30, 100),
    };
  }

  private telemetryStep(t: VehicleTelemetry, status: CoreVehicleStatus): VehicleTelemetry {
    const moving = status === 'HAULING' || status === 'RETURNING' || status === 'DISPATCHED';
    const loaded = t.payloadTons > 50;

    const targetSpeed =
      status === 'HAULING' ? 34 :
      status === 'RETURNING' ? 38 :
      status === 'DISPATCHED' ? 12 :
      0;

    const speedKph = moving
      ? clamp(t.speedKph + rand(-2, 6), 0, Math.max(10, targetSpeed + 10))
      : 0;

    const burn = moving ? (loaded ? 0.08 : 0.05) : 0.01;
    const wear = moving ? (loaded ? 0.03 : 0.02) : 0.005;

    return {
      speedKph: targetSpeed === 0 ? 0 : clamp(speedKph, 0, 55),
      payloadTons: t.payloadTons,
      fuelPct: clamp(t.fuelPct - burn + rand(-0.02, 0.02), 0, 100),
      engineTempC: clamp(
        t.engineTempC + (moving ? rand(0.1, 0.6) : rand(-0.2, 0.2)) + (loaded ? 0.15 : 0),
        60,
        115,
      ),
      healthPct: clamp(t.healthPct - wear + rand(-0.01, 0.01), 30, 100),
    };
  }
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}
