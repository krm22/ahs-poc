import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal,
  effect,
} from '@angular/core';

import maplibregl, { Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
import { FleetStateService, FleetVehicle } from '../../core/services/fleet-state.service';

type LatLng = { lat: number; lng: number };

type MapViewVehicle = {
  id: string;
  status: string;
  speedKph: number;
  headingDeg: number;
  payloadTons: number;
  fuelPct: number;
  healthPct: number;
  position: LatLng;
};

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private readonly fleet = inject(FleetStateService);
  @ViewChild('mapContainer') private mapContainer?: ElementRef<HTMLDivElement>;

  private map?: MlMap;
  private markers = new globalThis.Map<string, MlMarker>();

  readonly selectedVehicle = signal<MapViewVehicle | null>(null);

  // per-vehicle sim state
  private sim = new globalThis.Map<string, { pos: LatLng; headingDeg: number; healthPct: number }>();

  // stable ticking (so trucks move/rotate even if Angular isn’t re-rendering)
  private tick = signal(0);
  private timer?: number;

  // ---- Pilbara open-cut defaults (pick any Pilbara-ish center; easy to swap later) ----
  private readonly siteCenter: [number, number] = [119.73, -23.36]; // [lng, lat] (Pilbara region)
  private readonly siteHalfSizeMeters = 6000; // ~12km x 12km

  private readonly siteBounds = this.boundsFromCenterMeters(
    this.siteCenter,
    this.siteHalfSizeMeters,
    this.siteHalfSizeMeters
  ); // [west, south, east, north]

  constructor() {
    effect(() => {
      // drive updates from our tick + fleet signal
      this.tick();
      const list = this.vehicles();
      if (this.map) this.syncMarkers(list);
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.initMapSafely());
  }

  vehicles(): MapViewVehicle[] {
    return this.fleet.vehicles().map((v) => this.toMapView(v));
  }

  clearSelection(): void {
    this.selectedVehicle.set(null);
  }

  private initMapSafely(): void {
    const el = this.mapContainer?.nativeElement;
    if (!el) {
      console.warn('[MapComponent] mapContainer missing. Check template #mapContainer.');
      return;
    }
    if (this.map) return;

    this.map = new maplibregl.Map({
      container: el,
      style: 'https://demotiles.maplibre.org/style.json',
      center: this.siteCenter,
      zoom: 14.5,
      maxBounds: this.siteBounds,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    this.map.on('load', () => {
      this.map?.resize();

      // start by fitting to the “mine site”
      this.map?.fitBounds(this.siteBounds, { padding: 40, maxZoom: 16.5 });

      // render once
      this.syncMarkers(this.vehicles());

      // tick at 5Hz
      this.timer = window.setInterval(() => this.tick.set(this.tick() + 1), 200);
    });
  }

  private toMapView(v: FleetVehicle): MapViewVehicle {
    const id = v.id;

    // init sim state once per vehicle, spawn inside site
    if (!this.sim.has(id)) {
      const n = this.hash01(id);
      const m = this.hash01(id + '#2');

      const spawn = this.jitterMetersToLngLat(
        { lng: this.siteCenter[0], lat: this.siteCenter[1] },
        2500, // cluster within ~2.5km of center
        n,
        m
      );

      this.sim.set(id, {
        pos: spawn,
        headingDeg: Math.floor(this.hash01(id + '#3') * 360),
        healthPct: 92 + this.hash01(id + '#4') * 6,
      });
    }

    const state = this.sim.get(id)!;

    const speedKph = v.telemetry.speedKph;
    const status = String(v.status || '').toUpperCase();

    // heading drift (more movement while hauling/returning)
    const turnRate = status === 'HAULING' ? 2.6 : status === 'RETURNING' ? 2.0 : 0.8;
    state.headingDeg = (state.headingDeg + turnRate) % 360;

    // move only when active
    const active = status !== 'IDLE' && status !== 'PAUSED' && status !== 'FAULT';

    if (active) {
      const tickSeconds = 0.2; // matches 200ms timer
      const metersPerTick = (speedKph * 1000) / 3600 * tickSeconds;

      const rad = (state.headingDeg * Math.PI) / 180;
      const dNorth = Math.cos(rad) * metersPerTick;
      const dEast = Math.sin(rad) * metersPerTick;

      const next = this.offsetMeters(state.pos, dEast, dNorth);

      // keep inside bounds
      const bounced = this.bounceWithinBounds(next, state.headingDeg);
      state.pos = bounced.pos;
      state.headingDeg = bounced.headingDeg;
    }

    // health gently decays
    state.healthPct = Math.max(50, Math.min(100, state.healthPct + (status === 'FAULT' ? -0.2 : -0.02)));

    return {
      id: v.id,
      status: v.status,
      speedKph: v.telemetry.speedKph,
      headingDeg: Math.round(state.headingDeg),
      payloadTons: v.telemetry.payloadTons,
      fuelPct: v.telemetry.fuelPct,
      healthPct: state.healthPct,
      position: state.pos,
    };
  }

  private syncMarkers(list: MapViewVehicle[]): void {
    const map = this.map;
    if (!map) return;

    const ids = new Set<string>(list.map((v) => v.id));

    // remove stale
    for (const [id, marker] of this.markers.entries()) {
      if (!ids.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }

    // upsert
    for (const v of list) {
      const lng = v.position.lng;
      const lat = v.position.lat;

      let marker = this.markers.get(v.id);

      if (!marker) {
        const node = document.createElement('div');
        node.className = `truck-marker ${String(v.status || '').toLowerCase()}`;
        node.title = `${v.id} • ${v.status}`;
        node.style.setProperty('--hdg', `${v.headingDeg}deg`);

        node.addEventListener('click', () => this.selectedVehicle.set(v));

        marker = new maplibregl.Marker({ element: node })
          .setLngLat([lng, lat])
          .addTo(map);

        this.markers.set(v.id, marker);
      } else {
        // IMPORTANT: update class + heading every tick (your old code didn’t)
        const el = marker.getElement() as HTMLDivElement;
        el.className = `truck-marker ${String(v.status || '').toLowerCase()}`;
        el.title = `${v.id} • ${v.status}`;
        el.style.setProperty('--hdg', `${v.headingDeg}deg`);
        marker.setLngLat([lng, lat]);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }

    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();

    this.map?.remove();
    this.map = undefined;
  }

  // ---------------- helpers ----------------

  private boundsFromCenterMeters(
    centerLngLat: [number, number],
    halfWidthM: number,
    halfHeightM: number
  ): [number, number, number, number] {
    const [lng, lat] = centerLngLat;

    const south = lat - halfHeightM / 111_320;
    const north = lat + halfHeightM / 111_320;

    const metersPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
    const west = lng - halfWidthM / metersPerDegLng;
    const east = lng + halfWidthM / metersPerDegLng;

    return [west, south, east, north];
  }

  private offsetMeters(pos: LatLng, eastM: number, northM: number): LatLng {
    const dLat = northM / 111_320;
    const metersPerDegLng = 111_320 * Math.cos((pos.lat * Math.PI) / 180);
    const dLng = eastM / metersPerDegLng;
    return { lat: pos.lat + dLat, lng: pos.lng + dLng };
  }

  private jitterMetersToLngLat(center: LatLng, maxMeters: number, a: number, b: number): LatLng {
    const x = (a - 0.5) * 2; // -1..1
    const y = (b - 0.5) * 2;

    const east = x * maxMeters;
    const north = y * maxMeters;

    return this.offsetMeters(center, east, north);
  }

  private bounceWithinBounds(next: LatLng, headingDeg: number): { pos: LatLng; headingDeg: number } {
    const [west, south, east, north] = this.siteBounds;
    let hdg = headingDeg;
    let pos = next;

    if (pos.lng < west) { pos = { ...pos, lng: west }; hdg = (360 - hdg) % 360; }
    else if (pos.lng > east) { pos = { ...pos, lng: east }; hdg = (360 - hdg) % 360; }

    if (pos.lat < south) { pos = { ...pos, lat: south }; hdg = (180 - hdg + 360) % 360; }
    else if (pos.lat > north) { pos = { ...pos, lat: north }; hdg = (180 - hdg + 360) % 360; }

    return { pos, headingDeg: hdg };
  }

  private hash01(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10_000) / 10_000;
  }
}
