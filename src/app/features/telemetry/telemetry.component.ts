// src/app/features/telemetry/telemetry.component.ts
import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FleetStateService } from '../../core/services/fleet-state.service';

@Component({
  selector: 'app-telemetry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './telemetry.component.html',
  styleUrls: ['./telemetry.component.css'],
})
export class TelemetryComponent {
  private readonly fleet = inject(FleetStateService);

  readonly vehicleIds = computed(() => this.fleet.vehicleIds());
  readonly selectedVehicleId = signal<string>('');
  readonly showTelemetry = signal(true);
  readonly showEvents = signal(true);

  constructor() {
    const ids = this.fleet.vehicleIds();
    this.selectedVehicleId.set(ids[0] ?? '');
  }

  // called by template
  onVehicleChange(ev: Event) {
    const target = ev.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    this.selectedVehicleId.set(value);
  }

  onShowTelemetryChange(ev: Event) {
    const target = ev.target as HTMLInputElement | null;
    this.showTelemetry.set(!!target?.checked);
  }

  onShowEventsChange(ev: Event) {
    const target = ev.target as HTMLInputElement | null;
    this.showEvents.set(!!target?.checked);
  }
}
