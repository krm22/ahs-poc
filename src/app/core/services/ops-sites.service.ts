import { Injectable, computed, signal } from '@angular/core';
import type { DigFace, DumpSite, TipEdge, TipNode } from '../models/ops.models';
import type { LatLng } from '../models/fleet.models';
import { OPS_DIG_FACES, OPS_DUMPS, OPS_TIP_EDGES, OPS_TIP_NODES } from '../geo/ops-sites.geo';

@Injectable({ providedIn: 'root' })
export class OpsSitesService {
  private readonly digFacesList: DigFace[] = (OPS_DIG_FACES as any).features.map((f: any) => ({
    id: f.properties.id,
    name: f.properties.name,
    equipment: f.properties.equipment,
    location: { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
  }));

  private readonly dumpSitesList: DumpSite[] = (OPS_DUMPS as any).features.map((f: any) => {
    const id = f.properties.id as string;

    const firstEdgeForDump =
      (OPS_TIP_EDGES as any).features.find((e: any) => e.properties.dumpId === id)?.properties?.id ?? '';

    // polygon here is GeoJSON Polygon coordinates: number[][][] (we keep original shape)
    const polygon = f.geometry.coordinates as number[][][];

    return {
      id,
      name: f.properties.name,
      polygon,
      defaultTipEdgeId: firstEdgeForDump,
    };
  });

  private readonly tipNodesList: TipNode[] = (OPS_TIP_NODES as any).features.map((f: any) => ({
    id: f.properties.id,
    dumpId: f.properties.dumpId,
    name: f.properties.name,
    location: { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
  }));

  private readonly tipEdgesList: TipEdge[] = (OPS_TIP_EDGES as any).features.map((f: any) => ({
    id: f.properties.id,
    dumpId: f.properties.dumpId,
    name: f.properties.name,
    fromNodeId: f.properties.from,
    toNodeId: f.properties.to,
    path: (f.geometry.coordinates as any[]).map((c) => ({ lng: c[0], lat: c[1] })) as LatLng[],
  }));

  private readonly dumpDefaults = signal<Record<string, string>>(
    Object.fromEntries(this.dumpSitesList.map((d) => [d.id, d.defaultTipEdgeId])),
  );

  readonly digFaces = computed(() => this.digFacesList);

  readonly dumpSites = computed(() =>
    this.dumpSitesList.map((d) => ({
      ...d,
      defaultTipEdgeId: this.dumpDefaults()[d.id] ?? d.defaultTipEdgeId,
    })),
  );

  readonly tipNodes = computed(() => this.tipNodesList);
  readonly tipEdges = computed(() => this.tipEdgesList);

  getDumpDefaultTipEdgeId(dumpId: string): string {
    return this.dumpDefaults()[dumpId] ?? '';
  }

  setDumpDefaultTipEdge(dumpId: string, tipEdgeId: string): void {
    this.dumpDefaults.update((m) => ({ ...m, [dumpId]: tipEdgeId }));
  }

  getTipEdgesForDump(dumpId: string): TipEdge[] {
    return this.tipEdgesList.filter((e) => e.dumpId === dumpId);
  }

  getDig(digId: string): DigFace | undefined {
    return this.digFacesList.find((d) => d.id === digId);
  }

  getTipNode(nodeId: string): TipNode | undefined {
    return this.tipNodesList.find((n) => n.id === nodeId);
  }

  getTipEdge(edgeId: string): TipEdge | undefined {
    return this.tipEdgesList.find((e) => e.id === edgeId);
  }

  getTipPointForEdge(edgeId: string): LatLng | undefined {
    const e = this.getTipEdge(edgeId);
    if (!e) return;
    const to = this.getTipNode(e.toNodeId);
    return to?.location;
  }
}
