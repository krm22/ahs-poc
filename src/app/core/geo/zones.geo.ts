// Whaleback (Newman) operational zones (approximate, demo-ready)
// Coordinate order: [lng, lat]

export const DUMP_ZONES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { type: 'ROM', name: 'ROM Pad / Crusher' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [119.6966, -23.3662],
            [119.7016, -23.3662],
            [119.7016, -23.3628],
            [119.6966, -23.3628],
            [119.6966, -23.3662],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { type: 'FUEL', name: 'Fuel Bay' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [119.6876, -23.3586],
            [119.6904, -23.3586],
            [119.6904, -23.3567],
            [119.6876, -23.3567],
            [119.6876, -23.3586],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { type: 'MAINT', name: 'Workshop Precinct' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [119.6756, -23.3747],
            [119.6776, -23.3747],
            [119.6776, -23.3732],
            [119.6756, -23.3732],
            [119.6756, -23.3747],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { type: 'WASTE', name: 'Waste Dump (NW)' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [119.6538, -23.3595],
            [119.6625, -23.3595],
            [119.6625, -23.3532],
            [119.6538, -23.3532],
            [119.6538, -23.3595],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { type: 'SHOVEL', name: 'Pit 1 Face (POI)' },
      geometry: { type: 'Point', coordinates: [119.6726, -23.3640] },
    },
    {
      type: 'Feature',
      properties: { type: 'SHOVEL', name: 'Pit 2 Face (POI)' },
      geometry: { type: 'Point', coordinates: [119.6948, -23.3682] },
    },
  ],
} as const;
