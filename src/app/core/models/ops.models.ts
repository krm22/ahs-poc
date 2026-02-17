import type { LatLng } from './fleet.models';

export type DigEquipmentType = 'EXCAVATOR' | 'SHOVEL';

export interface DigFace {
  id: string;
  name: string;
  equipment: DigEquipmentType;
  location: LatLng;
}

export interface DumpSite {
  id: string;
  name: string;
  /** Polygon in [lng,lat] coords (MapLibre/GeoJSON order). */
  polygon: number[][][];
  /** The default edge that trucks should tip on for this dump. */
  defaultTipEdgeId: string;
}

export interface TipNode {
  id: string;
  dumpId: string;
  name: string;
  location: LatLng;
}

export interface TipEdge {
  id: string;
  dumpId: string;
  name: string;
  /** Node ids */
  fromNodeId: string;
  toNodeId: string;
  /** Optional detailed path (fallback to straight line). */
  path?: LatLng[];
}

export interface TruckAssignment {
  vehicleId: string;
  digId: string;
  dumpId: string;
}
