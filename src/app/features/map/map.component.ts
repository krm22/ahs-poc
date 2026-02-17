// src/app/features/map/map.component.ts
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';

import maplibregl from 'maplibre-gl';
import { environment } from '../../../environments/environment';

// ✅ Use the SAME path your app already uses for the service
import { FleetStateService } from '../../core/services/fleet-state.service';

type LngLat = [number, number];
type TruckMode = 'HAULING' | 'LOADING' | 'DUMPING' | 'IDLE';

interface TruckSim {
  id: string;
  progressM: number;
  speedMps: number;
  mode: TruckMode;
  dwellLeftS: number;
  targetStop?: 'PIT' | 'DUMP';
  lastHeadingDeg: number;
}

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map!: maplibregl.Map;

  // matches your HTML checkboxes
  layers = {
    satellite: false,
    hillshade: true, // hillshade only
    pits3d: true, // terrain + extrusions
    haul: true, // route
    trucks: true, // trucks + animation
  };

  // DEM maxzoom from your TileJSON (avoid z=13 400)
  private readonly DEM_MAX_ZOOM = 12;
  private readonly TERRAIN_EXAGGERATION = 1.35;

  // Sources & layers
  private readonly SRC_ROUTE = 'src-haul-route';
  private readonly SRC_PITS = 'src-pits';
  private readonly SRC_DUMPS = 'src-dumps';
  private readonly SRC_INFRA = 'src-infra';
  private readonly SRC_TRUCKS = 'src-trucks';

  private readonly LYR_ROUTE = 'lyr-haul-route';

  private readonly LYR_PITS_FILL = 'lyr-pits-fill';
  private readonly LYR_PITS_3D = 'lyr-pits-3d';

  private readonly LYR_DUMPS_FILL = 'lyr-dumps-fill';
  private readonly LYR_DUMPS_3D = 'lyr-dumps-3d';

  private readonly LYR_INFRA = 'lyr-infra';
  private readonly LYR_INFRA_LABELS = 'lyr-infra-labels';

  private readonly LYR_TRUCKS = 'lyr-trucks';
  private readonly LYR_TRUCKS_LABELS = 'lyr-trucks-labels';

  // Simulation state
  private animationHandle: number | null = null;
  private lastTickMs = 0;

  private routeCoords: LngLat[] = [];
  private routeCumDistM: number[] = [];
  private routeLenM = 0;

  private trucks: TruckSim[] = [];

  private pitStops: {
    name: string;
    center: LngLat;
    radiusM: number;
    dwellS: [number, number];
  }[] = [];

  private dumpStops: {
    name: string;
    center: LngLat;
    radiusM: number;
    dwellS: [number, number];
  }[] = [];

  constructor(private fleet: FleetStateService) {}

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    try {
      this.map?.remove();
    } catch {
      // ignore
    }
  }

  // -----------------------------------------
  // UI toggles (called by your existing HTML)
  // -----------------------------------------
  setLayer(layer: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    (this.layers as any)[layer] = checked;

    switch (layer) {
      case 'satellite':
        this.setBaseStyle(checked);
        break;

      case 'hillshade':
        this.applyHillshadeState();
        break;

      case 'pits3d':
        this.applyTerrainState();
        this.applyPitDump3DState();
        break;

      case 'haul':
        this.applyRouteState();
        break;

      case 'trucks':
        this.applyTrucksState();
        break;

      default:
        break;
    }
  }

  // -----------------------------------------
  // Map init
  // -----------------------------------------
  private initMap(): void {
    let key = '';
    try {
      key = this.getMapTilerKey();
    } catch (err) {
      console.error(err);
      return;
    }

    const center: LngLat = [119.35, -23.36]; // Newman/Whaleback-ish

    const options: any = {
      container: this.mapEl.nativeElement,
      style: this.getBaseStyleUrl(key, this.layers.satellite),
      center,
      zoom: 13,
      pitch: 55,
      bearing: -20,
      attributionControl: true,
    };

    this.map = new maplibregl.Map(options);
    this.map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );

    this.map.on('load', () => {
      this.ensureDemSourcesAndHillshadeExist();
      this.buildMineGeometry(center);

      this.ensureMineSourcesAndLayersExist();
      this.ensureTruckSourceAndLayersExist();

      // ✅ FORCE-APPLY STYLES EVEN IF LAYERS ALREADY EXIST (fixes “no color changes”)
      this.applyLabelAndMarkerStyles();

      this.applyTerrainState();
      this.applyHillshadeState();
      this.applyPitDump3DState();
      this.applyRouteState();
      this.applyTrucksState();

      this.attachInteractions();
      this.map.resize();
    });

    this.map.on('error', (e: any) => {
      console.error('[MapComponent] MapLibre error:', e?.error || e);
    });
  }

  private setBaseStyle(useSatellite: boolean): void {
    if (!this.map) return;

    const key = this.getMapTilerKey();
    this.map.setStyle(this.getBaseStyleUrl(key, useSatellite));

    // setStyle wipes custom layers/sources; rebuild after style loads
    this.map.once('styledata', () => {
      const c = this.map.getCenter();
      const center: LngLat = [c.lng, c.lat];

      this.ensureDemSourcesAndHillshadeExist();
      this.buildMineGeometry(center);

      this.ensureMineSourcesAndLayersExist();
      this.ensureTruckSourceAndLayersExist();

      // ✅ re-apply styles after style switch
      this.applyLabelAndMarkerStyles();

      this.applyTerrainState();
      this.applyHillshadeState();
      this.applyPitDump3DState();
      this.applyRouteState();
      this.applyTrucksState();

      this.attachInteractions();
    });
  }

  // -----------------------------------------
  // MapTiler helpers
  // -----------------------------------------
  private getMapTilerKey(): string {
    const env: any = environment as any;
    const key = env.maptilerKey ?? env.mapTilerKey ?? env.mappTilerKey ?? '';
    if (!key || typeof key !== 'string' || key.trim().length < 10) {
      throw new Error(
        '[MapComponent] Missing MapTiler API key (environment.maptilerKey).'
      );
    }
    return key.trim();
  }

  private getBaseStyleUrl(key: string, satellite: boolean): string {
    const k = encodeURIComponent(key);
    return satellite
      ? `https://api.maptiler.com/maps/satellite/style.json?key=${k}`
      : `https://api.maptiler.com/maps/streets/style.json?key=${k}`;
  }

  // -----------------------------------------
  // DEM + hillshade
  // -----------------------------------------
  private ensureDemSourcesAndHillshadeExist(): void {
    if (!this.map) return;

    const key = this.getMapTilerKey();
    const tileJsonUrl = `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${encodeURIComponent(
      key
    )}`;

    if (!this.map.getSource('terrain-dem')) {
      this.map.addSource(
        'terrain-dem',
        {
          type: 'raster-dem',
          url: tileJsonUrl,
          tileSize: 256,
          maxzoom: this.DEM_MAX_ZOOM,
        } as any
      );
    }

    if (!this.map.getSource('hillshade-dem')) {
      this.map.addSource(
        'hillshade-dem',
        {
          type: 'raster-dem',
          url: tileJsonUrl,
          tileSize: 256,
          maxzoom: this.DEM_MAX_ZOOM,
        } as any
      );
    }

    if (!this.map.getLayer('hillshade-layer')) {
      this.map.addLayer(
        {
          id: 'hillshade-layer',
          type: 'hillshade',
          source: 'hillshade-dem',
          layout: { visibility: 'none' },
        } as any
      );
    }
  }

  private applyTerrainState(): void {
    if (!this.map) return;

    if (this.layers.pits3d) {
      this.map.setTerrain(
        {
          source: 'terrain-dem',
          exaggeration: this.TERRAIN_EXAGGERATION,
        } as any
      );
    } else {
      this.map.setTerrain(null as any);
    }
  }

  private applyHillshadeState(): void {
    if (!this.map) return;
    this.toggleVisibility('hillshade-layer', this.layers.hillshade);
  }

  // -----------------------------------------
  // Mine geometry (pits/dumps/infra/route)
  // -----------------------------------------
  private buildMineGeometry(center: LngLat): void {
    const [cx, cy] = center;
    const o = (dx: number, dy: number): LngLat => [cx + dx, cy + dy];

    // Pits
    const pitA = this.makeOvalPolygon(o(-0.030, 0.010), 0.010, 0.006, 18);
    const pitB = this.makeOvalPolygon(o(-0.010, -0.012), 0.008, 0.005, 18);
    const pitC = this.makeOvalPolygon(o(0.018, 0.014), 0.009, 0.006, 18);

    // Dumps / ROM pads
    const dumpNorth = this.makePadPolygon(o(0.030, 0.020), 0.012, 0.008, 15);
    const dumpSouth = this.makePadPolygon(o(0.026, -0.020), 0.014, 0.009, 15);

    // Infrastructure points
    const infra: { name: string; kind: string; coord: LngLat }[] = [
      { name: 'Workshop', kind: 'workshop', coord: o(0.005, -0.002) },
      { name: 'Fuel Bay', kind: 'fuel', coord: o(0.010, -0.004) },
      { name: 'Weighbridge', kind: 'weigh', coord: o(0.012, -0.001) },
      { name: 'Crusher', kind: 'crusher', coord: o(0.020, 0.002) },
      { name: 'Substation', kind: 'power', coord: o(0.016, -0.010) },
      { name: 'Camp', kind: 'camp', coord: o(-0.020, -0.022) },
    ];

    // Stop zones
    this.pitStops = [
      { name: 'Pit A', center: o(-0.030, 0.010), radiusM: 180, dwellS: [18, 35] },
      { name: 'Pit B', center: o(-0.010, -0.012), radiusM: 160, dwellS: [15, 30] },
      { name: 'Pit C', center: o(0.018, 0.014), radiusM: 170, dwellS: [16, 32] },
    ];

    this.dumpStops = [
      { name: 'Dump North', center: o(0.030, 0.020), radiusM: 220, dwellS: [12, 24] },
      { name: 'Dump South', center: o(0.026, -0.020), radiusM: 240, dwellS: [12, 26] },
    ];

    // Haul loop (interesting path across pits/dumps/infrastructure)
    const loop: LngLat[] = [
      o(-0.040, 0.012),
      o(-0.034, 0.012),
      o(-0.030, 0.010), // Pit A
      o(-0.022, 0.006),
      o(-0.012, 0.004),
      o(0.002, 0.003),
      o(0.012, 0.002),  // Weighbridge
      o(0.020, 0.002),  // Crusher
      o(0.026, 0.010),
      o(0.030, 0.020),  // Dump North
      o(0.026, 0.022),
      o(0.020, 0.018),
      o(0.018, 0.014),  // Pit C
      o(0.014, 0.008),
      o(0.010, 0.002),
      o(0.012, -0.006),
      o(0.018, -0.014),
      o(0.026, -0.020), // Dump South
      o(0.018, -0.022),
      o(0.010, -0.018),
      o(-0.002, -0.016),
      o(-0.010, -0.012), // Pit B
      o(-0.012, -0.006),
      o(-0.006, -0.004),
      o(0.005, -0.002),  // Workshop
      o(-0.010, 0.004),
      o(-0.022, 0.010),
      o(-0.034, 0.014),
      o(-0.040, 0.012),
    ];

    this.routeCoords = loop;
    this.recomputeRouteDistances();
    this.initTrucks(10);

    (this as any)._mineGeojson = {
      pits: this.fc([
        this.featurePoly(pitA, { name: 'Pit A', kind: 'pit', height: 18 }),
        this.featurePoly(pitB, { name: 'Pit B', kind: 'pit', height: 14 }),
        this.featurePoly(pitC, { name: 'Pit C', kind: 'pit', height: 16 }),
      ]),
      dumps: this.fc([
        this.featurePoly(dumpNorth, { name: 'Dump North', kind: 'dump', height: 10 }),
        this.featurePoly(dumpSouth, { name: 'Dump South', kind: 'dump', height: 12 }),
      ]),
      infra: this.fc(infra.map(p => this.featurePoint(p.coord, { name: p.name, kind: p.kind }))),
      route: this.fc([this.featureLine(this.routeCoords, { name: 'Haul Loop' })]),
    };
  }

  private ensureMineSourcesAndLayersExist(): void {
    if (!this.map) return;

    const mine = (this as any)._mineGeojson;
    if (!mine) return;

    this.upsertGeoJsonSource(this.SRC_PITS, mine.pits);
    this.upsertGeoJsonSource(this.SRC_DUMPS, mine.dumps);
    this.upsertGeoJsonSource(this.SRC_INFRA, mine.infra);
    this.upsertGeoJsonSource(this.SRC_ROUTE, mine.route);

    // Route
    if (!this.map.getLayer(this.LYR_ROUTE)) {
      this.map.addLayer({
        id: this.LYR_ROUTE,
        type: 'line',
        source: this.SRC_ROUTE,
        layout: {
          visibility: 'visible',
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-width': 4,
          'line-opacity': 0.9,
        },
      } as any);
    }

    // Pits/Dumps fills
    if (!this.map.getLayer(this.LYR_PITS_FILL)) {
      this.map.addLayer({
        id: this.LYR_PITS_FILL,
        type: 'fill',
        source: this.SRC_PITS,
        layout: { visibility: 'visible' },
        paint: { 'fill-opacity': 0.28 },
      } as any);
    }

    if (!this.map.getLayer(this.LYR_DUMPS_FILL)) {
      this.map.addLayer({
        id: this.LYR_DUMPS_FILL,
        type: 'fill',
        source: this.SRC_DUMPS,
        layout: { visibility: 'visible' },
        paint: { 'fill-opacity': 0.22 },
      } as any);
    }

    // 3D extrusions (visibility controlled by pits3d)
    if (!this.map.getLayer(this.LYR_PITS_3D)) {
      this.map.addLayer({
        id: this.LYR_PITS_3D,
        type: 'fill-extrusion',
        source: this.SRC_PITS,
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.55,
        },
      } as any);
    }

    if (!this.map.getLayer(this.LYR_DUMPS_3D)) {
      this.map.addLayer({
        id: this.LYR_DUMPS_3D,
        type: 'fill-extrusion',
        source: this.SRC_DUMPS,
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-opacity': 0.5,
        },
      } as any);
    }

    // Infrastructure points
    if (!this.map.getLayer(this.LYR_INFRA)) {
      this.map.addLayer({
        id: this.LYR_INFRA,
        type: 'circle',
        source: this.SRC_INFRA,
        layout: { visibility: 'visible' },
        paint: {
          'circle-radius': 6,
          'circle-opacity': 0.9,
        },
      } as any);
    }

    // Infrastructure labels (we’ll force paint via applyLabelAndMarkerStyles())
    if (!this.map.getLayer(this.LYR_INFRA_LABELS)) {
      this.map.addLayer({
        id: this.LYR_INFRA_LABELS,
        type: 'symbol',
        source: this.SRC_INFRA,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'name'],
          'text-size': 13,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
        },
        paint: {
          'text-opacity': 1,
        },
      } as any);
    }
  }

  private applyRouteState(): void {
    if (!this.map) return;
    this.toggleVisibility(this.LYR_ROUTE, this.layers.haul);
  }

  private applyPitDump3DState(): void {
    if (!this.map) return;
    const show3d = this.layers.pits3d;
    this.toggleVisibility(this.LYR_PITS_3D, show3d);
    this.toggleVisibility(this.LYR_DUMPS_3D, show3d);
  }

  private upsertGeoJsonSource(id: string, data: any): void {
    if (!this.map) return;

    if (!this.map.getSource(id)) {
      this.map.addSource(id, { type: 'geojson', data } as any);
    } else {
      const s = this.map.getSource(id) as any;
      if (s?.setData) s.setData(data);
    }
  }

  // -----------------------------------------
  // Trucks (with FAULT coloring)
  // -----------------------------------------
  private initTrucks(count: number): void {
    this.trucks = [];
    if (this.routeLenM <= 0) return;

    for (let i = 0; i < count; i++) {
      const frac = i / count;
      const progressM = frac * this.routeLenM;
      const speedMps = 6.5 + (i % 5) * 1.2;

      this.trucks.push({
        id: `T-${String(i + 1).padStart(2, '0')}`,
        progressM,
        speedMps,
        mode: 'HAULING',
        dwellLeftS: 0,
        lastHeadingDeg: 0,
      });
    }
  }

  private ensureTruckSourceAndLayersExist(): void {
    if (!this.map) return;

    if (!this.map.getSource(this.SRC_TRUCKS)) {
      this.map.addSource(this.SRC_TRUCKS, {
        type: 'geojson',
        data: this.buildTrucksGeoJson(),
      } as any);
    } else {
      (this.map.getSource(this.SRC_TRUCKS) as any).setData(this.buildTrucksGeoJson());
    }

    // Truck circles (we’ll force paint via applyLabelAndMarkerStyles())
    if (!this.map.getLayer(this.LYR_TRUCKS)) {
      this.map.addLayer({
        id: this.LYR_TRUCKS,
        type: 'circle',
        source: this.SRC_TRUCKS,
        layout: { visibility: 'visible' },
        paint: {
          'circle-radius': 6,
          'circle-opacity': 0.95,
        },
      } as any);
    }

    // Truck labels (we’ll force paint via applyLabelAndMarkerStyles())
    if (!this.map.getLayer(this.LYR_TRUCKS_LABELS)) {
      this.map.addLayer({
        id: this.LYR_TRUCKS_LABELS,
        type: 'symbol',
        source: this.SRC_TRUCKS,
        layout: {
          visibility: 'visible',
          'text-field': ['get', 'label'],
          'text-size': 13,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
        },
        paint: {
          'text-opacity': 1,
        },
      } as any);
    }
  }

  private applyTrucksState(): void {
    if (!this.map) return;

    const visible = this.layers.trucks;
    this.toggleVisibility(this.LYR_TRUCKS, visible);
    this.toggleVisibility(this.LYR_TRUCKS_LABELS, visible);

    if (visible) this.startAnimation();
    else this.stopAnimation();
  }

  private startAnimation(): void {
    if (this.animationHandle != null) return;

    this.lastTickMs = performance.now();

    const tick = (now: number) => {
      this.animationHandle = requestAnimationFrame(tick);
      if (!this.layers.trucks) return;

      const dtS = Math.min(0.1, Math.max(0, (now - this.lastTickMs) / 1000));
      this.lastTickMs = now;

      this.stepSimulation(dtS);
      this.pushTruckGeoJson();

      // keep styles enforced (cheap) in case of HMR / style reload quirks
      this.applyLabelAndMarkerStyles();
    };

    this.animationHandle = requestAnimationFrame(tick);
  }

  private stopAnimation(): void {
    if (this.animationHandle != null) {
      cancelAnimationFrame(this.animationHandle);
      this.animationHandle = null;
    }
  }

  private stepSimulation(dtS: number): void {
    if (this.routeLenM <= 0) return;

    const statusById = this.getFleetStatusById();

    for (const t of this.trucks) {
      const fleetStatus = statusById.get(t.id);

      // If operator sets FAULT/PAUSED from Fleet UI, freeze this truck in place
      if (fleetStatus === 'FAULT' || fleetStatus === 'PAUSED') {
        t.mode = 'IDLE';
        t.dwellLeftS = 0;
        t.targetStop = undefined;
        continue;
      }

      if (t.dwellLeftS > 0) {
        t.dwellLeftS = Math.max(0, t.dwellLeftS - dtS);
        t.mode = t.targetStop === 'PIT' ? 'LOADING' : 'DUMPING';
        if (t.dwellLeftS === 0) {
          t.mode = 'HAULING';
          t.targetStop = undefined;
        }
        continue;
      }

      t.mode = 'HAULING';
      t.progressM = (t.progressM + t.speedMps * dtS) % this.routeLenM;

      const pos = this.sampleRoutePosition(t.progressM);

      const nearPit = this.findStopNear(pos, this.pitStops);
      if (nearPit) {
        t.dwellLeftS = this.randBetween(nearPit.dwellS[0], nearPit.dwellS[1]);
        t.targetStop = 'PIT';
        continue;
      }

      const nearDump = this.findStopNear(pos, this.dumpStops);
      if (nearDump) {
        t.dwellLeftS = this.randBetween(nearDump.dwellS[0], nearDump.dwellS[1]);
        t.targetStop = 'DUMP';
        continue;
      }
    }
  }

  // ✅ Supports fleet rows that use `status` OR `state` OR `mode`
  private getFleetStatusById(): Map<string, string> {
    const m = new Map<string, string>();
    try {
      const list = this.fleet.vehicles() as any[];
      for (const v of list) {
        const raw = v.status ?? v.state ?? v.mode ?? 'HAULING';
        m.set(v.id, String(raw).toUpperCase());
      }
    } catch {
      // ignore
    }
    return m;
  }

  private findStopNear(
    pos: LngLat,
    stops: { name: string; center: LngLat; radiusM: number; dwellS: [number, number] }[]
  ) {
    for (const s of stops) {
      const d = this.haversineM(pos, s.center);
      if (d <= s.radiusM) return s;
    }
    return null;
  }

  private pushTruckGeoJson(): void {
    if (!this.map) return;
    const src = this.map.getSource(this.SRC_TRUCKS) as any;
    if (src?.setData) src.setData(this.buildTrucksGeoJson());
  }

  private buildTrucksGeoJson(): any {
    const statusById = this.getFleetStatusById();

    const features = this.trucks.map((t) => {
      const status = statusById.get(t.id) ?? 'HAULING';
      const isFault = status === 'FAULT';
      const isPaused = status === 'PAUSED';

      const p = this.sampleRoutePosition(t.progressM);
      const heading = this.sampleHeadingDeg(t.progressM);
      t.lastHeadingDeg = heading;

      const modeLabel = isFault ? 'FAULT' : isPaused ? 'PAUSED' : t.mode;
      const label = `${t.id} (${modeLabel})`;

      const speedKph = isFault || isPaused ? 0 : Math.round(t.speedMps * 3.6);

      return this.featurePoint(p, {
        id: t.id,
        label,
        status, // ✅ used by paint expressions
        speedKph,
        headingDeg: Math.round(heading),
      });
    });

    return this.fc(features);
  }

  // -----------------------------------------
  // ✅ FORCE styles so colors ALWAYS apply
  //   🚛 trucks blue, ⚠ fault red, 🏗 infra amber
  // -----------------------------------------
  private applyLabelAndMarkerStyles(): void {
    if (!this.map) return;

    // 🏗 Infra labels = amber
    if (this.map.getLayer(this.LYR_INFRA_LABELS)) {
      this.map.setPaintProperty(this.LYR_INFRA_LABELS, 'text-color', '#f59e0b');
      this.map.setPaintProperty(this.LYR_INFRA_LABELS, 'text-opacity', 0.98);
      this.map.setPaintProperty(this.LYR_INFRA_LABELS, 'text-halo-color', 'rgba(0,0,0,0.85)');
      this.map.setPaintProperty(this.LYR_INFRA_LABELS, 'text-halo-width', 1.8);
      this.map.setPaintProperty(this.LYR_INFRA_LABELS, 'text-halo-blur', 0.5);
    }

    // 🚛 Truck circles = blue, fault = red
    if (this.map.getLayer(this.LYR_TRUCKS)) {
      this.map.setPaintProperty(this.LYR_TRUCKS, 'circle-color', [
        'case',
        ['==', ['get', 'status'], 'FAULT'],
        '#ef4444', // red
        '#60a5fa', // blue
      ]);
      this.map.setPaintProperty(this.LYR_TRUCKS, 'circle-stroke-width', 1.2);
      this.map.setPaintProperty(this.LYR_TRUCKS, 'circle-stroke-color', 'rgba(0,0,0,0.55)');
    }

    // 🚛 Truck labels = blue, fault = red
    if (this.map.getLayer(this.LYR_TRUCKS_LABELS)) {
      this.map.setPaintProperty(this.LYR_TRUCKS_LABELS, 'text-color', [
        'case',
        ['==', ['get', 'status'], 'FAULT'],
        '#ef4444', // red
        '#60a5fa', // blue
      ]);
      this.map.setPaintProperty(this.LYR_TRUCKS_LABELS, 'text-opacity', 0.99);
      this.map.setPaintProperty(this.LYR_TRUCKS_LABELS, 'text-halo-color', 'rgba(0,0,0,0.9)');
      this.map.setPaintProperty(this.LYR_TRUCKS_LABELS, 'text-halo-width', 2.0);
      this.map.setPaintProperty(this.LYR_TRUCKS_LABELS, 'text-halo-blur', 0.6);
    }
  }

  // -----------------------------------------
  // Map interactions
  // -----------------------------------------
  private attachInteractions(): void {
    if (!this.map) return;

    this.map.on('click', this.LYR_TRUCKS, (e: any) => {
      const f = e?.features?.[0];
      if (!f) return;

      const props = f.properties || {};
      const lngLat = e.lngLat;

      const html = `
        <div style="font-weight:700;margin-bottom:6px;">Truck ${props.id ?? ''}</div>
        <div><b>Status:</b> ${props.status ?? ''}</div>
        <div><b>Speed:</b> ${props.speedKph ?? ''} km/h</div>
        <div><b>Heading:</b> ${props.headingDeg ?? ''}°</div>
      `;

      new maplibregl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(this.map);
    });

    this.map.on('mouseenter', this.LYR_TRUCKS, () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });

    this.map.on('mouseleave', this.LYR_TRUCKS, () => {
      this.map.getCanvas().style.cursor = '';
    });
  }

  // -----------------------------------------
  // Route sampling
  // -----------------------------------------
  private recomputeRouteDistances(): void {
    this.routeCumDistM = [];
    this.routeLenM = 0;

    if (this.routeCoords.length < 2) return;

    this.routeCumDistM.push(0);
    for (let i = 1; i < this.routeCoords.length; i++) {
      const seg = this.haversineM(this.routeCoords[i - 1], this.routeCoords[i]);
      this.routeLenM += seg;
      this.routeCumDistM.push(this.routeLenM);
    }
  }

  private sampleRoutePosition(progressM: number): LngLat {
    const coords = this.routeCoords;
    const cum = this.routeCumDistM;

    if (coords.length < 2 || this.routeLenM <= 0) return coords[0] ?? [0, 0];

    let i = 1;
    while (i < cum.length && cum[i] < progressM) i++;

    if (i >= cum.length) return coords[coords.length - 1];

    const prevD = cum[i - 1];
    const nextD = cum[i];
    const t = nextD === prevD ? 0 : (progressM - prevD) / (nextD - prevD);

    const a = coords[i - 1];
    const b = coords[i];

    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  private sampleHeadingDeg(progressM: number): number {
    const ahead = (progressM + 8) % Math.max(1, this.routeLenM);
    const p1 = this.sampleRoutePosition(progressM);
    const p2 = this.sampleRoutePosition(ahead);

    const dy = p2[1] - p1[1];
    const dx = p2[0] - p1[0];
    const rad = Math.atan2(dy, dx);
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }

  // -----------------------------------------
  // Geo helpers
  // -----------------------------------------
  private fc(features: any[]) {
    return { type: 'FeatureCollection', features };
  }

  private featurePoint(coord: LngLat, properties: Record<string, any>) {
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coord },
      properties,
    };
  }

  private featureLine(coords: LngLat[], properties: Record<string, any>) {
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties,
    };
  }

  private featurePoly(coords: LngLat[], properties: Record<string, any>) {
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties,
    };
  }

  private toggleVisibility(layerId: string, visible: boolean): void {
    if (!this.map || !this.map.getLayer(layerId)) return;
    this.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  }

  private makeOvalPolygon(center: LngLat, rx: number, ry: number, steps: number): LngLat[] {
    const [cx, cy] = center;
    const pts: LngLat[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  }

  private makePadPolygon(center: LngLat, w: number, h: number, steps: number): LngLat[] {
    const [cx, cy] = center;
    const pts: LngLat[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const x = Math.sign(ca) * Math.pow(Math.abs(ca), 0.7) * (w / 2);
      const y = Math.sign(sa) * Math.pow(Math.abs(sa), 0.7) * (h / 2);
      pts.push([cx + x, cy + y]);
    }
    return pts;
  }

  private haversineM(a: LngLat, b: LngLat): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;

    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);

    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLon / 2);

    const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  private randBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
