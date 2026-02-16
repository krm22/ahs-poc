import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FleetStateService, FleetVehicle } from '../../core/services/fleet-state.service';
import { TelemetryComponent } from '../telemetry/telemetry.component';
import { CommandComponent } from '../command/command.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TelemetryComponent, CommandComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  private readonly fleet = inject(FleetStateService);

  readonly kpis = this.fleet.kpis;

  // Derived metrics used by template
  readonly totals = computed(() => {
    const vehicles: FleetVehicle[] = this.fleet.vehicles();

    return {
      total: vehicles.length,
      active: vehicles.filter((v: FleetVehicle) => v.status !== 'IDLE').length,
      hauling: vehicles.filter((v: FleetVehicle) => v.status === 'HAULING').length,
      stopped: vehicles.filter(
        (v: FleetVehicle) => v.status === 'PAUSED' || v.status === 'FAULT'
      ).length,
    };
  });

  ngOnInit(): void {
    this.fleet.startSimulation();
  }
}
