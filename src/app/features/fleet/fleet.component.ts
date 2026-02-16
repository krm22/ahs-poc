import { Component } from '@angular/core';
import { DatePipe, NgFor } from '@angular/common';
import { MockFleetService, Vehicle } from '../../core/services/mock-fleet.service';

@Component({
  selector: 'app-fleet',
  standalone: true,
  imports: [NgFor, DatePipe],
  templateUrl: './fleet.component.html',
  styleUrl: './fleet.component.css',
})
export class FleetComponent {
  vehicles: Vehicle[];

  constructor(fleet: MockFleetService) {
    this.vehicles = fleet.list();
  }
}
