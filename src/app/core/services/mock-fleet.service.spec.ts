import { Injectable, inject } from '@angular/core';
import { FleetStateService } from './fleet-state.service';
import { Vehicle } from '../models/fleet.models';
import { Observable, map, startWith } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MockFleetService {
  private readonly fleet = inject(FleetStateService);

  /** Signal-backed snapshot getter (easy for components) */
  getVehiclesSnapshot(): Vehicle[] {
    return this.fleet.vehicles();
  }

  /** Simple observable stream of telemetry (for charts/logs) */
  telemetry$ = this.fleet.telemetry$;

  /** Optional: derived stream you can bind to without signals */
  vehicles$: Observable<Vehicle[]> = this.fleet.telemetry$.pipe(
    startWith(null),
    map(() => this.fleet.vehicles())
  );

  start(): void {
    this.fleet.startSimulation();
  }

  stop(): void {
    this.fleet.stopSimulation();
  }

  // Commands (Phase 0)
  dispatch(id: string): void {
    this.fleet.dispatchVehicle(id);
  }
  pause(id: string): void {
    this.fleet.pauseVehicle(id);
  }
  resume(id: string): void {
    this.fleet.resumeVehicle(id);
  }
  fault(id: string, message?: string): void {
    this.fleet.raiseFault(id, message);
  }
  clearFault(id: string): void {
    this.fleet.clearFault(id);
  }
}
