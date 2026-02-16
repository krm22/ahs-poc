import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      // Default route
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      // Lazy feature routes (standalone components)
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'fleet',
        loadComponent: () =>
          import('./features/fleet/fleet.component').then((m) => m.FleetComponent),
      },
      {
        path: 'map',
        loadComponent: () =>
          import('./features/map/map.component').then((m) => m.MapComponent),
      },
      {
        path: 'telemetry',
        loadComponent: () =>
          import('./features/telemetry/telemetry.component').then(
            (m) => m.TelemetryComponent
          ),
      },
      {
        path: 'command',
        loadComponent: () =>
          import('./features/command/command.component').then(
            (m) => m.CommandComponent
          ),
      },
    ],
  },

  // Fallback
  { path: '**', redirectTo: '' },
];
