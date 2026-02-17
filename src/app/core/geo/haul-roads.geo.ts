// Whaleback (Newman) haul roads (approximate, demo-ready)
// Coordinate order: [lng, lat]

export const HAUL_ROADS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'HR-LOOP', name: 'Main Haul Loop' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [119.6672, -23.3728],
          [119.6750, -23.3744],
          [119.6846, -23.3722],
          [119.6926, -23.3680],
          [119.6990, -23.3640],
          [119.6942, -23.3598],
          [119.6868, -23.3570],
          [119.6768, -23.3562],
          [119.6670, -23.3590],
          [119.6614, -23.3656],
          [119.6672, -23.3728],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'HR-P1-RAMP', name: 'Pit 1 Ramp Connector' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [119.6726, -23.3640],
          [119.6716, -23.3662],
          [119.6702, -23.3686],
          [119.6690, -23.3708],
          [119.6672, -23.3728],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'HR-P2-RAMP', name: 'Pit 2 Ramp Connector' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [119.6948, -23.3682],
          [119.6938, -23.3692],
          [119.6926, -23.3702],
          [119.6908, -23.3714],
          [119.6886, -23.3722],
          [119.6846, -23.3722],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'HR-CRUSHER', name: 'Crusher / ROM Spur' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [119.6990, -23.3640],
          [119.6996, -23.3642],
          [119.7004, -23.3640],
          [119.7010, -23.3636],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { id: 'HR-WORKSHOP', name: 'Workshop Spur' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [119.6750, -23.3744],
          [119.6754, -23.3742],
          [119.6760, -23.3741],
          [119.6765, -23.3740],
        ],
      },
    },
  ],
} as const;
