export const DUMP_ZONES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { type: 'ROM' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [118.7680, -22.0230],
          [118.7750, -22.0230],
          [118.7750, -22.0300],
          [118.7680, -22.0300],
          [118.7680, -22.0230]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { type: 'FUEL' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [118.7445, -22.0045],
          [118.7485, -22.0045],
          [118.7485, -22.0085],
          [118.7445, -22.0085],
          [118.7445, -22.0045]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { type: 'MAINT' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [118.7415, -22.0100],
          [118.7468, -22.0100],
          [118.7468, -22.0148],
          [118.7415, -22.0148],
          [118.7415, -22.0100]
        ]]
      }
    },
    {
      // Shovel / dig face (as a point of interest)
      type: 'Feature',
      properties: { type: 'SHOVEL', name: 'Shovel 01' },
      geometry: {
        type: 'Point',
        coordinates: [118.7550, -22.0100]
      }
    }
  ]
};
