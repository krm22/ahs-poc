import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FleetStateService } from '../../core/services/fleet-state.service';
import { ShovelQueueService } from '../../core/services/shovel-queue.service';

type Target = { kind: 'ALL' } | { kind: 'ONE'; id: string };

@Component({
  selector: 'app-command',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './command.component.html',
  styleUrls: ['./command.component.css'],
})
export class CommandComponent {
  private readonly fleet = inject(FleetStateService);
  private readonly queue = inject(ShovelQueueService);

  /** Vehicles from fleet */
  readonly ids = computed(() => this.fleet.vehicleIds());

  /** Queue views (match the updated ShovelQueueService API) */
  readonly queueIds = this.queue.queueVehicleIds; // string[]
  readonly activeLoader = this.queue.active; // string | null (active vehicle at front)
  readonly slots = this.queue.slots; // {capacity, used, free}

  /** UI state */
  readonly targetId = signal<string>('ALL');
  readonly lastAction = signal<string>('None');

  readonly target = computed<Target>(() => {
    const v = this.targetId();
    return v === 'ALL' ? { kind: 'ALL' } : { kind: 'ONE', id: v };
  });

  onTargetChange(ev: Event): void {
    const el = ev.target as HTMLSelectElement | null;
    this.targetId.set(el?.value ?? 'ALL');
  }

  dispatch(): void {
    const t = this.target();
    if (t.kind === 'ALL') {
      for (const id of this.ids()) this.fleet.dispatchVehicle(id);
      this.setLast(`DISPATCH → ALL`);
    } else {
      this.fleet.dispatchVehicle(t.id);
      this.setLast(`DISPATCH → ${t.id}`);
    }
  }

  sendToFuel(): void {
    const t = this.target();
    if (t.kind === 'ALL') {
      for (const id of this.ids()) this.fleet.sendToFuel(id);
      this.setLast(`SEND TO FUEL → ALL`);
    } else {
      this.fleet.sendToFuel(t.id);
      this.setLast(`SEND TO FUEL → ${t.id}`);
    }
  }

  sendToMaint(): void {
    const t = this.target();
    if (t.kind === 'ALL') {
      for (const id of this.ids()) this.fleet.sendToMaint(id);
      this.setLast(`SEND TO MAINT → ALL`);
    } else {
      this.fleet.sendToMaint(t.id);
      this.setLast(`SEND TO MAINT → ${t.id}`);
    }
  }

  pause(): void {
    const t = this.target();
    if (t.kind === 'ALL') {
      this.fleet.stopAll();
      this.setLast(`PAUSE → ALL`);
    } else {
      this.fleet.pauseVehicle(t.id);
      this.setLast(`PAUSE → ${t.id}`);
    }
  }

  resume(): void {
    const t = this.target();
    if (t.kind === 'ALL') {
      this.fleet.resumeAll();
      this.setLast(`RESUME → ALL`);
    } else {
      this.fleet.resumeVehicle(t.id);
      this.setLast(`RESUME → ${t.id}`);
    }
  }

  raiseFault(): void {
    const t = this.target();
    if (t.kind === 'ALL') {
      for (const id of this.ids()) this.fleet.raiseFault(id);
      this.setLast(`FAULT → ALL`);
    } else {
      this.fleet.raiseFault(t.id);
      this.setLast(`FAULT → ${t.id}`);
    }
  }

  clearFault(): void {
    const t = this.target();
    if (t.kind === 'ALL') {
      for (const id of this.ids()) this.fleet.clearFault(id);
      this.setLast(`CLEAR FAULT → ALL`);
    } else {
      this.fleet.clearFault(t.id);
      this.setLast(`CLEAR FAULT → ${t.id}`);
    }
  }

  bumpFront(): void {
    const front = this.queueIds()[0] ?? null;
    if (!front) return;

    this.queue.bumpToBack(front);
    this.setLast(`BUMP FRONT → ${front}`);
  }

  private setLast(msg: string): void {
    this.lastAction.set(`${msg} @ ${new Date().toLocaleTimeString()}`);
  }
}
