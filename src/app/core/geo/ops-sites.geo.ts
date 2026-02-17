// Whaleback (Newman) operations sites (approximate, demo-ready coordinates)
// Coordinate order: [lng, lat]

export const OPS_DIG_FACES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'DIG-A', name: 'Whaleback Pit 1 Face', equipment: 'EX1200' },
      geometry: { type: 'Point', coordinates: [119.6726, -23.3640] },
    },
    {
      type: 'Feature',
      properties: { id: 'DIG-B', name: 'Whaleback Pit 2 Face', equipment: 'PC2000' },
      geometry: { type: 'Point', coordinates: [119.6948, -23.3682] },
    },
  ],
} as const;

export const OPS_DUMPS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'DUMP-A', name: 'Waste Dump (NW)' },
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
      properties: { id: 'DUMP-B', name: 'ROM Pad / Crusher' },
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
  ],
} as const;

export const OPS_TIP_NODES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'TN-A1', dumpId: 'DUMP-A', name: 'Entry A' },
      geometry: { type: 'Point', coordinates: [119.6544, -23.3588] },
    },
    {
      type: 'Feature',
      properties: { id: 'TN-A2', dumpId: 'DUMP-A', name: 'Tip A' },
      geometry: { type: 'Point', coordinates: [119.6609, -23.3550] },
    },

    {
      type: 'Feature',
      properties: { id: 'TN-B1', dumpId: 'DUMP-B', name: 'Entry B' },
      geometry: { type: 'Point', coordinates: [119.6970, -23.3658] },
    },
    {
      type: 'Feature',
      properties: { id: 'TN-B2', dumpId: 'DUMP-B', name: 'Tip B' },
      geometry: { type: 'Point', coordinates: [119.7009, -23.3636] },
    },
  ],
} as const;

export const OPS_TIP_EDGES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'TE-A', dumpId: 'DUMP-A', name: 'Tip Edge A', from: 'TN-A1', to: 'TN-A2' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [119.6544, -23.3588],
          [119.6562, -23.3582],
          [119.6583, -23.3572],
          [119.6598, -23.3562],
          [119.6609, -23.3550],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'TE-B', dumpId: 'DUMP-B', name: 'Tip Edge B', from: 'TN-B1', to: 'TN-B2' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [119.6970, -23.3658],
          [119.6982, -23.3652],
          [119.6994, -23.3644],
          [119.7003, -23.3640],
          [119.7009, -23.3636],
        ],
      },
    },
  ],
} as const;
