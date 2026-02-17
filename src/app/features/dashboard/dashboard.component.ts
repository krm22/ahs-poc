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

    const stopped = vehicles.filter(
      (v: FleetVehicle) => v.status === 'PAUSED' || v.status === 'FAULT'
    ).length;

    const active = vehicles.filter((v: FleetVehicle) =>
      v.status !== 'IDLE' && v.status !== 'PAUSED' && v.status !== 'FAULT'
    ).length;

    const hauling = vehicles.filter((v: FleetVehicle) => v.status === 'HAULING').length;
    const returning = vehicles.filter((v: FleetVehicle) => v.status === 'RETURNING').length;
    const refuel = vehicles.filter((v: FleetVehicle) => v.status === 'REFUEL').length;
    const maint = vehicles.filter((v: FleetVehicle) => v.status === 'MAINT').length;

    return {
      total: vehicles.length,
      active,
      hauling,
      returning,
      refuel,
      maint,
      stopped,
    };
  });

  ngOnInit(): void {
    this.fleet.startSimulation();
  }
}
