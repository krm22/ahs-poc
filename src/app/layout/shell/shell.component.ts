import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FleetStateService } from '../../core/services/fleet-state.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent implements OnInit {
  private readonly fleet = inject(FleetStateService);

  readonly version = 'Phase 0 – Core UI Scaffold';

  ngOnInit(): void {
    this.fleet.startSimulation();
  }
}
