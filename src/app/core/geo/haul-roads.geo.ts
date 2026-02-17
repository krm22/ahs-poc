export const HAUL_ROADS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Pit Exit' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [118.7550, -22.0100], // shovel area
          [118.7600, -22.0200],
          [118.7700, -22.0250]  // dump zone
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Return Road' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [118.7700, -22.0250],
          [118.7600, -22.0150],
          [118.7500, -22.0100]
        ]
      }
    },
    {
      // short spur from the return road to the fuel bay
      type: 'Feature',
      properties: { name: 'Fuel Spur' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [118.7500, -22.0100],
          [118.7465, -22.0070]
        ]
      }
    },
    {
      // short spur from the return road to the workshop
      type: 'Feature',
      properties: { name: 'Maint Spur' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [118.7500, -22.0100],
          [118.7440, -22.0125]
        ]
      }
    }
  ]
};
