// src/app/features/telemetry/telemetry.component.ts
import {
  Component,
  computed,
  effect,
  inject,
  signal,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FleetStateService, FleetVehicle } from '../../core/services/fleet-state.service';

type LogType = 'event' | 'telemetry' | 'alert';

type TelemetryLogRow = {
  tsIso: string;
  id: string;
  type: LogType;
  msg: string;
  meta?: string;
};

@Component({
  selector: 'app-telemetry',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './telemetry.component.html',
  styleUrls: ['./telemetry.component.css'],
})
export class TelemetryComponent implements OnDestroy {
  private readonly fleet = inject(FleetStateService);

  readonly vehicles = computed(() => this.fleet.vehicles());
  readonly vehicleIds = computed(() => this.fleet.vehicleIds());

  readonly selectedVehicleId = signal<string>('');
  readonly showTelemetry = signal(true);
  readonly showEvents = signal(true);
  readonly autoScroll = signal(true);

  // how chatty the panel is
  readonly telemetryEverySec = signal(2); // emit a telemetry row every N seconds
  readonly maxRows = signal(200);

  private readonly rowsSig = signal<TelemetryLogRow[]>([]);
  readonly rows = computed(() => this.rowsSig());

  // selection + view state
  readonly selectedVehicle = computed(() => {
    const id = this.selectedVehicleId();
    return this.vehicles().find(v => v.id === id) ?? null;
  });

  readonly selectionSummary = computed(() => {
    const v = this.selectedVehicle();
    if (!v) return null;

    const t = v.telemetry;
    const alerts: string[] = [];
    if (t.fuelPct <= 20) alerts.push('LOW FUEL');
    if (t.healthPct <= 60) alerts.push('LOW HEALTH');
    if (t.engineTempC >= 105) alerts.push('HIGH TEMP');

    // quick cycle estimate (simple, deterministic “mine realism”)
    const cycleMin = this.estimateCycleMinutes(v);

    return {
      id: v.id,
      status: v.status,
      speedKph: t.speedKph,
      payloadTons: t.payloadTons,
      fuelPct: t.fuelPct,
      engineTempC: t.engineTempC,
      healthPct: t.healthPct,
      alerts,
      cycleMin,
    };
  });

  // fleet-level alerts summary (for the header)
  readonly fleetAlerts = computed(() => {
    const list = this.vehicles();
    const lowFuel = list.filter(v => v.telemetry.fuelPct <= 20 && v.status !== 'PAUSED' && v.status !== 'FAULT').length;
    const lowHealth = list.filter(v => v.telemetry.healthPct <= 60 && v.status !== 'PAUSED' && v.status !== 'FAULT').length;
    const highTemp = list.filter(v => v.telemetry.engineTempC >= 105 && v.status !== 'PAUSED' && v.status !== 'FAULT').length;
    return { lowFuel, lowHealth, highTemp };
  });

  // internal tracking
  private timer?: number;
  private secCounter = 0;
  private lastStatus = new globalThis.Map<string, string>();
  private lastAlertState = new globalThis.Map<string, string>(); // fingerprint of alerts

  constructor() {
    // ensure we always have a selection when IDs exist
    effect(() => {
      const ids = this.vehicleIds();
      const cur = this.selectedVehicleId();

      if (!cur && ids.length > 0) {
        this.selectedVehicleId.set(ids[0]);
      } else if (cur && ids.length > 0 && !ids.includes(cur)) {
        this.selectedVehicleId.set(ids[0]);
      }
    });

    // emit initial “session start”
    this.pushRow({
      id: 'SYSTEM',
      type: 'event',
      msg: 'Telemetry console started',
      meta: 'Listening for status changes, alerts, and telemetry snapshots',
    });

    // start periodic sampling
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  // called by template
  onVehicleChange(ev: Event) {
    const target = ev.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    this.selectedVehicleId.set(value);
  }

  onShowTelemetryChange(ev: Event) {
    const target = ev.target as HTMLInputElement | null;
    this.showTelemetry.set(!!target?.checked);
  }

  onShowEventsChange(ev: Event) {
    const target = ev.target as HTMLInputElement | null;
    this.showEvents.set(!!target?.checked);
  }

  onAutoScrollChange(ev: Event) {
    const target = ev.target as HTMLInputElement | null;
    this.autoScroll.set(!!target?.checked);
  }

  onTelemetryEveryChange(ev: Event) {
    const target = ev.target as HTMLSelectElement | null;
    const v = Number(target?.value ?? 2);
    this.telemetryEverySec.set(Number.isFinite(v) && v >= 1 ? v : 2);
  }

  clearLog() {
    this.rowsSig.set([]);
    this.pushRow({
      id: 'SYSTEM',
      type: 'event',
      msg: 'Log cleared',
    });
  }

  // -------------------------
  // ticking + log logic
  // -------------------------

  private tick(): void {
    this.secCounter++;

    const list = this.vehicles();
    if (!list.length) return;

    // detect phase transitions (events)
    for (const v of list) {
      const prev = this.lastStatus.get(v.id);
      if (prev !== v.status) {
        this.lastStatus.set(v.id, v.status);

        if (this.showEvents()) {
          this.pushRow({
            id: v.id,
            type: 'event',
            msg: `STATUS → ${v.status}`,
            meta: this.formatMeta(v),
          });
        }
      }

      // detect alert state changes (alerts)
      const fp = this.alertFingerprint(v);
      const prevFp = this.lastAlertState.get(v.id);
      if (fp !== prevFp) {
        this.lastAlertState.set(v.id, fp);

        const alerts = this.alertList(v);
        if (alerts.length) {
          this.pushRow({
            id: v.id,
            type: 'alert',
            msg: alerts.join(' • '),
            meta: this.formatMeta(v),
          });
        }
      }
    }

    // telemetry snapshots (controlled rate)
    if (this.showTelemetry()) {
      const every = this.telemetryEverySec();
      if (this.secCounter % every === 0) {
        const selId = this.selectedVehicleId();

        // Always log selected vehicle; additionally log any trucks that are in REFUEL/MAINT/DUMPING/LOADING (more interesting)
        const interesting = new Set<string>(
          list
            .filter(v => ['REFUEL', 'MAINT', 'DUMPING', 'LOADING', 'FAULT'].includes(String(v.status)))
            .map(v => v.id),
        );

        if (selId) interesting.add(selId);

        for (const v of list) {
          if (!interesting.has(v.id)) continue;

          this.pushRow({
            id: v.id,
            type: 'telemetry',
            msg: this.formatTelemetryMsg(v),
            meta: this.formatMeta(v),
          });
        }
      }
    }

    // keep log size bounded
    const max = this.maxRows();
    const rows = this.rowsSig();
    if (rows.length > max) {
      this.rowsSig.set(rows.slice(rows.length - max));
    }
  }

  private pushRow(partial: Omit<TelemetryLogRow, 'tsIso'>): void {
    const row: TelemetryLogRow = {
      tsIso: new Date().toISOString(),
      ...partial,
    };

    this.rowsSig.update(prev => [...prev, row]);
  }

  private formatTelemetryMsg(v: FleetVehicle): string {
    const t = v.telemetry;
    return `spd ${t.speedKph.toFixed(0)}kph • payload ${t.payloadTons.toFixed(0)}t • fuel ${t.fuelPct.toFixed(0)}% • temp ${t.engineTempC.toFixed(0)}C • health ${t.healthPct.toFixed(0)}%`;
  }

  private formatMeta(v: FleetVehicle): string {
    // “mine ops” style short meta: status + quick cycle estimate
    const cycle = this.estimateCycleMinutes(v);
    return `${v.status} • est cycle ${cycle.toFixed(1)} min`;
  }

  private alertList(v: FleetVehicle): string[] {
    const t = v.telemetry;
    const out: string[] = [];
    if (t.fuelPct <= 20) out.push(`LOW FUEL (${t.fuelPct.toFixed(0)}%)`);
    if (t.healthPct <= 60) out.push(`LOW HEALTH (${t.healthPct.toFixed(0)}%)`);
    if (t.engineTempC >= 105) out.push(`HIGH TEMP (${t.engineTempC.toFixed(0)}C)`);
    return out;
  }

  private alertFingerprint(v: FleetVehicle): string {
    const t = v.telemetry;
    return [
      t.fuelPct <= 20 ? 'F' : '-',
      t.healthPct <= 60 ? 'H' : '-',
      t.engineTempC >= 105 ? 'T' : '-',
    ].join('');
  }

  private estimateCycleMinutes(v: FleetVehicle): number {
    // Simple deterministic estimate (keeps UI stable).
    // This is a POC: later we’ll compute from route lengths + dwell timers.
    switch (v.status) {
      case 'LOADING': return 1.8;
      case 'HAULING': return 4.2;
      case 'DUMPING': return 1.4;
      case 'RETURNING': return 3.8;
      case 'REFUEL': return 2.0;
      case 'MAINT': return 3.5;
      case 'DISPATCHED': return 0.8;
      case 'IDLE': return 0.5;
      case 'FAULT': return 999;
      case 'PAUSED': return 999;
      default: return 5.0;
    }
  }

  // styling helpers for template
  rowClass(r: TelemetryLogRow): string {
    return `row ${r.type}`;
  }

  statusPillClass(status: string): string {
    const s = String(status).toLowerCase();
    if (s.includes('fault')) return 'pill fault';
    if (s.includes('pause')) return 'pill paused';
    if (s.includes('loading')) return 'pill loading';
    if (s.includes('hauling')) return 'pill hauling';
    if (s.includes('dumping')) return 'pill dumping';
    if (s.includes('return')) return 'pill returning';
    if (s.includes('refuel')) return 'pill refuel';
    if (s.includes('maint')) return 'pill maint';
    return 'pill idle';
  }
}
