import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.css'],
})
export class ShellComponent {
  /**
   * ✅ Static navigation definition.
   * No signals.
   * No async changes.
   * Prevents NG0100 entirely.
   */
  readonly navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Fleet', path: '/fleet' },
    { label: 'Map', path: '/map' },
  ];
}
