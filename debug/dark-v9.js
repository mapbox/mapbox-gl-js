window.darkv9 = {
  "version": 8,
  "name": "Mapbox Dark",
  "metadata": {
    "mapbox:autocomposite": true,
    "mapbox:type": "default",
    "mapbox:groups": {
      "1444934828655.3389": {
        "name": "Aeroways",
        "collapsed": true
      },
      "1444933322393.2852": {
        "name": "POI labels  (scalerank 1)",
        "collapsed": true
      },
      "1444855786460.0557": {
        "name": "Roads",
        "collapsed": true
      },
      "1444856071629.7817": {
        "name": "Place labels",
        "collapsed": true
      },
      "1444934295202.7542": {
        "name": "Admin boundaries",
        "collapsed": true
      },
      "1444856151690.9143": {
        "name": "State labels",
        "collapsed": true
      },
      "1444933721429.3076": {
        "name": "Road labels",
        "collapsed": true
      },
      "1444933358918.2366": {
        "name": "POI labels (scalerank 2)",
        "collapsed": true
      },
      "1444933808272.805": {
        "name": "Water labels",
        "collapsed": true
      },
      "1444933372896.5967": {
        "name": "POI labels (scalerank 3)",
        "collapsed": true
      },
      "1444855799204.86": {
        "name": "Bridges",
        "collapsed": true
      },
      "1444856087950.3635": {
        "name": "Marine labels",
        "collapsed": true
      },
      "1456969573402.7817": {
        "name": "Hillshading",
        "collapsed": true
      },
      "1444856869758.2375": {
        "name": "Wetlands",
        "collapsed": true
      },
      "1444862510685.128": {
        "name": "City labels",
        "collapsed": true
      },
      "1444855769305.6016": {
        "name": "Tunnels",
        "collapsed": true
      },
      "1456970288113.8113": {
        "name": "Landcover",
        "collapsed": true
      },
      "1444856144497.7825": {
        "name": "Country labels",
        "collapsed": true
      }
    }
  },
  "sources": {
    "composite": {
      "url": "mapbox://mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7",
      "type": "vector"
    }
  },
  "sprite": "mapbox://sprites/mapbox/light-v9",
  "glyphs": "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  "layers": [
    {
      "id": "background",
      "type": "background",
      "layout": {},
      "paint": {
        "background-color": "hsl(55, 1%, 20%)"
      }
    },
    {
      "id": "landcover_wood",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456970288113.8113"
      },
      "source": "composite",
      "source-layer": "landcover",
      "maxzoom": 14,
      "filter": [
        "==",
        "class",
        "wood"
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(55, 1%, 20%)",
        "fill-opacity": 0.1,
        "fill-antialias": false
      }
    },
    {
      "id": "landcover_scrub",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456970288113.8113"
      },
      "source": "composite",
      "source-layer": "landcover",
      "maxzoom": 14,
      "filter": [
        "==",
        "class",
        "scrub"
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(55, 1%, 20%)",
        "fill-opacity": 0.1,
        "fill-antialias": false
      }
    },
    {
      "id": "landcover_grass",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456970288113.8113"
      },
      "source": "composite",
      "source-layer": "landcover",
      "maxzoom": 14,
      "filter": [
        "==",
        "class",
        "grass"
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(55, 1%, 20%)",
        "fill-opacity": 0.1,
        "fill-antialias": false
      }
    },
    {
      "id": "landcover_crop",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456970288113.8113"
      },
      "source": "composite",
      "source-layer": "landcover",
      "maxzoom": 14,
      "filter": [
        "==",
        "class",
        "crop"
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(55, 1%, 20%)",
        "fill-opacity": 0.1,
        "fill-antialias": false
      }
    },
    {
      "id": "national_park",
      "type": "fill",
      "source": "composite",
      "source-layer": "landuse_overlay",
      "filter": [
        "==",
        "class",
        "national_park"
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(132, 2%, 20%)",
        "fill-opacity": {
          "base": 1,
          "stops": [
            [
              5,
              0
            ],
            [
              6,
              0.5
            ]
          ]
        }
      }
    },
    {
      "id": "parks",
      "type": "fill",
      "source": "composite",
      "source-layer": "landuse",
      "filter": [
        "==",
        "class",
        "park"
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(132, 2%, 20%)",
        "fill-opacity": {
          "base": 1,
          "stops": [
            [
              5,
              0
            ],
            [
              6,
              0.75
            ]
          ]
        }
      }
    },
    {
      "id": "pitch",
      "type": "fill",
      "source": "composite",
      "source-layer": "landuse",
      "filter": [
        "==",
        "class",
        "pitch"
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(132, 2%, 20%)"
      }
    },
    {
      "id": "industrial",
      "type": "fill",
      "source": "composite",
      "source-layer": "landuse",
      "filter": [
        "==",
        "class",
        "industrial"
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(0, 0%, 20%)"
      }
    },
    {
      "id": "sand",
      "type": "fill",
      "source": "composite",
      "source-layer": "landuse",
      "filter": [
        "==",
        "class",
        "sand"
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(132, 2%, 20%)"
      }
    },
    {
      "id": "hillshade_highlight_bright",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456969573402.7817"
      },
      "source": "composite",
      "source-layer": "hillshade",
      "maxzoom": 16,
      "filter": [
        "==",
        "level",
        94
      ],
      "layout": {},
      "paint": {
        "fill-color": "#fff",
        "fill-opacity": {
          "stops": [
            [
              14,
              0.04
            ],
            [
              16,
              0
            ]
          ]
        },
        "fill-antialias": false
      }
    },
    {
      "id": "hillshade_highlight_med",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456969573402.7817"
      },
      "source": "composite",
      "source-layer": "hillshade",
      "maxzoom": 16,
      "filter": [
        "==",
        "level",
        90
      ],
      "layout": {},
      "paint": {
        "fill-color": "#fff",
        "fill-opacity": {
          "stops": [
            [
              14,
              0.04
            ],
            [
              16,
              0
            ]
          ]
        },
        "fill-antialias": false
      }
    },
    {
      "id": "hillshade_shadow_faint",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456969573402.7817"
      },
      "source": "composite",
      "source-layer": "hillshade",
      "maxzoom": 16,
      "filter": [
        "==",
        "level",
        89
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(0, 0%, 35%)",
        "fill-opacity": {
          "stops": [
            [
              14,
              0.033
            ],
            [
              16,
              0
            ]
          ]
        },
        "fill-antialias": false
      }
    },
    {
      "id": "hillshade_shadow_med",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456969573402.7817"
      },
      "source": "composite",
      "source-layer": "hillshade",
      "maxzoom": 16,
      "filter": [
        "==",
        "level",
        78
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(0, 0%, 35%)",
        "fill-opacity": {
          "stops": [
            [
              14,
              0.033
            ],
            [
              16,
              0
            ]
          ]
        },
        "fill-antialias": false
      }
    },
    {
      "id": "hillshade_shadow_dark",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456969573402.7817"
      },
      "source": "composite",
      "source-layer": "hillshade",
      "maxzoom": 16,
      "filter": [
        "==",
        "level",
        67
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(0, 0%, 35%)",
        "fill-opacity": {
          "stops": [
            [
              14,
              0.06
            ],
            [
              16,
              0
            ]
          ]
        },
        "fill-antialias": false
      }
    },
    {
      "id": "hillshade_shadow_extreme",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1456969573402.7817"
      },
      "source": "composite",
      "source-layer": "hillshade",
      "maxzoom": 16,
      "filter": [
        "==",
        "level",
        56
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(0, 0%, 35%)",
        "fill-opacity": {
          "stops": [
            [
              14,
              0.06
            ],
            [
              16,
              0
            ]
          ]
        },
        "fill-antialias": false
      }
    },
    {
      "id": "waterway-river-canal",
      "type": "line",
      "source": "composite",
      "source-layer": "waterway",
      "minzoom": 8,
      "filter": [
        "any",
        [
          "==",
          "class",
          "canal"
        ],
        [
          "==",
          "class",
          "river"
        ]
      ],
      "layout": {
        "line-cap": {
          "base": 1,
          "stops": [
            [
              0,
              "butt"
            ],
            [
              11,
              "round"
            ]
          ]
        },
        "line-join": "round"
      },
      "paint": {
        "line-color": "hsl(185, 2%, 10%)",
        "line-width": {
          "base": 1.3,
          "stops": [
            [
              8.5,
              0.1
            ],
            [
              20,
              8
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              8,
              0
            ],
            [
              8.5,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "water shadow",
      "type": "fill",
      "source": "composite",
      "source-layer": "water",
      "layout": {},
      "paint": {
        "fill-color": "hsl(185, 3%, 5%)",
        "fill-translate": {
          "base": 1.2,
          "stops": [
            [
              7,
              [
                0,
                0
              ]
            ],
            [
              16,
              [
                -1,
                -1
              ]
            ]
          ]
        },
        "fill-translate-anchor": "viewport",
        "fill-opacity": 1
      }
    },
    {
      "id": "water",
      "ref": "water shadow",
      "paint": {
        "fill-color": "hsl(185, 2%, 10%)"
      }
    },
    {
      "id": "barrier_line-land-polygon",
      "type": "fill",
      "source": "composite",
      "source-layer": "barrier_line",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "Polygon"
        ],
        [
          "==",
          "class",
          "land"
        ]
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(55, 1%, 20%)",
        "fill-outline-color": "hsl(55, 1%, 20%)"
      }
    },
    {
      "id": "barrier_line-land-line",
      "type": "line",
      "source": "composite",
      "source-layer": "barrier_line",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "==",
          "class",
          "land"
        ]
      ],
      "layout": {
        "line-cap": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.99,
          "stops": [
            [
              14,
              0.75
            ],
            [
              20,
              40
            ]
          ]
        },
        "line-color": "hsl(55, 1%, 20%)"
      }
    },
    {
      "id": "aeroway-polygon",
      "type": "fill",
      "metadata": {
        "mapbox:group": "1444934828655.3389"
      },
      "source": "composite",
      "source-layer": "aeroway",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "Polygon"
        ],
        [
          "!=",
          "type",
          "apron"
        ]
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(0, 0%, 27%)",
        "fill-opacity": {
          "base": 1,
          "stops": [
            [
              11,
              0
            ],
            [
              11.5,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "aeroway-runway",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444934828655.3389"
      },
      "source": "composite",
      "source-layer": "aeroway",
      "minzoom": 9,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "==",
          "type",
          "runway"
        ]
      ],
      "layout": {},
      "paint": {
        "line-color": "hsl(0, 0%, 27%)",
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              9,
              1
            ],
            [
              18,
              80
            ]
          ]
        }
      }
    },
    {
      "id": "aeroway-taxiway",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444934828655.3389"
      },
      "source": "composite",
      "source-layer": "aeroway",
      "minzoom": 9,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "==",
          "type",
          "taxiway"
        ]
      ],
      "layout": {},
      "paint": {
        "line-color": "hsl(0, 0%, 27%)",
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              10,
              0.5
            ],
            [
              18,
              20
            ]
          ]
        }
      }
    },
    {
      "id": "building",
      "type": "fill",
      "source": "composite",
      "source-layer": "building",
      "minzoom": 15,
      "filter": [
        "all",
        [
          "!=",
          "type",
          "building:part"
        ],
        [
          "==",
          "underground",
          "false"
        ]
      ],
      "layout": {},
      "paint": {
        "fill-color": "hsl(55, 1%, 17%)",
        "fill-opacity": {
          "base": 1,
          "stops": [
            [
              15.5,
              0
            ],
            [
              16,
              1
            ]
          ]
        },
        "fill-outline-color": "hsl(55, 1%, 15%)",
        "fill-antialias": true
      }
    },
    {
      "id": "tunnel-street-low",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "street"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": {
          "stops": [
            [
              11.5,
              0
            ],
            [
              12,
              1
            ],
            [
              14,
              1
            ],
            [
              14.01,
              0
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-street_limited-low",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "street_limited"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": {
          "stops": [
            [
              11.5,
              0
            ],
            [
              12,
              1
            ],
            [
              14,
              1
            ],
            [
              14.01,
              0
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-service-link-track-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 14,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "link",
            "service",
            "track"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ],
          [
            "!=",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 29%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              0.5
            ],
            [
              18,
              12
            ]
          ]
        },
        "line-dasharray": [
          3,
          3
        ]
      }
    },
    {
      "id": "tunnel-street_limited-case",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-street_limited-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 29%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              13,
              0
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-dasharray": [
          3,
          3
        ],
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-street-case",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-street-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 29%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              13,
              0
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-dasharray": [
          3,
          3
        ],
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-secondary-tertiary-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "secondary",
            "tertiary"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              10,
              0.75
            ],
            [
              18,
              2
            ]
          ]
        },
        "line-dasharray": [
          3,
          3
        ],
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              8.5,
              0.5
            ],
            [
              10,
              0.75
            ],
            [
              18,
              26
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 29%)"
      }
    },
    {
      "id": "tunnel-primary-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "primary"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-dasharray": [
          3,
          3
        ],
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 29%)"
      }
    },
    {
      "id": "tunnel-trunk_link-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "structure",
            "tunnel"
          ],
          [
            "==",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 29%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-dasharray": [
          3,
          3
        ]
      }
    },
    {
      "id": "tunnel-motorway_link-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway_link"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 29%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-dasharray": [
          3,
          3
        ]
      }
    },
    {
      "id": "tunnel-trunk-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "structure",
            "tunnel"
          ],
          [
            "==",
            "type",
            "trunk"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 29%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-opacity": 1,
        "line-dasharray": [
          3,
          3
        ]
      }
    },
    {
      "id": "tunnel-motorway-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 29%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-opacity": 1,
        "line-dasharray": [
          3,
          3
        ]
      }
    },
    {
      "id": "tunnel-construction",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 14,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "construction"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-join": "miter"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        },
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                0.4,
                0.8
              ]
            ],
            [
              15,
              [
                0.3,
                0.6
              ]
            ],
            [
              16,
              [
                0.2,
                0.3
              ]
            ],
            [
              17,
              [
                0.2,
                0.25
              ]
            ],
            [
              18,
              [
                0.15,
                0.15
              ]
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-path",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "path"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ],
          [
            "!=",
            "type",
            "steps"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              15,
              1
            ],
            [
              18,
              4
            ]
          ]
        },
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.75,
                1
              ]
            ],
            [
              16,
              [
                1,
                0.75
              ]
            ],
            [
              17,
              [
                1,
                0.5
              ]
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              14,
              0
            ],
            [
              14.25,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-steps",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "structure",
            "tunnel"
          ],
          [
            "==",
            "type",
            "steps"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              15,
              1
            ],
            [
              18,
              4
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.75,
                1
              ]
            ],
            [
              16,
              [
                1,
                0.75
              ]
            ],
            [
              17,
              [
                0.3,
                0.3
              ]
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              14,
              0
            ],
            [
              14.25,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-trunk_link",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-trunk_link-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": 1,
        "line-dasharray": [
          1,
          0
        ]
      }
    },
    {
      "id": "tunnel-motorway_link",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-motorway_link-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": 1,
        "line-dasharray": [
          1,
          0
        ]
      }
    },
    {
      "id": "tunnel-pedestrian",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "pedestrian"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              0.5
            ],
            [
              18,
              12
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": 1,
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.5,
                0.4
              ]
            ],
            [
              16,
              [
                1,
                0.2
              ]
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-service-link-track",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-service-link-track-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              0.5
            ],
            [
              18,
              12
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-dasharray": [
          1,
          0
        ]
      }
    },
    {
      "id": "tunnel-street_limited",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-street_limited-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-street",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-street-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "tunnel-secondary-tertiary",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-secondary-tertiary-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              8.5,
              0.5
            ],
            [
              10,
              0.75
            ],
            [
              18,
              26
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": 1,
        "line-dasharray": [
          1,
          0
        ],
        "line-blur": 0
      }
    },
    {
      "id": "tunnel-primary",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-primary-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)",
        "line-opacity": 1,
        "line-dasharray": [
          1,
          0
        ],
        "line-blur": 0
      }
    },
    {
      "id": "tunnel-trunk",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "trunk"
          ],
          [
            "==",
            "structure",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(185, 2%, 15%)"
      }
    },
    {
      "id": "tunnel-motorway",
      "metadata": {
        "mapbox:group": "1444855769305.6016"
      },
      "ref": "tunnel-motorway-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-dasharray": [
          1,
          0
        ],
        "line-opacity": 1,
        "line-color": "hsl(185, 2%, 15%)",
        "line-blur": 0
      }
    },
    {
      "id": "road-pedestrian-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 12,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "pedestrian"
          ],
          [
            "==",
            "structure",
            "none"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              2
            ],
            [
              18,
              14.5
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": 0,
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.9,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-street-low",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "street"
          ],
          [
            "==",
            "structure",
            "none"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "stops": [
            [
              11,
              0
            ],
            [
              11.25,
              1
            ],
            [
              14,
              1
            ],
            [
              14.01,
              0
            ]
          ]
        }
      }
    },
    {
      "id": "road-street_limited-low",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "street_limited"
          ],
          [
            "==",
            "structure",
            "none"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "stops": [
            [
              11,
              0
            ],
            [
              11.25,
              1
            ],
            [
              14,
              1
            ],
            [
              14.01,
              0
            ]
          ]
        }
      }
    },
    {
      "id": "road-service-link-track-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 14,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "link",
            "service",
            "track"
          ],
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ],
          [
            "!=",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              0.5
            ],
            [
              18,
              12
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.9,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-street_limited-case",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-street_limited-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              13,
              0
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.9,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-street-case",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-street-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              13,
              0
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.9,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-main-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "secondary",
            "tertiary"
          ],
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              10,
              0.75
            ],
            [
              18,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              8.5,
              0.5
            ],
            [
              10,
              0.75
            ],
            [
              18,
              26
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              6,
              0
            ],
            [
              7,
              0.4
            ],
            [
              9,
              0.5
            ],
            [
              10,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-primary-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "primary"
          ],
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              6,
              0
            ],
            [
              7,
              0.4
            ],
            [
              9,
              0.5
            ],
            [
              10,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-motorway_link-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 10,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway_link"
          ],
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              6,
              0
            ],
            [
              7,
              0.4
            ],
            [
              9,
              0.5
            ],
            [
              10,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-trunk_link-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ],
          [
            "==",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              6,
              0
            ],
            [
              7,
              0.4
            ],
            [
              9,
              0.5
            ],
            [
              10,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-trunk-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 5,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "trunk"
          ],
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              7,
              0.5
            ],
            [
              10,
              1
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.5
            ],
            [
              9,
              1.4
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              6,
              0
            ],
            [
              6.1,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-motorway-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway"
          ],
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              7,
              0.5
            ],
            [
              10,
              1
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-opacity": 1
      }
    },
    {
      "id": "road-construction",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 14,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "construction"
          ],
          [
            "==",
            "structure",
            "none"
          ]
        ]
      ],
      "layout": {
        "line-join": "miter"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        },
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                0.4,
                0.8
              ]
            ],
            [
              15,
              [
                0.3,
                0.6
              ]
            ],
            [
              16,
              [
                0.2,
                0.3
              ]
            ],
            [
              17,
              [
                0.2,
                0.25
              ]
            ],
            [
              18,
              [
                0.15,
                0.15
              ]
            ]
          ]
        }
      }
    },
    {
      "id": "road-sidewalks",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 16,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ],
          [
            "in",
            "type",
            "crossing",
            "sidewalk"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              15,
              1
            ],
            [
              18,
              4
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.75,
                1
              ]
            ],
            [
              16,
              [
                1,
                0.75
              ]
            ],
            [
              17,
              [
                1,
                0.5
              ]
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              16,
              0
            ],
            [
              16.25,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-path",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "path"
          ],
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ],
          [
            "!in",
            "type",
            "crossing",
            "sidewalk",
            "steps"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              15,
              1
            ],
            [
              18,
              4
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.75,
                1
              ]
            ],
            [
              16,
              [
                1,
                0.75
              ]
            ],
            [
              17,
              [
                1,
                0.5
              ]
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              14,
              0
            ],
            [
              14.25,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-steps",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ],
          [
            "==",
            "type",
            "steps"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              15,
              1
            ],
            [
              18,
              4
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.75,
                1
              ]
            ],
            [
              16,
              [
                1,
                0.75
              ]
            ],
            [
              17,
              [
                0.3,
                0.3
              ]
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              14,
              0
            ],
            [
              14.25,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-trunk_link",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-trunk_link-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": 1
      }
    },
    {
      "id": "road-motorway_link",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-motorway_link-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": 1
      }
    },
    {
      "id": "road-pedestrian",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-pedestrian-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              0.5
            ],
            [
              18,
              12
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": 1,
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.5,
                0.4
              ]
            ],
            [
              16,
              [
                1,
                0.2
              ]
            ]
          ]
        }
      }
    },
    {
      "id": "road-service-link-track",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 14,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "link",
            "service",
            "track"
          ],
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ],
          [
            "!=",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              0.5
            ],
            [
              18,
              12
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "road-street_limited",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-street_limited-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-street",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-street-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-secondary-tertiary",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-main-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              8.5,
              0.5
            ],
            [
              10,
              0.75
            ],
            [
              18,
              26
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1.2,
          "stops": [
            [
              5,
              0
            ],
            [
              5.5,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-primary",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-primary-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1.2,
          "stops": [
            [
              5,
              0
            ],
            [
              5.5,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "road-trunk",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-trunk-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.5
            ],
            [
              9,
              1.4
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": 1
      }
    },
    {
      "id": "road-motorway",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "ref": "road-motorway-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": 1
      }
    },
    {
      "id": "road-rail",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855786460.0557"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "major_rail",
            "minor_rail"
          ],
          [
            "!in",
            "structure",
            "bridge",
            "tunnel"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "hsl(0, 0%, 17%)",
        "line-width": {
          "base": 1,
          "stops": [
            [
              14,
              0.75
            ],
            [
              20,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-pedestrian-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "pedestrian"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              2
            ],
            [
              18,
              14.5
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": 0,
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-street-low",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "street"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "stops": [
            [
              11.5,
              0
            ],
            [
              12,
              1
            ],
            [
              14,
              1
            ],
            [
              14.01,
              0
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-street_limited-low",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "street_limited"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "stops": [
            [
              11.5,
              0
            ],
            [
              12,
              1
            ],
            [
              14,
              1
            ],
            [
              14.01,
              0
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-service-link-track-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 14,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "link",
            "service",
            "track"
          ],
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "!=",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              0.5
            ],
            [
              18,
              12
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-street_limited-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "street_limited"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              13,
              0
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-street-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 11,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "street"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        },
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              13,
              0
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-secondary-tertiary-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "secondary",
            "tertiary"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.2,
          "stops": [
            [
              10,
              0.75
            ],
            [
              18,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              8.5,
              0.5
            ],
            [
              10,
              0.75
            ],
            [
              18,
              26
            ]
          ]
        },
        "line-translate": [
          0,
          0
        ]
      }
    },
    {
      "id": "bridge-primary-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "primary"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-translate": [
          0,
          0
        ]
      }
    },
    {
      "id": "bridge-trunk_link-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "==",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              10.99,
              0
            ],
            [
              11,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-motorway_link-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway_link"
          ],
          [
            "<=",
            "layer",
            1
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-opacity": 1
      }
    },
    {
      "id": "bridge-trunk-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "trunk"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              10,
              1
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-motorway-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              7,
              0.5
            ],
            [
              10,
              1
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-construction",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 14,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "construction"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "miter"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        },
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                0.4,
                0.8
              ]
            ],
            [
              15,
              [
                0.3,
                0.6
              ]
            ],
            [
              16,
              [
                0.2,
                0.3
              ]
            ],
            [
              17,
              [
                0.2,
                0.25
              ]
            ],
            [
              18,
              [
                0.15,
                0.15
              ]
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-path",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "path"
          ],
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "!=",
            "type",
            "steps"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              15,
              1
            ],
            [
              18,
              4
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.75,
                1
              ]
            ],
            [
              16,
              [
                1,
                0.75
              ]
            ],
            [
              17,
              [
                1,
                0.5
              ]
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              14,
              0
            ],
            [
              14.25,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-steps",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "==",
            "type",
            "steps"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              15,
              1
            ],
            [
              18,
              4
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.75,
                1
              ]
            ],
            [
              16,
              [
                1,
                0.75
              ]
            ],
            [
              17,
              [
                0.3,
                0.3
              ]
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              14,
              0
            ],
            [
              14.25,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-trunk_link",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "!in",
            "layer",
            2,
            3,
            4,
            5
          ],
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "==",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "bridge-motorway_link",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway_link"
          ],
          [
            "!in",
            "layer",
            2,
            3,
            4,
            5
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "bridge-pedestrian",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "ref": "bridge-pedestrian-case",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              0.5
            ],
            [
              18,
              12
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": 1,
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              14,
              [
                1,
                0
              ]
            ],
            [
              15,
              [
                1.5,
                0.4
              ]
            ],
            [
              16,
              [
                1,
                0.2
              ]
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-service-link-track",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 14,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "link",
            "service",
            "track"
          ],
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "!=",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              14,
              0.5
            ],
            [
              18,
              12
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "bridge-street_limited",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "ref": "bridge-street_limited-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-street",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "ref": "bridge-street-low",
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12.5,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              13.99,
              0
            ],
            [
              14,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-secondary-tertiary",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "in",
            "type",
            "secondary",
            "tertiary"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              8.5,
              0.5
            ],
            [
              10,
              0.75
            ],
            [
              18,
              26
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1.2,
          "stops": [
            [
              5,
              0
            ],
            [
              5.5,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-primary",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "==",
            "type",
            "primary"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-opacity": {
          "base": 1.2,
          "stops": [
            [
              5,
              0
            ],
            [
              5.5,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-trunk",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "trunk"
          ],
          [
            "!in",
            "layer",
            2,
            3,
            4,
            5
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "bridge-motorway",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway"
          ],
          [
            "!in",
            "layer",
            2,
            3,
            4,
            5
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "bridge-rail",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "in",
            "class",
            "major_rail",
            "minor_rail"
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-color": "hsl(0, 0%, 17%)",
        "line-width": {
          "base": 1,
          "stops": [
            [
              14,
              0.75
            ],
            [
              20,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-trunk_link-2-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            ">=",
            "layer",
            2
          ],
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "==",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              10.99,
              0
            ],
            [
              11,
              1
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-motorway_link-2-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway_link"
          ],
          [
            ">=",
            "layer",
            2
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.75
            ],
            [
              20,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-opacity": 1
      }
    },
    {
      "id": "bridge-trunk-2-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "trunk"
          ],
          [
            ">=",
            "layer",
            2
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              10,
              1
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-motorway-2-case",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway"
          ],
          [
            ">=",
            "layer",
            2
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              7,
              0.5
            ],
            [
              10,
              1
            ],
            [
              16,
              2
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 17%)",
        "line-gap-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        }
      }
    },
    {
      "id": "bridge-trunk_link-2",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            ">=",
            "layer",
            2
          ],
          [
            "==",
            "structure",
            "bridge"
          ],
          [
            "==",
            "type",
            "trunk_link"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "bridge-motorway_link-2",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway_link"
          ],
          [
            ">=",
            "layer",
            2
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              12,
              0.5
            ],
            [
              14,
              2
            ],
            [
              18,
              18
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "bridge-trunk-2",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "trunk"
          ],
          [
            ">=",
            "layer",
            2
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "bridge-motorway-2",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444855799204.86"
      },
      "source": "composite",
      "source-layer": "road",
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "all",
          [
            "==",
            "class",
            "motorway"
          ],
          [
            ">=",
            "layer",
            2
          ],
          [
            "==",
            "structure",
            "bridge"
          ]
        ]
      ],
      "layout": {
        "line-cap": "round",
        "line-join": "round"
      },
      "paint": {
        "line-width": {
          "base": 1.5,
          "stops": [
            [
              5,
              0.75
            ],
            [
              18,
              32
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 27%)"
      }
    },
    {
      "id": "admin-3-4-boundaries-bg",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444934295202.7542"
      },
      "source": "composite",
      "source-layer": "admin",
      "filter": [
        "all",
        [
          ">=",
          "admin_level",
          3
        ],
        [
          "==",
          "maritime",
          0
        ]
      ],
      "layout": {
        "line-join": "bevel"
      },
      "paint": {
        "line-color": "hsl(0, 0%, 10%)",
        "line-width": {
          "base": 1,
          "stops": [
            [
              3,
              3.5
            ],
            [
              10,
              8
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              4,
              0
            ],
            [
              6,
              0.75
            ]
          ]
        },
        "line-dasharray": [
          1,
          0
        ],
        "line-translate": [
          0,
          0
        ],
        "line-blur": {
          "base": 1,
          "stops": [
            [
              3,
              0
            ],
            [
              8,
              3
            ]
          ]
        }
      }
    },
    {
      "id": "admin-2-boundaries-bg",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444934295202.7542"
      },
      "source": "composite",
      "source-layer": "admin",
      "minzoom": 1,
      "filter": [
        "all",
        [
          "==",
          "admin_level",
          2
        ],
        [
          "==",
          "maritime",
          0
        ]
      ],
      "layout": {
        "line-join": "miter"
      },
      "paint": {
        "line-width": {
          "base": 1,
          "stops": [
            [
              3,
              3.5
            ],
            [
              10,
              10
            ]
          ]
        },
        "line-color": "hsl(0, 0%, 10%)",
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              3,
              0
            ],
            [
              4,
              0.5
            ]
          ]
        },
        "line-translate": [
          0,
          0
        ],
        "line-blur": {
          "base": 1,
          "stops": [
            [
              3,
              0
            ],
            [
              10,
              2
            ]
          ]
        }
      }
    },
    {
      "id": "admin-3-4-boundaries",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444934295202.7542"
      },
      "source": "composite",
      "source-layer": "admin",
      "filter": [
        "all",
        [
          ">=",
          "admin_level",
          3
        ],
        [
          "==",
          "maritime",
          0
        ]
      ],
      "layout": {
        "line-join": "round",
        "line-cap": "round"
      },
      "paint": {
        "line-dasharray": {
          "base": 1,
          "stops": [
            [
              6,
              [
                2,
                0
              ]
            ],
            [
              7,
              [
                2,
                2,
                6,
                2
              ]
            ]
          ]
        },
        "line-width": {
          "base": 1,
          "stops": [
            [
              7,
              0.75
            ],
            [
              12,
              1.5
            ]
          ]
        },
        "line-opacity": {
          "base": 1,
          "stops": [
            [
              2,
              0
            ],
            [
              3,
              1
            ]
          ]
        },
        "line-color": {
          "base": 1,
          "stops": [
            [
              4,
              "hsl(0, 0%, 27%)"
            ],
            [
              5,
              "hsl(0, 0%, 35%)"
            ]
          ]
        }
      }
    },
    {
      "id": "admin-2-boundaries",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444934295202.7542"
      },
      "source": "composite",
      "source-layer": "admin",
      "minzoom": 1,
      "filter": [
        "all",
        [
          "==",
          "admin_level",
          2
        ],
        [
          "==",
          "disputed",
          0
        ],
        [
          "==",
          "maritime",
          0
        ]
      ],
      "layout": {
        "line-join": "round",
        "line-cap": "round"
      },
      "paint": {
        "line-color": "hsl(0, 0%, 43%)",
        "line-width": {
          "base": 1,
          "stops": [
            [
              3,
              0.5
            ],
            [
              10,
              2
            ]
          ]
        }
      }
    },
    {
      "id": "admin-2-boundaries-dispute",
      "type": "line",
      "metadata": {
        "mapbox:group": "1444934295202.7542"
      },
      "source": "composite",
      "source-layer": "admin",
      "minzoom": 1,
      "filter": [
        "all",
        [
          "==",
          "admin_level",
          2
        ],
        [
          "==",
          "disputed",
          1
        ],
        [
          "==",
          "maritime",
          0
        ]
      ],
      "layout": {
        "line-join": "round"
      },
      "paint": {
        "line-dasharray": [
          1.5,
          1.5
        ],
        "line-color": "hsl(0, 0%, 14%)",
        "line-width": {
          "base": 1,
          "stops": [
            [
              3,
              0.5
            ],
            [
              10,
              2
            ]
          ]
        }
      }
    },
    {
      "id": "waterway-label",
      "type": "symbol",
      "source": "composite",
      "source-layer": "waterway_label",
      "minzoom": 12,
      "filter": [
        "in",
        "class",
        "canal",
        "river"
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-font": [
          "DIN Offc Pro Italic",
          "Arial Unicode MS Regular"
        ],
        "symbol-placement": "line",
        "text-max-angle": 30,
        "text-size": {
          "base": 1,
          "stops": [
            [
              13,
              12
            ],
            [
              18,
              16
            ]
          ]
        }
      },
      "paint": {
        "text-halo-width": 0,
        "text-halo-blur": 0,
        "text-color": "hsl(0, 0%, 32%)"
      }
    },
    {
      "id": "poi-scalerank3",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933372896.5967"
      },
      "source": "composite",
      "source-layer": "poi_label",
      "filter": [
        "all",
        [
          "!in",
          "maki",
          "campsite",
          "cemetery",
          "dog-park",
          "garden",
          "golf",
          "park",
          "picnic-site",
          "playground",
          "zoo"
        ],
        [
          "==",
          "scalerank",
          3
        ]
      ],
      "layout": {
        "text-line-height": 1.1,
        "text-size": {
          "base": 1,
          "stops": [
            [
              16,
              11
            ],
            [
              20,
              13
            ]
          ]
        },
        "text-max-angle": 38,
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 1,
        "text-offset": [
          0,
          0
        ],
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01,
        "text-max-width": 8
      },
      "paint": {
        "text-color": "hsl(0, 0%, 60%)",
        "text-halo-color": "#212121",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "poi-parks-scalerank3",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933372896.5967"
      },
      "source": "composite",
      "source-layer": "poi_label",
      "filter": [
        "all",
        [
          "in",
          "maki",
          "campsite",
          "cemetery",
          "dog-park",
          "garden",
          "golf",
          "park",
          "picnic-site",
          "playground",
          "zoo"
        ],
        [
          "==",
          "scalerank",
          3
        ]
      ],
      "layout": {
        "text-line-height": 1.1,
        "text-size": {
          "base": 1,
          "stops": [
            [
              16,
              11
            ],
            [
              20,
              12
            ]
          ]
        },
        "text-max-angle": 38,
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 2,
        "text-offset": [
          0,
          0
        ],
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01,
        "text-max-width": 8
      },
      "paint": {
        "text-halo-blur": 0,
        "text-halo-color": "#212121",
        "text-halo-width": 1,
        "text-color": {
          "base": 1,
          "stops": [
            [
              7,
              "hsl(0, 0%, 47%)"
            ],
            [
              9,
              "hsl(0, 0%, 73%)"
            ]
          ]
        }
      }
    },
    {
      "id": "road-label-small",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933721429.3076"
      },
      "source": "composite",
      "source-layer": "road_label",
      "minzoom": 15,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "!in",
          "class",
          "",
          "ferry",
          "link",
          "motorway",
          "path",
          "pedestrian",
          "primary",
          "secondary",
          "street",
          "street_limited",
          "tertiary",
          "track",
          "trunk"
        ]
      ],
      "layout": {
        "text-size": {
          "base": 1,
          "stops": [
            [
              15,
              10
            ],
            [
              20,
              13
            ]
          ]
        },
        "text-max-angle": 30,
        "symbol-spacing": 500,
        "text-font": [
          "DIN Offc Pro Regular",
          "Arial Unicode MS Regular"
        ],
        "symbol-placement": "line",
        "text-padding": 1,
        "text-rotation-alignment": "map",
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01
      },
      "paint": {
        "text-color": "hsl(0, 0%, 78%)",
        "text-halo-color": "#212121",
        "text-halo-width": 1.25,
        "text-halo-blur": 0
      }
    },
    {
      "id": "road-label-medium",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933721429.3076"
      },
      "source": "composite",
      "source-layer": "road_label",
      "minzoom": 13,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "in",
          "class",
          "",
          "link",
          "pedestrian",
          "street",
          "street_limited"
        ]
      ],
      "layout": {
        "text-size": {
          "base": 1,
          "stops": [
            [
              11,
              10
            ],
            [
              20,
              14
            ]
          ]
        },
        "text-max-angle": 30,
        "symbol-spacing": 500,
        "text-font": [
          "DIN Offc Pro Regular",
          "Arial Unicode MS Regular"
        ],
        "symbol-placement": "line",
        "text-padding": 1,
        "text-rotation-alignment": "map",
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01
      },
      "paint": {
        "text-color": "hsl(0, 0%, 78%)",
        "text-halo-color": "#212121",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "road-label-large",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933721429.3076"
      },
      "source": "composite",
      "source-layer": "road_label",
      "minzoom": 12,
      "filter": [
        "in",
        "class",
        "motorway",
        "primary",
        "secondary",
        "tertiary",
        "trunk"
      ],
      "layout": {
        "text-size": {
          "base": 1,
          "stops": [
            [
              9,
              10
            ],
            [
              20,
              16
            ]
          ]
        },
        "text-max-angle": 30,
        "symbol-spacing": 400,
        "text-font": [
          "DIN Offc Pro Regular",
          "Arial Unicode MS Regular"
        ],
        "symbol-placement": "line",
        "text-padding": 1,
        "text-rotation-alignment": "map",
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01
      },
      "paint": {
        "text-color": "hsl(0, 0%, 78%)",
        "text-halo-color": "#212121",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "poi-scalerank2",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933358918.2366"
      },
      "source": "composite",
      "source-layer": "poi_label",
      "filter": [
        "all",
        [
          "!in",
          "maki",
          "campsite",
          "cemetery",
          "dog-park",
          "garden",
          "golf",
          "park",
          "picnic-site",
          "playground",
          "zoo"
        ],
        [
          "==",
          "scalerank",
          2
        ]
      ],
      "layout": {
        "text-line-height": 1.1,
        "text-size": {
          "base": 1,
          "stops": [
            [
              14,
              11
            ],
            [
              20,
              12
            ]
          ]
        },
        "text-max-angle": 38,
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 2,
        "text-offset": [
          0,
          0.65
        ],
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01,
        "text-max-width": 8
      },
      "paint": {
        "text-color": "hsl(0, 0%, 60%)",
        "text-halo-color": "#212121",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "poi-parks-scalerank2",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933358918.2366"
      },
      "source": "composite",
      "source-layer": "poi_label",
      "filter": [
        "all",
        [
          "in",
          "maki",
          "campsite",
          "cemetery",
          "dog-park",
          "garden",
          "golf",
          "park",
          "picnic-site",
          "playground",
          "zoo"
        ],
        [
          "==",
          "scalerank",
          2
        ]
      ],
      "layout": {
        "text-line-height": 1.1,
        "text-size": {
          "base": 1,
          "stops": [
            [
              14,
              11
            ],
            [
              20,
              12
            ]
          ]
        },
        "text-max-angle": 38,
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 2,
        "text-offset": [
          0,
          0
        ],
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01,
        "text-max-width": 8
      },
      "paint": {
        "text-color": {
          "base": 1,
          "stops": [
            [
              7,
              "hsl(0, 0%, 47%)"
            ],
            [
              9,
              "hsl(0, 0%, 73%)"
            ]
          ]
        },
        "text-halo-color": "#212121",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "water-label",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933808272.805"
      },
      "source": "composite",
      "source-layer": "water_label",
      "minzoom": 5,
      "filter": [
        ">",
        "area",
        10000
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-font": [
          "DIN Offc Pro Italic",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 7,
        "text-size": {
          "base": 1,
          "stops": [
            [
              13,
              13
            ],
            [
              18,
              18
            ]
          ]
        }
      },
      "paint": {
        "text-color": "hsl(0, 0%, 32%)",
        "text-halo-blur": 0
      }
    },
    {
      "id": "poi-parks-scalerank1",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933322393.2852"
      },
      "source": "composite",
      "source-layer": "poi_label",
      "filter": [
        "all",
        [
          "in",
          "maki",
          "campsite",
          "cemetery",
          "dog-park",
          "garden",
          "golf",
          "park",
          "picnic-site",
          "playground",
          "zoo"
        ],
        [
          "<=",
          "scalerank",
          1
        ]
      ],
      "layout": {
        "text-line-height": 1.1,
        "text-size": {
          "base": 1,
          "stops": [
            [
              10,
              11
            ],
            [
              18,
              12
            ]
          ]
        },
        "text-max-angle": 38,
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 2,
        "text-offset": [
          0,
          0
        ],
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01,
        "text-max-width": 8
      },
      "paint": {
        "text-color": {
          "base": 1,
          "stops": [
            [
              7,
              "hsl(0, 0%, 47%)"
            ],
            [
              9,
              "hsl(0, 0%, 73%)"
            ]
          ]
        },
        "text-halo-color": "#212121",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "poi-scalerank1",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444933322393.2852"
      },
      "source": "composite",
      "source-layer": "poi_label",
      "filter": [
        "all",
        [
          "!in",
          "maki",
          "campsite",
          "cemetery",
          "dog-park",
          "garden",
          "golf",
          "park",
          "picnic-site",
          "playground",
          "zoo"
        ],
        [
          "<=",
          "scalerank",
          1
        ]
      ],
      "layout": {
        "text-line-height": 1.1,
        "text-size": {
          "base": 1,
          "stops": [
            [
              10,
              11
            ],
            [
              18,
              12
            ]
          ]
        },
        "text-max-angle": 38,
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 2,
        "text-offset": [
          0,
          0
        ],
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01,
        "text-max-width": 8
      },
      "paint": {
        "text-color": "hsl(0, 0%, 60%)",
        "text-halo-color": "#212121",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "airport-label",
      "type": "symbol",
      "source": "composite",
      "source-layer": "airport_label",
      "minzoom": 10,
      "filter": [
        "<=",
        "scalerank",
        2
      ],
      "layout": {
        "text-line-height": 1.1,
        "text-size": {
          "base": 1,
          "stops": [
            [
              10,
              12
            ],
            [
              18,
              18
            ]
          ]
        },
        "icon-image": {
          "stops": [
            [
              12,
              "{maki}-11"
            ],
            [
              13,
              "{maki}-15"
            ]
          ]
        },
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 2,
        "text-offset": [
          0,
          0.75
        ],
        "text-anchor": "top",
        "text-field": {
          "stops": [
            [
              11,
              "{ref}"
            ],
            [
              14,
              "{name_en}"
            ]
          ]
        },
        "text-letter-spacing": 0.01,
        "text-max-width": 9
      },
      "paint": {
        "text-color": "hsl(0, 0%, 85%)",
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 0.5,
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-islets-archipelago-aboriginal",
      "type": "symbol",
      "source": "composite",
      "source-layer": "place_label",
      "maxzoom": 16,
      "filter": [
        "in",
        "type",
        "aboriginal_lands",
        "archipelago",
        "islet"
      ],
      "layout": {
        "text-line-height": 1.2,
        "text-size": {
          "base": 1,
          "stops": [
            [
              10,
              11
            ],
            [
              18,
              16
            ]
          ]
        },
        "text-max-angle": 38,
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Regular",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 2,
        "text-offset": [
          0,
          0
        ],
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01,
        "text-max-width": 8
      },
      "paint": {
        "text-color": "hsl(0, 0%, 85%)",
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-neighbourhood",
      "type": "symbol",
      "source": "composite",
      "source-layer": "place_label",
      "minzoom": 12,
      "maxzoom": 16,
      "filter": [
        "==",
        "type",
        "neighbourhood"
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-transform": "uppercase",
        "text-letter-spacing": 0.1,
        "text-max-width": 7,
        "text-font": [
          "DIN Offc Pro Regular",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 3,
        "text-size": {
          "base": 1,
          "stops": [
            [
              12,
              11
            ],
            [
              16,
              16
            ]
          ]
        }
      },
      "paint": {
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "text-color": "hsl(0, 0%, 70%)",
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-suburb",
      "type": "symbol",
      "source": "composite",
      "source-layer": "place_label",
      "minzoom": 11,
      "maxzoom": 16,
      "filter": [
        "==",
        "type",
        "suburb"
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-transform": "uppercase",
        "text-font": [
          "DIN Offc Pro Regular",
          "Arial Unicode MS Regular"
        ],
        "text-letter-spacing": 0.15,
        "text-max-width": 7,
        "text-padding": 3,
        "text-size": {
          "base": 1,
          "stops": [
            [
              11,
              11
            ],
            [
              15,
              18
            ]
          ]
        }
      },
      "paint": {
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "text-color": "hsl(0, 0%, 70%)",
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-hamlet",
      "type": "symbol",
      "source": "composite",
      "source-layer": "place_label",
      "minzoom": 10,
      "maxzoom": 16,
      "filter": [
        "==",
        "type",
        "hamlet"
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-font": [
          "DIN Offc Pro Regular",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "base": 1,
          "stops": [
            [
              12,
              11.5
            ],
            [
              15,
              16
            ]
          ]
        }
      },
      "paint": {
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1.25,
        "text-color": "hsl(0, 0%, 85%)",
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-village",
      "type": "symbol",
      "source": "composite",
      "source-layer": "place_label",
      "minzoom": 11,
      "maxzoom": 15,
      "filter": [
        "==",
        "type",
        "village"
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-font": [
          "DIN Offc Pro Regular",
          "Arial Unicode MS Regular"
        ],
        "text-max-width": 7,
        "text-size": {
          "base": 1,
          "stops": [
            [
              10,
              11.5
            ],
            [
              16,
              18
            ]
          ]
        }
      },
      "paint": {
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1.25,
        "text-color": {
          "base": 1,
          "stops": [
            [
              10,
              "hsl(0, 0%, 75%)"
            ],
            [
              11,
              "hsl(0, 0%, 85%)"
            ]
          ]
        },
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-town",
      "type": "symbol",
      "source": "composite",
      "source-layer": "place_label",
      "minzoom": 7,
      "maxzoom": 15,
      "filter": [
        "==",
        "type",
        "town"
      ],
      "layout": {
        "text-size": {
          "base": 1,
          "stops": [
            [
              7,
              11.5
            ],
            [
              15,
              20
            ]
          ]
        },
        "text-font": {
          "base": 1,
          "stops": [
            [
              11,
              [
                "DIN Offc Pro Regular",
                "Arial Unicode MS Regular"
              ]
            ],
            [
              12,
              [
                "DIN Offc Pro Medium",
                "Arial Unicode MS Regular"
              ]
            ]
          ]
        },
        "text-padding": 2,
        "text-offset": [
          0,
          0
        ],
        "text-field": "{name_en}",
        "text-max-width": 7
      },
      "paint": {
        "text-color": {
          "base": 1,
          "stops": [
            [
              10,
              "hsl(0, 0%, 75%)"
            ],
            [
              11,
              "hsl(0, 0%, 85%)"
            ]
          ]
        },
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1.25,
        "icon-opacity": {
          "base": 1,
          "stops": [
            [
              7.99,
              1
            ],
            [
              8,
              0
            ]
          ]
        },
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-islands",
      "type": "symbol",
      "source": "composite",
      "source-layer": "place_label",
      "maxzoom": 16,
      "filter": [
        "==",
        "type",
        "island"
      ],
      "layout": {
        "text-line-height": 1.2,
        "text-size": {
          "base": 1,
          "stops": [
            [
              10,
              11
            ],
            [
              18,
              16
            ]
          ]
        },
        "text-max-angle": 38,
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Regular",
          "Arial Unicode MS Regular"
        ],
        "text-padding": 2,
        "text-offset": [
          0,
          0
        ],
        "text-field": "{name_en}",
        "text-letter-spacing": 0.01,
        "text-max-width": 7
      },
      "paint": {
        "text-color": "hsl(0, 0%, 85%)",
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-city-sm",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444862510685.128"
      },
      "source": "composite",
      "source-layer": "place_label",
      "maxzoom": 14,
      "filter": [
        "all",
        [
          "!in",
          "scalerank",
          0,
          1,
          2,
          3,
          4,
          5
        ],
        [
          "==",
          "type",
          "city"
        ]
      ],
      "layout": {
        "text-size": {
          "base": 1,
          "stops": [
            [
              6,
              12
            ],
            [
              14,
              22
            ]
          ]
        },
        "text-font": {
          "base": 1,
          "stops": [
            [
              7,
              [
                "DIN Offc Pro Regular",
                "Arial Unicode MS Regular"
              ]
            ],
            [
              8,
              [
                "DIN Offc Pro Medium",
                "Arial Unicode MS Regular"
              ]
            ]
          ]
        },
        "text-offset": [
          0,
          0
        ],
        "text-field": "{name_en}",
        "text-max-width": 7
      },
      "paint": {
        "text-color": "hsl(0, 0%, 90%)",
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1.25,
        "icon-opacity": {
          "base": 1,
          "stops": [
            [
              7.99,
              1
            ],
            [
              8,
              0
            ]
          ]
        },
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-city-md-s",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444862510685.128"
      },
      "source": "composite",
      "source-layer": "place_label",
      "maxzoom": 14,
      "filter": [
        "all",
        [
          "in",
          "ldir",
          "E",
          "S",
          "SE",
          "SW"
        ],
        [
          "in",
          "scalerank",
          3,
          4,
          5
        ],
        [
          "==",
          "type",
          "city"
        ]
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-size": {
          "base": 0.9,
          "stops": [
            [
              5,
              12
            ],
            [
              12,
              22
            ]
          ]
        },
        "text-anchor": "top",
        "text-offset": {
          "base": 1,
          "stops": [
            [
              7.99,
              [
                0,
                0.1
              ]
            ],
            [
              8,
              [
                0,
                0
              ]
            ]
          ]
        },
        "text-font": {
          "base": 1,
          "stops": [
            [
              7,
              [
                "DIN Offc Pro Regular",
                "Arial Unicode MS Regular"
              ]
            ],
            [
              8,
              [
                "DIN Offc Pro Medium",
                "Arial Unicode MS Regular"
              ]
            ]
          ]
        },
        "icon-image": "dot-10"
      },
      "paint": {
        "text-halo-width": 1,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-color": "hsl(0, 0%, 90%)",
        "text-halo-blur": 0,
        "icon-opacity": {
          "base": 1,
          "stops": [
            [
              7.99,
              1
            ],
            [
              8,
              0
            ]
          ]
        }
      }
    },
    {
      "id": "place-city-md-n",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444862510685.128"
      },
      "source": "composite",
      "source-layer": "place_label",
      "maxzoom": 14,
      "filter": [
        "all",
        [
          "in",
          "ldir",
          "N",
          "NE",
          "NW",
          "W"
        ],
        [
          "in",
          "scalerank",
          3,
          4,
          5
        ],
        [
          "==",
          "type",
          "city"
        ]
      ],
      "layout": {
        "text-size": {
          "base": 0.9,
          "stops": [
            [
              5,
              12
            ],
            [
              12,
              22
            ]
          ]
        },
        "text-font": {
          "base": 1,
          "stops": [
            [
              7,
              [
                "DIN Offc Pro Regular",
                "Arial Unicode MS Regular"
              ]
            ],
            [
              8,
              [
                "DIN Offc Pro Medium",
                "Arial Unicode MS Regular"
              ]
            ]
          ]
        },
        "text-offset": {
          "base": 1,
          "stops": [
            [
              7.99,
              [
                0,
                -0.25
              ]
            ],
            [
              8,
              [
                0,
                0
              ]
            ]
          ]
        },
        "text-anchor": "bottom",
        "text-field": "{name_en}",
        "text-max-width": 7,
        "icon-image": "dot-10"
      },
      "paint": {
        "text-color": "hsl(0, 0%, 90%)",
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "icon-opacity": {
          "base": 1,
          "stops": [
            [
              7.99,
              1
            ],
            [
              8,
              0
            ]
          ]
        },
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-city-lg-s",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444862510685.128"
      },
      "source": "composite",
      "source-layer": "place_label",
      "minzoom": 1,
      "maxzoom": 14,
      "filter": [
        "all",
        [
          "in",
          "ldir",
          "E",
          "S",
          "SE",
          "SW"
        ],
        [
          "<=",
          "scalerank",
          2
        ],
        [
          "==",
          "type",
          "city"
        ]
      ],
      "layout": {
        "icon-image": "dot-11",
        "text-font": {
          "base": 1,
          "stops": [
            [
              7,
              [
                "DIN Offc Pro Regular",
                "Arial Unicode MS Regular"
              ]
            ],
            [
              8,
              [
                "DIN Offc Pro Medium",
                "Arial Unicode MS Regular"
              ]
            ]
          ]
        },
        "text-offset": {
          "base": 1,
          "stops": [
            [
              7.99,
              [
                0,
                0.15
              ]
            ],
            [
              8,
              [
                0,
                0
              ]
            ]
          ]
        },
        "text-anchor": {
          "base": 1,
          "stops": [
            [
              7,
              "top"
            ],
            [
              8,
              "center"
            ]
          ]
        },
        "text-field": "{name_en}",
        "text-max-width": 7,
        "text-size": {
          "base": 0.9,
          "stops": [
            [
              4,
              12
            ],
            [
              10,
              22
            ]
          ]
        }
      },
      "paint": {
        "text-color": {
          "base": 1,
          "stops": [
            [
              7,
              "hsl(0, 0%, 95%)"
            ],
            [
              9,
              "hsl(0, 0%, 90%)"
            ]
          ]
        },
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "icon-opacity": {
          "base": 1,
          "stops": [
            [
              7.99,
              1
            ],
            [
              8,
              0
            ]
          ]
        },
        "text-halo-blur": 0
      }
    },
    {
      "id": "place-city-lg-n",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444862510685.128"
      },
      "source": "composite",
      "source-layer": "place_label",
      "minzoom": 1,
      "maxzoom": 14,
      "filter": [
        "all",
        [
          "in",
          "ldir",
          "N",
          "NE",
          "NW",
          "W"
        ],
        [
          "<=",
          "scalerank",
          2
        ],
        [
          "==",
          "type",
          "city"
        ]
      ],
      "layout": {
        "icon-image": "dot-11",
        "text-font": {
          "base": 1,
          "stops": [
            [
              7,
              [
                "DIN Offc Pro Regular",
                "Arial Unicode MS Regular"
              ]
            ],
            [
              8,
              [
                "DIN Offc Pro Medium",
                "Arial Unicode MS Regular"
              ]
            ]
          ]
        },
        "text-offset": {
          "base": 1,
          "stops": [
            [
              7.99,
              [
                0,
                -0.25
              ]
            ],
            [
              8,
              [
                0,
                0
              ]
            ]
          ]
        },
        "text-anchor": {
          "base": 1,
          "stops": [
            [
              7,
              "bottom"
            ],
            [
              8,
              "center"
            ]
          ]
        },
        "text-field": "{name_en}",
        "text-max-width": 7,
        "text-size": {
          "base": 0.9,
          "stops": [
            [
              4,
              12
            ],
            [
              10,
              22
            ]
          ]
        }
      },
      "paint": {
        "text-color": {
          "base": 1,
          "stops": [
            [
              7,
              "hsl(0, 0%, 95%)"
            ],
            [
              9,
              "hsl(0, 0%, 90%)"
            ]
          ]
        },
        "text-opacity": 1,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "icon-opacity": {
          "base": 1,
          "stops": [
            [
              7.99,
              1
            ],
            [
              8,
              0
            ]
          ]
        },
        "text-halo-blur": 0
      }
    },
    {
      "id": "marine-label-sm-ln",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856087950.3635"
      },
      "source": "composite",
      "source-layer": "marine_label",
      "minzoom": 3,
      "maxzoom": 10,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          ">=",
          "labelrank",
          4
        ]
      ],
      "layout": {
        "text-line-height": 1.1,
        "text-size": {
          "base": 1,
          "stops": [
            [
              3,
              12
            ],
            [
              6,
              16
            ]
          ]
        },
        "symbol-spacing": {
          "base": 1,
          "stops": [
            [
              4,
              100
            ],
            [
              6,
              400
            ]
          ]
        },
        "text-font": [
          "DIN Offc Pro Italic",
          "Arial Unicode MS Regular"
        ],
        "symbol-placement": "line",
        "text-field": "{name_en}",
        "text-letter-spacing": 0.1,
        "text-max-width": 5
      },
      "paint": {
        "text-color": "hsl(0, 0%, 32%)",
        "text-halo-blur": 0,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)"
      }
    },
    {
      "id": "marine-label-sm-pt",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856087950.3635"
      },
      "source": "composite",
      "source-layer": "marine_label",
      "minzoom": 3,
      "maxzoom": 10,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "Point"
        ],
        [
          ">=",
          "labelrank",
          4
        ]
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-max-width": 5,
        "text-letter-spacing": 0.1,
        "text-line-height": 1.5,
        "text-font": [
          "DIN Offc Pro Italic",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "base": 1,
          "stops": [
            [
              3,
              12
            ],
            [
              6,
              16
            ]
          ]
        }
      },
      "paint": {
        "text-color": "hsl(0, 0%, 32%)",
        "text-halo-blur": 0,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)"
      }
    },
    {
      "id": "marine-label-md-ln",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856087950.3635"
      },
      "source": "composite",
      "source-layer": "marine_label",
      "minzoom": 2,
      "maxzoom": 8,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "in",
          "labelrank",
          2,
          3
        ]
      ],
      "layout": {
        "text-line-height": 1.1,
        "text-size": {
          "base": 1.1,
          "stops": [
            [
              2,
              12
            ],
            [
              5,
              20
            ]
          ]
        },
        "symbol-spacing": 250,
        "text-font": [
          "DIN Offc Pro Italic",
          "Arial Unicode MS Regular"
        ],
        "symbol-placement": "line",
        "text-field": "{name_en}",
        "text-letter-spacing": 0.15,
        "text-max-width": 5
      },
      "paint": {
        "text-color": "hsl(0, 0%, 32%)",
        "text-halo-blur": 0,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)"
      }
    },
    {
      "id": "marine-label-md-pt",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856087950.3635"
      },
      "source": "composite",
      "source-layer": "marine_label",
      "minzoom": 2,
      "maxzoom": 8,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "Point"
        ],
        [
          "in",
          "labelrank",
          2,
          3
        ]
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-max-width": 5,
        "text-letter-spacing": 0.15,
        "text-line-height": 1.5,
        "text-font": [
          "DIN Offc Pro Italic",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "base": 1.1,
          "stops": [
            [
              2,
              14
            ],
            [
              5,
              20
            ]
          ]
        }
      },
      "paint": {
        "text-color": "hsl(0, 0%, 32%)",
        "text-halo-blur": 0,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)"
      }
    },
    {
      "id": "marine-label-lg-ln",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856087950.3635"
      },
      "source": "composite",
      "source-layer": "marine_label",
      "minzoom": 1,
      "maxzoom": 4,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "LineString"
        ],
        [
          "==",
          "labelrank",
          1
        ]
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-max-width": 4,
        "text-letter-spacing": 0.25,
        "text-line-height": 1.1,
        "symbol-placement": "line",
        "text-font": [
          "DIN Offc Pro Italic",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "base": 1,
          "stops": [
            [
              1,
              14
            ],
            [
              4,
              30
            ]
          ]
        }
      },
      "paint": {
        "text-color": "hsl(0, 0%, 32%)",
        "text-halo-blur": 0,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)"
      }
    },
    {
      "id": "marine-label-lg-pt",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856087950.3635"
      },
      "source": "composite",
      "source-layer": "marine_label",
      "minzoom": 1,
      "maxzoom": 4,
      "filter": [
        "all",
        [
          "==",
          "$type",
          "Point"
        ],
        [
          "==",
          "labelrank",
          1
        ]
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-max-width": 4,
        "text-letter-spacing": 0.25,
        "text-line-height": 1.5,
        "text-font": [
          "DIN Offc Pro Italic",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "base": 1,
          "stops": [
            [
              1,
              14
            ],
            [
              4,
              30
            ]
          ]
        }
      },
      "paint": {
        "text-color": "hsl(0, 0%, 32%)",
        "text-halo-blur": 0,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)"
      }
    },
    {
      "id": "state-label-sm",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856151690.9143"
      },
      "source": "composite",
      "source-layer": "state_label",
      "minzoom": 3,
      "maxzoom": 9,
      "filter": [
        "<",
        "area",
        20000
      ],
      "layout": {
        "text-size": {
          "base": 1,
          "stops": [
            [
              6,
              10
            ],
            [
              9,
              14
            ]
          ]
        },
        "text-transform": "uppercase",
        "text-font": [
          "DIN Offc Pro Bold",
          "Arial Unicode MS Bold"
        ],
        "text-field": {
          "base": 1,
          "stops": [
            [
              0,
              "{abbr}"
            ],
            [
              6,
              "{name_en}"
            ]
          ]
        },
        "text-letter-spacing": 0.15,
        "text-max-width": 5
      },
      "paint": {
        "text-opacity": 1,
        "text-color": "hsl(0, 0%, 50%)",
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "state-label-md",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856151690.9143"
      },
      "source": "composite",
      "source-layer": "state_label",
      "minzoom": 3,
      "maxzoom": 8,
      "filter": [
        "all",
        [
          "<",
          "area",
          80000
        ],
        [
          ">=",
          "area",
          20000
        ]
      ],
      "layout": {
        "text-size": {
          "base": 1,
          "stops": [
            [
              5,
              10
            ],
            [
              8,
              16
            ]
          ]
        },
        "text-transform": "uppercase",
        "text-font": [
          "DIN Offc Pro Bold",
          "Arial Unicode MS Bold"
        ],
        "text-field": {
          "base": 1,
          "stops": [
            [
              0,
              "{abbr}"
            ],
            [
              5,
              "{name_en}"
            ]
          ]
        },
        "text-letter-spacing": 0.15,
        "text-max-width": 6
      },
      "paint": {
        "text-opacity": 1,
        "text-color": "hsl(0, 0%, 50%)",
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "state-label-lg",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856151690.9143"
      },
      "source": "composite",
      "source-layer": "state_label",
      "minzoom": 3,
      "maxzoom": 7,
      "filter": [
        ">=",
        "area",
        80000
      ],
      "layout": {
        "text-size": {
          "base": 1,
          "stops": [
            [
              4,
              10
            ],
            [
              7,
              18
            ]
          ]
        },
        "text-transform": "uppercase",
        "text-font": [
          "DIN Offc Pro Bold",
          "Arial Unicode MS Bold"
        ],
        "text-padding": 1,
        "text-field": {
          "base": 1,
          "stops": [
            [
              0,
              "{abbr}"
            ],
            [
              4,
              "{name_en}"
            ]
          ]
        },
        "text-letter-spacing": 0.15,
        "text-max-width": 6
      },
      "paint": {
        "text-opacity": 1,
        "text-color": "hsl(0, 0%, 50%)",
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-halo-width": 1,
        "text-halo-blur": 0
      }
    },
    {
      "id": "country-label-sm",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856144497.7825"
      },
      "source": "composite",
      "source-layer": "country_label",
      "minzoom": 1,
      "maxzoom": 10,
      "filter": [
        ">=",
        "scalerank",
        5
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-max-width": 6,
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "base": 0.9,
          "stops": [
            [
              5,
              14
            ],
            [
              9,
              22
            ]
          ]
        }
      },
      "paint": {
        "text-halo-width": 1.25,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-color": "hsl(0, 0%, 45%)",
        "text-halo-blur": 0
      }
    },
    {
      "id": "country-label-md",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856144497.7825"
      },
      "source": "composite",
      "source-layer": "country_label",
      "minzoom": 1,
      "maxzoom": 8,
      "filter": [
        "in",
        "scalerank",
        3,
        4
      ],
      "layout": {
        "text-field": {
          "base": 1,
          "stops": [
            [
              0,
              "{code}"
            ],
            [
              2,
              "{name_en}"
            ]
          ]
        },
        "text-max-width": 6,
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "base": 1,
          "stops": [
            [
              3,
              10
            ],
            [
              8,
              24
            ]
          ]
        }
      },
      "paint": {
        "text-halo-width": 1.25,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-color": "hsl(0, 0%, 45%)",
        "text-halo-blur": 0
      }
    },
    {
      "id": "country-label-lg",
      "type": "symbol",
      "metadata": {
        "mapbox:group": "1444856144497.7825"
      },
      "source": "composite",
      "source-layer": "country_label",
      "minzoom": 1,
      "maxzoom": 7,
      "filter": [
        "in",
        "scalerank",
        1,
        2
      ],
      "layout": {
        "text-field": "{name_en}",
        "text-max-width": {
          "base": 1,
          "stops": [
            [
              0,
              5
            ],
            [
              3,
              6
            ]
          ]
        },
        "text-font": [
          "DIN Offc Pro Medium",
          "Arial Unicode MS Regular"
        ],
        "text-size": {
          "base": 1,
          "stops": [
            [
              1,
              10
            ],
            [
              6,
              24
            ]
          ]
        }
      },
      "paint": {
        "text-halo-width": 1.25,
        "text-halo-color": "hsla(0, 0%, 10%, 0.75)",
        "text-color": "hsl(0, 0%, 45%)",
        "text-halo-blur": 0
      }
    }
  ],
  "created": 0,
  "modified": 0,
  "owner": "mapbox",
  "id": "dark-v9",
  "draft": false
}
