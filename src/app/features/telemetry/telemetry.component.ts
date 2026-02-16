import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { MockFleetService } from '../../core/services/mock-fleet.service';

@Component({
  selector: 'app-telemetry',
  standalone: true,
  imports: [NgFor],
  templateUrl: './telemetry.component.html',
  styleUrl: './telemetry.component.css',
})
export class TelemetryComponent {
  constructor(private fleet: MockFleetService) {}

  get vehicles() {
    return this.fleet.list();
  }
}
