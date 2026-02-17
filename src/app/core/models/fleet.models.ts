// src/app/core/models/fleet.models.ts

export type LatLng = { lat: number; lng: number };

export type VehicleStatus =
  | 'IDLE'
  | 'DISPATCHED'
  | 'HAULING'
  | 'RETURNING'
  | 'LOADING'
  | 'DUMPING'
  | 'REFUEL'
  | 'MAINT'
  | 'PAUSED'
  | 'FAULT';

export interface FleetTelemetry {
  speedKph: number;
  payloadTons: number;
  fuelPct: number;      // 0..100
  healthPct: number;    // 0..100
  engineTempC: number;  // typical ~70..120
}

export interface FleetVehicle {
  id: string;
  name: string;

  status: VehicleStatus;
  state: VehicleStatus;

  telemetry: FleetTelemetry;

  lastUpdateIso: string;

  prevStatus?: VehicleStatus;
}
