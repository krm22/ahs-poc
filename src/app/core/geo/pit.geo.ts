// Whaleback (Newman) pit polygon (approximate)
// Coordinate order: [lng, lat]

export const PIT_POLYGON = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [119.6608, -23.3578],
        [119.6726, -23.3561],
        [119.6832, -23.3633],
        [119.6796, -23.3722],
        [119.6667, -23.3731],
        [119.6574, -23.3656],
        [119.6608, -23.3578],
      ],
    ],
  },
} as const;
