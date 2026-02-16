import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import maplibregl from 'maplibre-gl';
import { FleetStateService, FleetVehicle } from '../../core/services/fleet-state.service';

type MapVehicleVM = {
  id: string;
  status: string;
  speedKph: number;
  headingDeg: number;
  payloadTons: number;
  fuelPct: number;
  healthPct: number;
  position: { lat: number; lng: number };
};

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})
export class MapComponent implements AfterViewInit {
  @ViewChild('mapEl', { static: true })
  mapEl!: ElementRef<HTMLDivElement>;

  private fleet = inject(FleetStateService);

  readonly vehicles = computed(() => this.fleet.vehicles());

  private readonly selectedVehicleId = signal<string | null>(null);

  readonly selectedVehicle = computed<MapVehicleVM | null>(() => {
    const id = this.selectedVehicleId();
    if (!id) return null;

    const v = this.fleet.vehicles().find((x: FleetVehicle) => x.id === id);
    if (!v) return null;

    const heading = pseudoHeadingFromId(v.id);
    const health = pseudoHealth(v.telemetry.fuelPct, v.status);

    const baseLat = -23.698;
    const baseLng = 133.88;
    const jitter = pseudoJitter(v.id);

    return {
      id: v.id,
      status: v.status,
      speedKph: v.telemetry.speedKph,
      headingDeg: heading,
      payloadTons: v.telemetry.payloadTons,
      fuelPct: v.telemetry.fuelPct,
      healthPct: health,
      position: {
        lat: baseLat + jitter.lat,
        lng: baseLng + jitter.lng,
      },
    };
  });

  private map: maplibregl.Map | null = null;

  ngAfterViewInit() {
    this.map = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [133.88, -23.698],
      zoom: 11,
      attributionControl: { compact: true },
    });

    const first = this.fleet.vehicles()[0]?.id ?? null;
    this.selectedVehicleId.set(first);
  }

  clearSelection() {
    this.selectedVehicleId.set(null);
  }

  selectVehicle(id: string) {
    this.selectedVehicleId.set(id);
  }
}

function pseudoHeadingFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function pseudoHealth(fuelPct: number, status: string): number {
  if (status === 'FAULT') return 10;
  if (status === 'PAUSED') return 60;
  return Math.max(30, Math.min(100, fuelPct + 15));
}

function pseudoJitter(id: string): { lat: number; lng: number } {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  const a = (n % 100) / 1000;
  const b = ((n * 7) % 100) / 1000;
  return { lat: a * 0.1, lng: b * 0.1 };
}
