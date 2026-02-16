
@Injectable({
  providedIn: 'root',
})
export class MockFleet {
  
}
import { Injectable } from '@angular/core';

export type VehicleState = 'IDLE' | 'DISPATCHED' | 'HAULING' | 'DUMPING' | 'STOPPED';

export interface Vehicle {
  id: string;
  name: string;
  state: VehicleState;
  speedMps: number;
  payloadT: number;
  fuelPct: number;
  lat: number;
  lon: number;
  headingDeg: number;
  updatedAtIso: string;
}

@Injectable({ providedIn: 'root' })
export class MockFleetService {
  private vehicles: Vehicle[] = [
    {
      id: 'TRK-001',
      name: 'Truck 001',
      state: 'HAULING',
      speedMps: 9.8,
      payloadT: 185,
      fuelPct: 62,
      lat: -23.7001,
      lon: 133.8807,
      headingDeg: 45,
      updatedAtIso: new Date().toISOString(),
    },
    {
      id: 'TRK-002',
      name: 'Truck 002',
      state: 'DISPATCHED',
      speedMps: 6.1,
      payloadT: 0,
      fuelPct: 78,
      lat: -23.7018,
      lon: 133.8822,
      headingDeg: 120,
      updatedAtIso: new Date().toISOString(),
    },
    {
      id: 'TRK-003',
      name: 'Truck 003',
      state: 'IDLE',
      speedMps: 0,
      payloadT: 0,
      fuelPct: 91,
      lat: -23.6994,
      lon: 133.8791,
      headingDeg: 270,
      updatedAtIso: new Date().toISOString(),
    },
  ];

  list(): Vehicle[] {
    // Phase 0: static mock snapshot.
    // Phase 1: replace with HTTP/WebSocket from sim/api.
    return this.vehicles.map(v => ({ ...v }));
  }
}
