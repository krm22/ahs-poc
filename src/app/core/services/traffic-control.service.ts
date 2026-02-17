import { Injectable } from '@angular/core';

export type SpeedZone = { name: string; polygon: [number, number][], speedKph: number };

@Injectable({ providedIn: 'root' })
export class TrafficControlService {
  // Simple first-pass zones. Refine geometry later as you “draw” the site.
  private readonly zones: SpeedZone[] = [
    {
      name: 'Shovel Area',
      speedKph: 12,
      polygon: [
        [118.7525, -22.0075],
        [118.7575, -22.0075],
        [118.7575, -22.0125],
        [118.7525, -22.0125],
        [118.7525, -22.0075],
      ],
    },
    {
      name: 'ROM Pad',
      speedKph: 15,
      polygon: [
        [118.7675, -22.0225],
        [118.7755, -22.0225],
        [118.7755, -22.0305],
        [118.7675, -22.0305],
        [118.7675, -22.0225],
      ],
    },
    {
      name: 'Workshop Precinct',
      speedKph: 10,
      polygon: [
        [118.7405, -22.0095],
        [118.7480, -22.0095],
        [118.7480, -22.0155],
        [118.7405, -22.0155],
        [118.7405, -22.0095],
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
