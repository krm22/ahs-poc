import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FleetStateService, FleetVehicle } from '../../core/services/fleet-state.service';

@Component({
  selector: 'app-fleet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fleet.component.html',
  styleUrls: ['./fleet.component.css'],
})
export class FleetComponent {
  private fleet = inject(FleetStateService);

  readonly vehicles = computed(() =>
    this.fleet.vehicles().map((v: FleetVehicle) => ({
      ...v,
      state: v.status, // template expects v.state
      speedMps: (v.telemetry.speedKph / 3.6).toFixed(1),
      payloadT: v.telemetry.payloadTons.toFixed(1),
      fuelPct: v.telemetry.fuelPct.toFixed(1),
      updatedAtIso: new Date(v.lastUpdateIso),
    })),
  );

  // Template uses pause/resume/fault/clearFault
  pause(id: string) {
    this.fleet.pauseVehicle(id);
  }

  resume(id: string) {
    this.fleet.resumeVehicle(id);
  }

  fault(id: string) {
    this.fleet.raiseFault(id);
  }

  clearFault(id: string) {
    this.fleet.clearFault(id);
  }
}
