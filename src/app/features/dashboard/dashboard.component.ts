import { Component } from '@angular/core';
import { TelemetryComponent } from '../telemetry/telemetry.component';
import { CommandComponent } from '../command/command.component';
import { MockFleetService } from '../../core/services/mock-fleet.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TelemetryComponent, CommandComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  constructor(private fleet: MockFleetService) {}

  get totals() {
    const vehicles = this.fleet.list();
    const active = vehicles.filter(v => v.state !== 'IDLE').length;
    const hauling = vehicles.filter(v => v.state === 'HAULING').length;
    const stopped = vehicles.filter(v => v.state === 'STOPPED').length;
    return { total: vehicles.length, active, hauling, stopped };
  }
}
