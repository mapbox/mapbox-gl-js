window.style = {
  "version": 8,
  "projection": {
    "name": "globe"
  },
  "sources": {
    "geojson": {
      "type": "geojson",
      "data": {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "id": 0,
            "properties": {
              "color": "yellow",
              "height": 2000000
            },
            "geometry": {
              "type": "Polygon",
              "coordinates": [
                [
                  [
                    -7,
                    -7
                  ],
                  [
                    -7,
                    -1
                  ],
                  [
                    -1,
                    -1
                  ],
                  [
                    -1,
                    -7
                  ],
                  [
                    -7,
                    -7
                  ]
                ]
              ]
            }
          },
          {
            "type": "Feature",
            "id": 1,
            "properties": {
              "color": "red",
              "height": 1500000
            },
            "geometry": {
              "type": "Polygon",
              "coordinates": [
                [
                  [
                    15,
                    -12
                  ],
                  [
                    15,
                    -1
                  ],
                  [
                    5,
                    -1
                  ],
                  [
                    5,
                    -12
                  ],
                  [
                    15,
                    -12
                  ]
                ]
              ]
            }
          },
          {
            "type": "Feature",
            "id": 2,
            "properties": {
              "color": "green",
              "height": 1250000
            },
            "geometry": {
              "type": "Polygon",
              "coordinates": [
                [
                  [
                    10,
                    2
                  ],
                  [
                    18,
                    -6.5
                  ],
                  [
                    10,
                    -15
                  ],
                  [
                    2,
                    -6.5
                  ],
                  [
                    10,
                    2
                  ]
                ]
              ]
            }
          }
        ]
      }
    },
    "places": {
      "type": "geojson",
      "data": "/test/integration/data/places.geojson"
    }
  },
  "pitch": 70,
  "bearing": -30,
  "zoom": 2,
  "center": [0, 0],
  "glyphs": "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "white"
      }
    },
    {
      "id": "building-a",
      "type": "fill-extrusion",
      "source": "geojson",
      "paint": {
        "fill-extrusion-color": ["case", ['boolean', ['feature-state', 'picked'], false], "magenta", ["get", "color"]],
        "fill-extrusion-height": ["get", "height"]
      }
    },
    {
      "id": "circles_na",
      "type": "circle",
      "source": "places",
      "filter": ["==", "region", "North America"],
      "paint": {
        "circle-radius": ["case", ['boolean', ['feature-state', 'picked'], false], 20, 15],
        "circle-color": ["case", ['boolean', ['feature-state', 'picked'], false], "magenta", "red"],
        "circle-pitch-alignment": "viewport",
        "circle-pitch-scale": "viewport"
      }
    },
    {
      "id": "circles_africa",
      "type": "circle",
      "source": "places",
      "filter": ["==", "region", "Africa"],
      "paint": {
        "circle-radius": ["case", ['boolean', ['feature-state', 'picked'], false], 20, 15],
        "circle-color": ["case", ['boolean', ['feature-state', 'picked'], false], "magenta", "red"],
        "circle-pitch-alignment": "map",
        "circle-pitch-scale": "viewport"
      }
    },
    {
      "id": "circles_sa",
      "type": "heatmap",
      "source": "places",
      "filter": ["==", "region", "South America"],
      "paint": {
        "heatmap-radius": ["case", ['boolean', ['feature-state', 'picked'], false], 75, 50],
        "heatmap-intensity": 1
      }
    },
    {
      "id": "symbols_europe",
      "type": "symbol",
      "source": "places",
      "filter": ["==", "region", "Europe"],
      "layout": {
        "symbol-placement": "point",
        "text-field": "{name}",
        "text-font": [
          "Open Sans Semibold",
          "Arial Unicode MS Bold"
        ]
      },
      "paint": {
        "text-color": ["case", ['boolean', ['feature-state', 'picked'], false], "magenta", "black"]
      }
    }
  ]
}
