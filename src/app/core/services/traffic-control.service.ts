import { Injectable } from '@angular/core';

export type SpeedZone = { name: string; polygon: [number, number][], speedKph: number };

@Injectable({ providedIn: 'root' })
export class TrafficControlService {
  // Whaleback (Newman) demo speed zones aligned with ops-sites + zones.geo.ts
  private readonly zones: SpeedZone[] = [
    {
      name: 'Pit 1 Face / Loading Area',
      speedKph: 12,
      polygon: [
        [119.6708, -23.3652],
        [119.6744, -23.3652],
        [119.6744, -23.3628],
        [119.6708, -23.3628],
        [119.6708, -23.3652],
      ],
    },
    {
      name: 'Pit 2 Face / Loading Area',
      speedKph: 12,
      polygon: [
        [119.6932, -23.3692],
        [119.6964, -23.3692],
        [119.6964, -23.3672],
        [119.6932, -23.3672],
        [119.6932, -23.3692],
      ],
    },
    {
      name: 'ROM Pad / Crusher Precinct',
      speedKph: 15,
      polygon: [
        [119.6966, -23.3662],
        [119.7016, -23.3662],
        [119.7016, -23.3628],
        [119.6966, -23.3628],
        [119.6966, -23.3662],
      ],
    },
    {
      name: 'Workshop Precinct',
      speedKph: 10,
      polygon: [
        [119.6756, -23.3747],
        [119.6776, -23.3747],
        [119.6776, -23.3732],
        [119.6756, -23.3732],
        [119.6756, -23.3747],
      ],
    },
    {
      name: 'Fuel Bay',
      speedKph: 10,
      polygon: [
        [119.6876, -23.3586],
        [119.6904, -23.3586],
        [119.6904, -23.3567],
        [119.6876, -23.3567],
        [119.6876, -23.3586],
      ],
    },
    {
      // a high-conflict zone where spurs meet the loop (good for yield/priority rules later)
      name: 'Loop Merge / Intersection Zone',
      speedKph: 20,
      polygon: [
        [119.6838, -23.3732],
        [119.6862, -23.3732],
        [119.6862, -23.3714],
        [119.6838, -23.3714],
        [119.6838, -23.3732],
      ],
    },
  ];

  speedLimitAt(lngLat: { lng: number; lat: number }, defaultKph = 40): number {
    for (const z of this.zones) {
      if (pointInPolygon([lngLat.lng, lngLat.lat], z.polygon)) return z.speedKph;
    }
    return defaultKph;
  }
}

function pointInPolygon(p: [number, number], poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect =
      ((yi > p[1]) !== (yj > p[1])) &&
      (p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
