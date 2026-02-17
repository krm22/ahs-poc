import { Injectable, computed, signal } from '@angular/core';

/**
 * Job queued for a shovel/loader interaction.
 * Keep this flexible — payload can carry anything you need.
 */
export interface ShovelJob {
  vehicleId: string;
  payload?: unknown;
  createdAt: number;
}

/**
 * Queue "slots" is a simple capacity concept for UI.
 * Adjust DEFAULT_CAPACITY to whatever you want.
 */
export interface QueueSlots {
  capacity: number;
  used: number;
  free: number;
}

@Injectable({ providedIn: 'root' })
export class ShovelQueueService {
  private static readonly DEFAULT_CAPACITY = 3;

  private readonly _queue = signal<ShovelJob[]>([]);
  private readonly _capacity = signal<number>(ShovelQueueService.DEFAULT_CAPACITY);

  /** Read-only views */
  readonly queue = this._queue.asReadonly(); // ShovelJob[]
  readonly capacity = this._capacity.asReadonly(); // number

  /** Derived views for UI */
  readonly count = computed(() => this._queue().length);
  readonly next = computed(() => this._queue()[0] ?? null);

  /** What Command UI actually wants most of the time */
  readonly queueVehicleIds = computed<string[]>(() => this._queue().map((j) => j.vehicleId));
  readonly active = computed<string | null>(() => this.next()?.vehicleId ?? null);

  readonly slots = computed<QueueSlots>(() => {
    const used = this._queue().length;
    const capacity = this._capacity();
    return {
      capacity,
      used,
      free: Math.max(0, capacity - used),
    };
  });

  /**
   * IMPORTANT:
   * If enqueue() is called during template render via an accidental side-effect chain,
   * Angular can throw NG0600 (writing to signals while rendering).
   * We defensively defer signal writes to a microtask.
   */
  enqueue(job: ShovelJob): void {
    queueMicrotask(() => {
      this._queue.update((q) => [...q, job]);
    });
  }

  enqueueMany(jobs: ShovelJob[]): void {
    if (!jobs.length) return;
    queueMicrotask(() => {
      this._queue.update((q) => q.concat(jobs));
    });
  }

  dequeue(): ShovelJob | null {
    const current = this._queue();
    if (!current.length) return null;

    const first = current[0]!;
    queueMicrotask(() => {
      this._queue.update((q) => q.slice(1));
    });

    return first;
  }

  clear(): void {
    queueMicrotask(() => {
      this._queue.set([]);
    });
  }

  /**
   * Move a vehicle's first queued job to the back.
   * Used by Command UI "BUMP FRONT".
   */
  bumpToBack(vehicleId: string): void {
    queueMicrotask(() => {
      const q = this._queue();
      const idx = q.findIndex((j) => j.vehicleId === vehicleId);
      if (idx < 0) return;

      const job = q[idx]!;
      const next = q.slice(0, idx).concat(q.slice(idx + 1)).concat(job);
      this._queue.set(next);
    });
  }

  /** Optional: allow UI to configure capacity */
  setCapacity(capacity: number): void {
    const c = Math.max(1, Math.floor(capacity));
    queueMicrotask(() => this._capacity.set(c));
  }
}
