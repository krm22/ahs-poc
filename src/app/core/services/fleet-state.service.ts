// src/app/core/services/fleet-state.service.ts

import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { FleetVehicle, VehicleStatus } from '../models/fleet.models';

// ✅ Components import FleetVehicle from this service file in a few places.
// Re-export it so those imports compile without changing the components.
export type { FleetVehicle } from '../models/fleet.models';

type FleetKpis = {
  total: number;
  pausedOrFault: number;
  active: number;
  hauling: number;
  returning: number;
  refuel: number;
  maint: number;
  fault: number;
};

@Injectable({ providedIn: 'root' })
export class FleetStateService {
  private readonly destroyRef = inject(DestroyRef);

  private readonly _vehicles = signal<FleetVehicle[]>(this.createInitialFleet(10));
  readonly vehicles = computed(() => this._vehicles());

  // ---- API expected by components ----

  vehicleIds(): string[] {
    return this._vehicles().map(v => v.id);
  }

  readonly kpis = computed<FleetKpis>(() => {
    const list = this._vehicles();
    const by = (s: VehicleStatus) => list.filter(v => v.status === s).length;

    const pausedOrFault = list.filter(v => v.status === 'PAUSED' || v.status === 'FAULT').length;
    const active = list.filter(
      v => v.status !== 'IDLE' && v.status !== 'PAUSED' && v.status !== 'FAULT'
    ).length;

    return {
      total: list.length,
      pausedOrFault,
      active,
      hauling: by('HAULING'),
      returning: by('RETURNING'),
      refuel: by('REFUEL'),
      maint: by('MAINT'),
      fault: by('FAULT'),
    };
  });

  startSimulation(): void {
    if (this._simTimer) return;
    this._simTimer = window.setInterval(() => this.tick(), 1000);

    this.destroyRef.onDestroy(() => {
      if (this._simTimer) window.clearInterval(this._simTimer);
      this._simTimer = undefined;
    });
  }

  dispatchVehicle(id: string): void {
    this.updateVehicle(id, v => {
      if (v.status === 'PAUSED' || v.status === 'FAULT') return v;
      return this.withStatus(v, 'HAULING');
    });
  }

  sendToFuel(id: string): void {
    this.updateVehicle(id, v => {
      if (v.status === 'PAUSED' || v.status === 'FAULT') return v;
      return this.withStatus(v, 'REFUEL');
    });
  }

  sendToMaint(id: string): void {
    this.updateVehicle(id, v => {
      if (v.status === 'PAUSED') return v;
      return this.withStatus(v, 'MAINT');
    });
  }

  pauseVehicle(id: string): void {
    this.updateVehicle(id, v => {
      if (v.status === 'FAULT') return v;
      if (v.status === 'PAUSED') return v;
      return {
        ...v,
        prevStatus: v.status,
        status: 'PAUSED',
        state: 'PAUSED',
        lastUpdateIso: new Date().toISOString(),
      };
    });
  }

  resume(id: string): void {
    this.resumeVehicle(id);
  }

  resumeVehicle(id: string): void {
    this.updateVehicle(id, v => {
      if (v.status !== 'PAUSED') return v;
      const next: VehicleStatus = v.prevStatus && v.prevStatus !== 'PAUSED' ? v.prevStatus : 'IDLE';
      return {
        ...v,
        prevStatus: undefined,
        status: next,
        state: next,
        lastUpdateIso: new Date().toISOString(),
      };
    });
  }

  stopAll(): void {
    this._vehicles.update(list =>
      list.map(v => {
        if (v.status === 'FAULT') return v;
        if (v.status === 'PAUSED') return { ...v, prevStatus: 'IDLE' };
        return this.withStatus(v, 'IDLE');
      })
    );
  }

  resumeAll(): void {
    const ids = this.vehicleIds();
    for (const id of ids) this.resumeVehicle(id);
  }

  raiseFault(id: string): void {
    this.updateVehicle(id, v => {
      if (v.status === 'FAULT') return v;
      return {
        ...v,
        prevStatus: v.status,
        status: 'FAULT',
        state: 'FAULT',
        lastUpdateIso: new Date().toISOString(),
        telemetry: {
          ...v.telemetry,
          speedKph: 0,
          engineTempC: Math.max(v.telemetry.engineTempC, 110),
          healthPct: Math.max(0, v.telemetry.healthPct - 10),
        },
      };
    });
  }

  // ✅ NEW: required by command + fleet components
  clearFault(id: string): void {
    this.updateVehicle(id, v => {
      if (v.status !== 'FAULT') return v;

      // After clearing, resume previous non-fault state or go IDLE
      const next: VehicleStatus =
        v.prevStatus && v.prevStatus !== 'FAULT' ? v.prevStatus : 'IDLE';

      // Give it a small “recovery boost”
      return {
        ...v,
        prevStatus: undefined,
        status: next,
        state: next,
        lastUpdateIso: new Date().toISOString(),
        telemetry: {
          ...v.telemetry,
          engineTempC: clamp(v.telemetry.engineTempC - 5, 60, 125),
          healthPct: clamp(v.telemetry.healthPct + 5, 0, 100),
          speedKph: 0,
        },
      };
    });
  }

  // ---- Internal simulation loop ----

  private _simTimer: number | undefined;

  private tick(): void {
    const nowIso = new Date().toISOString();

    this._vehicles.update(list =>
      list.map(v => {
        if (v.status === 'PAUSED' || v.status === 'FAULT') {
          return { ...v, lastUpdateIso: nowIso };
        }

        const nextStatus = this.advanceStatus(v.status, v.telemetry);

        const speed = this.targetSpeed(nextStatus);
        const fuelDrain = nextStatus === 'HAULING' || nextStatus === 'RETURNING' ? 0.6 : 0.2;
        const heatBump = nextStatus === 'HAULING' ? 1.2 : nextStatus === 'REFUEL' ? -1.5 : 0.2;

        const fuelPct = clamp(v.telemetry.fuelPct - fuelDrain, 0, 100);
        const healthPct = clamp(v.telemetry.healthPct - (nextStatus === 'MAINT' ? -0.8 : 0.05), 0, 100);
        const engineTempC = clamp(v.telemetry.engineTempC + heatBump, 60, 125);

        const finalStatus: VehicleStatus =
          fuelPct <= 12 && nextStatus !== 'REFUEL' && nextStatus !== 'MAINT'
            ? 'REFUEL'
            : nextStatus;

        return {
          ...v,
          status: finalStatus,
          state: finalStatus,
          lastUpdateIso: nowIso,
          telemetry: {
            ...v.telemetry,
            speedKph: speed,
            fuelPct,
            healthPct,
            engineTempC,
            payloadTons: this.targetPayload(finalStatus, v.telemetry.payloadTons),
          },
        };
      })
    );
  }

  private advanceStatus(current: VehicleStatus, t: FleetVehicle['telemetry']): VehicleStatus {
    if (current === 'REFUEL') return t.fuelPct >= 95 ? 'IDLE' : 'REFUEL';
    if (current === 'MAINT') return t.healthPct >= 90 ? 'IDLE' : 'MAINT';

    switch (current) {
      case 'IDLE':
        return Math.random() < 0.35 ? 'HAULING' : 'IDLE';
      case 'HAULING':
        return Math.random() < 0.25 ? 'DUMPING' : 'HAULING';
      case 'DUMPING':
        return Math.random() < 0.6 ? 'RETURNING' : 'DUMPING';
      case 'RETURNING':
        return Math.random() < 0.25 ? 'LOADING' : 'RETURNING';
      case 'LOADING':
        return Math.random() < 0.6 ? 'HAULING' : 'LOADING';
      default:
        return current;
    }
  }

  private targetSpeed(status: VehicleStatus): number {
    switch (status) {
      case 'HAULING':
        return 32 + Math.random() * 10;
      case 'RETURNING':
        return 36 + Math.random() * 12;
      case 'LOADING':
      case 'DUMPING':
        return 2 + Math.random() * 4;
      case 'REFUEL':
      case 'MAINT':
      case 'IDLE':
      default:
        return 0;
    }
  }

  private targetPayload(status: VehicleStatus, current: number): number {
    if (status === 'LOADING') return clamp(current + 8 + Math.random() * 6, 0, 290);
    if (status === 'DUMPING') return clamp(current - (12 + Math.random() * 10), 0, 290);
    return clamp(current + (Math.random() - 0.5) * 1.5, 0, 290);
  }

  private withStatus(v: FleetVehicle, status: VehicleStatus): FleetVehicle {
    return {
      ...v,
      status,
      state: status,
      lastUpdateIso: new Date().toISOString(),
    };
  }

  private updateVehicle(id: string, fn: (v: FleetVehicle) => FleetVehicle): void {
    this._vehicles.update(list => list.map(v => (v.id === id ? fn(v) : v)));
  }

  private createInitialFleet(count: number): FleetVehicle[] {
    const nowIso = new Date().toISOString();
    return Array.from({ length: count }).map((_, i) => {
      const id = `TRK-${String(i + 1).padStart(2, '0')}`;
      return {
        id,
        name: `Truck ${i + 1}`,
        status: 'IDLE',
        state: 'IDLE',
        lastUpdateIso: nowIso,
        telemetry: {
          speedKph: 0,
          payloadTons: Math.random() * 30,
          fuelPct: 60 + Math.random() * 40,
          healthPct: 80 + Math.random() * 20,
          engineTempC: 75 + Math.random() * 10,
        },
      };
    });
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
