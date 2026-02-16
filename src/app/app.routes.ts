import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { FleetComponent } from './features/fleet/fleet.component';
import { MapComponent } from './features/map/map.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', component: DashboardComponent },
      { path: 'fleet', component: FleetComponent },
      { path: 'map', component: MapComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
