export type VehicleId = string;

export type VehicleStatus =
  | 'IDLE'
  | 'DISPATCHED'
  | 'LOADING'
  | 'HAULING'
  | 'DUMPING'
  | 'RETURNING'
  | 'PAUSED'
  | 'FAULT';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Vehicle {
  id: VehicleId;
  name: string;            // e.g. "TRK-01"
  status: VehicleStatus;
  position: LatLng;
  headingDeg: number;      // 0..359
  speedKph: number;        // 0..~60
  payloadTons: number;     // 0..~320 (demo)
  fuelPct: number;         // 0..100
  healthPct: number;       // 0..100
  lastUpdateMs: number;    // epoch ms
}

export interface TelemetryPoint {
  vehicleId: VehicleId;
  tsMs: number;
  position: LatLng;
  speedKph: number;
  headingDeg: number;
  status: VehicleStatus;
}

export interface FleetKpis {
  total: number;
  active: number;     // not IDLE
  faults: number;     // FAULT
  paused: number;     // PAUSED
  avgSpeedKph: number;
  totalPayloadTons: number;
}
