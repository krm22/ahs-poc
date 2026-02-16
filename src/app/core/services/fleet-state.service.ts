import { Injectable, signal, computed } from '@angular/core';

export type CoreVehicleStatus =
  | 'IDLE'
  | 'DISPATCHED'
  | 'LOADING'
  | 'HAULING'
  | 'DUMPING'
  | 'RETURNING'
  | 'FAULT';

export type VehicleStatus = CoreVehicleStatus | 'PAUSED';

export interface VehicleTelemetry {
  speedKph: number;
  payloadTons: number;
  fuelPct: number;
  engineTempC: number;
}

export interface FleetVehicle {
  id: string;
  name: string;
  status: VehicleStatus;
  lastUpdateIso: string;
  telemetry: VehicleTelemetry;
}

@Injectable({ providedIn: 'root' })
export class FleetStateService {
  private simHandle: any = null;

  private readonly _vehicles = signal<FleetVehicle[]>([]);

  // Signals/computed (readable from templates if you want), BUT ALSO provide methods for old call sites.
  readonly vehiclesSig = computed(() => this._vehicles());
  readonly vehicleIdsSig = computed(() => this._vehicles().map(v => v.id));

  // ✅ Legacy-friendly methods used by components: this.fleet.vehicles()
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
      hauling: list.filter((v: FleetVehicle) => v.status === 'HAULING').length,
      faults: list.filter((v: FleetVehicle) => v.status === 'FAULT').length,
      paused: list.filter((v: FleetVehicle) => v.status === 'PAUSED').length,
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
    this.simHandle = setInterval(() => this.tick(), 2000);
  }

  stopSimulation() {
    if (this.simHandle) {
      clearInterval(this.simHandle);
      this.simHandle = null;
    }
  }

  // ---------------------------
  // Vehicle Controls
  // ---------------------------

  pauseVehicle(id: string) {
    this.setStatus(id, 'PAUSED');
  }

  resumeVehicle(id: string) {
    this.setStatus(id, 'IDLE');
  }

  raiseFault(id: string) {
    this.setStatus(id, 'FAULT');
  }

  clearFault(id: string) {
    this.setStatus(id, 'IDLE');
  }

  private setStatus(id: string, status: VehicleStatus) {
    this._vehicles.update((list: FleetVehicle[]) =>
      list.map((v: FleetVehicle) =>
        v.id === id
          ? { ...v, status, lastUpdateIso: new Date().toISOString() }
          : v,
      ),
    );
  }

  // ---------------------------
  // Simulation Tick
  // ---------------------------

  private tick() {
    this._vehicles.update((list: FleetVehicle[]) =>
      list.map((v: FleetVehicle) => {
        if (v.status === 'PAUSED' || v.status === 'FAULT') return v;

        const next = this.nextStatus(v.status);

        return {
          ...v,
          status: next,
          lastUpdateIso: new Date().toISOString(),
          telemetry: this.jitter(v.telemetry, next),
        };
      }),
    );
  }

  private nextStatus(current: CoreVehicleStatus): CoreVehicleStatus {
    switch (current) {
      case 'IDLE':
        return 'DISPATCHED';
      case 'DISPATCHED':
        return 'LOADING';
      case 'LOADING':
        return 'HAULING';
      case 'HAULING':
        return 'DUMPING';
      case 'DUMPING':
        return 'RETURNING';
      case 'RETURNING':
        return 'IDLE';
      default:
        return 'IDLE';
    }
  }

  // ---------------------------
  // Helpers
  // ---------------------------

  private makeVehicle(id: string): FleetVehicle {
    return {
      id,
      name: `Autonomous Truck ${id}`,
      status: 'IDLE',
      lastUpdateIso: new Date().toISOString(),
      telemetry: {
        speedKph: 0,
        payloadTons: 0,
        fuelPct: 85,
        engineTempC: 78,
      },
    };
  }

  private jitter(t: VehicleTelemetry, status: CoreVehicleStatus): VehicleTelemetry {
    return {
      speedKph:
        status === 'HAULING'
          ? clamp(t.speedKph + rand(-2, 6), 0, 55)
          : clamp(t.speedKph + rand(-4, 3), 0, 40),

      payloadTons:
        status === 'LOADING'
          ? clamp(t.payloadTons + rand(1, 5), 0, 220)
          : status === 'DUMPING'
            ? clamp(t.payloadTons + rand(-6, -2), 0, 220)
            : t.payloadTons,

      fuelPct: clamp(t.fuelPct + rand(-0.5, 0.1), 0, 100),
      engineTempC: clamp(t.engineTempC + rand(-0.3, 0.8), 60, 115),
    };
  }
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
