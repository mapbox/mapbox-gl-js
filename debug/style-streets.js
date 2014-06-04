var style = {
  "version": "1",
  "buckets": {
    "satellite": {
      "filter": {"source": "satellite"}
    },
    "park": {
      "filter": {"source": "mapbox streets", "layer": "landuse", "class": "park"},
      "fill": true
    },
    "wood": {
      "filter": {"source": "mapbox streets", "layer": "landuse", "class": "wood"},
      "fill": true
    },
    "water": {
      "filter": {"source": "mapbox streets", "layer": "water"},
      "fill": true
    },
    "waterway": {
      "filter": {"source": "mapbox streets", "layer": "waterway"},
      "line": true
    },
    "tunnel_large": {
      "filter": {"source": "mapbox streets", "layer": "tunnel", "class": ["motorway", "main"]},
      "line": true,
      "min-zoom": 14
    },
    "tunnel_regular": {
      "filter": {"source": "mapbox streets", "layer": "tunnel", "class": ["street", "street_limited"]},
      "line": true,
      "min-zoom": 15.5
    },
    "road_large": {
      "filter": {"source": "mapbox streets", "layer": "road", "class": ["motorway", "main"]},
      "line": true,
      "min-zoom": 13,
      "line-cap": "round",
      "line-join": "bevel"
    },
    "road_regular": {
      "filter": {"source": "mapbox streets", "layer": "road", "class": "street"},
      "line": true,
      "min-zoom": 15.5,
      "line-cap": "round",
      "line-join": "bevel"
    },
    "road_limited": {
      "filter": {"source": "mapbox streets", "layer": "road", "class": "street_limited"},
      "line": true,
      "line-cap": "round",
      "line-join": "butt",
      "line-round-limit": 0.7
    },
    "path": {
      "filter": {"source": "mapbox streets", "layer": "road", "class": "path"},
      "line": true,
      "line-cap": "round",
      "line-join": "bevel"
    },
    "rail": {
      "filter": {"source": "mapbox streets", "layer": "road", "class": "major_rail"},
      "line": true,
      "line-cap": "round",
      "line-join": "bevel"
    },
    "tunnel_rail": {
      "filter": {"source": "mapbox streets", "layer": "tunnel", "class": ["minor_rail", "major_rail"]},
      "line": true
    },
    "route": {
      "filter": {"source": "geojson"},
      "line": true
    },
    "road_markers": {
      "filter": {"source": "mapbox streets", "layer": "road", "oneway": 1, "feature_type": "line"},
      "min-zoom": 15.5,
      "point": true,
      "point-image": "bicycle-12",
      "point-spacing": 200
    },
    "building": {
      "filter": {"source": "mapbox streets", "layer": "building"},
      "fill": true
    },
    "borders": {
      "filter": {"source": "mapbox streets", "layer": "admin"},
      "line": true
    },
    "bridge_large": {
      "filter": {"source": "mapbox streets", "layer": "bridge", "class": ["motorway", "main"]},
      "line": true,
      "min-zoom": 14
    },
    "park_poi": {
      "filter": {"source": "mapbox streets", "layer": "poi_label", "maki": "park"},
      "point": true
    },
    "country_label": {
      "filter": {"source": "mapbox streets", "layer": "country_label", "feature_type": "point"},
      "text": true,
      "text-field": "{{name}}",
      "text-font": "Open Sans Regular, Arial Unicode MS Regular",
      "text-max-size": 16,
      "text-path": "horizontal",
      "text-padding": 10
    },
    "place_label": {
      "filter": {"source": "mapbox streets", "layer": "place_label", "feature_type": "point"},
      "text": true,
      "text-field": "{{name}}",
      "text-font": "Open Sans Semibold, Arial Unicode MS Regular",
      "text-max-size": 18,
      "text-path": "horizontal",
      "text-max-width": 2, // em
      "text-line-height": 1.4, // em
      "text-always-visible": true
    },
    "road_label": {
      "filter": {"source": "mapbox streets", "layer": "road_label", "feature_type": "line"},
      "text": true,
      "text-field": "{{name}}",
      "text-font": "Open Sans Regular, Arial Unicode MS Regular",
      "text-max-size": 12,
      "text-path": "curve",
      "text-min-dist": 250,
      "text-max-angle": 1.04
    },
    "poi": {
      "filter": {"source": "mapbox streets", "layer": "poi_label"},
      "point": true,
      "point-size": [12, 12],
      "point-image": "{{maki}}-12"
    },
  },
  "layers": [{
    "id": "background"
  }, {
    "id": "satellite",
    "bucket": "satellite"
  }, {
    "id": "park",
    "bucket": "park"
  }, {
    "id": "wood",
    "bucket": "wood"
  }, {
    "id": "water",
    "bucket": "water"
  }, {
    "id": "waterway",
    "bucket": "waterway"
  }, {
    "id": "roads",
    "layers": [{
      "id": "tunnel_large_casing",
      "bucket": "tunnel_large"
    }, {
      "id": "tunnel_regular_casing",
      "bucket": "tunnel_regular"
    }, {
      "id": "tunnel_large",
      "bucket": "tunnel_large"
    }, {
      "id": "tunnel_regular",
      "bucket": "tunnel_regular"
    }, {
      "id": "road_large_casing",
      "bucket": "road_large"
    }, {
      "id": "road_regular_casing",
      "bucket": "road_regular"
    }, {
      "id": "road_limited",
      "bucket": "road_limited"
    }, {
      "id": "road_large",
      "bucket": "road_large"
    }, {
      "id": "road_regular",
      "bucket": "road_regular"
    }, {
      "id": "path",
      "bucket": "path"
    }, {
      "id": "rail",
      "bucket": "rail"
    }, {
      "id": "tunnel_rail",
      "bucket": "tunnel_rail"
    }]
  }, {
    "id": "route",
    "bucket": "route"
  }, {
    "id": "road_markers",
    "bucket": "road_markers"
  }, {
    "id": "building",
    "bucket": "building"
  }, {
    "id": "borders",
    "bucket": "borders"
  }, {
    "id": "bridge_large_casing",
    "bucket": "bridge_large"
  }, {
    "id": "bridge_large",
    "bucket": "bridge_large"
  }, {
    "id": "park_poi",
    "bucket": "park_poi"
  }, {
    "id": "poi",
    "bucket": "poi"
  }, {
    "id": "country_label",
    "bucket": "country_label"
  }, {
    "id": "place_label",
    "bucket": "place_label"
  }, {
    "id": "road_label",
    "bucket": "road_label"
  }],
  "constants": {
    "land": "#e8e0d8",
    "water": "#73b6e6",
    "park": "#c8df9f",
    "road": "#fefefe",
    "border": "#6d90ab",
    "wood": "#33AA66",
    "building": "#d9ccbe",
    "building_outline": "#d2c6b9",
    "text": "#000000",
    "satellite_brightness_low": 0,
    "satellite_brightness_high": 1,
    "satellite_saturation": 0,
    "satellite_spin": 0,
    "satellite_contrast": 0,
    "road_blur": 1,
    "stroke_width": 0.25
  },
  "styles": {
    "default": {
      "route": {
        "line-color": "#EC8D8D",
        "line-width": {
          "fn": "exponential",
          "z": 9,
          "val": 1,
          "slope": 0.21,
          "min": 4
        }
      },
      "background": {
        "fill-color": "land",
        "transition-fill-color": {
          "duration": 500,
          "delay": 0
        }
      },
      "park": {
        "fill-color": "park"
      },
      "wood": {
        "fill-color": "wood",
        "fill-opacity": 0.08
      },
      "water": {
        "fill-color": "water"
      },
      "waterway": {
        "line-color": "water",
        "line-width": {
          "fn": "linear",
          "z": 9,
          "val": 1,
          "slope": 0.5,
          "min": 0.5
        }
      },
      "tunnel_large_casing": {
        "line-color": [0, 0, 0, 0.5],
        "line-width": 1,
        "line-offset": {
          "fn": "exponential",
          "z": 9,
          "val": -1,
          "slope": 0.2,
          "min": 1
        }
      },
      "tunnel_regular_casing": {
        "line-color": [0, 0, 0, 0.5],
        "line-width": 1,
        "line-offset": {
          "fn": "exponential",
          "z": 11,
          "val": 0.5,
          "slope": 0.2,
          "min": 1
        }
      },
      "tunnel_large": {
        "line-color": [1, 1, 1, 0.5],
        "line-width": {
          "fn": "exponential",
          "z": 9,
          "val": -1,
          "slope": 0.2,
          "min": 1
        }
      },
      "tunnel_regular": {
        "line-color": [1, 1, 1, 0.5],
        "line-width": {
          "fn": "exponential",
          "z": 11,
          "val": -1,
          "slope": 0.2,
          "min": 1
        }
      },
      "roads": {
        "opacity": 1,
        "transition-opacity": {
          "duration": 500,
          "delay": 0
        }
      },
      "road_large_casing": {
        "line-color": [0.6, 0.6, 0.6, 1],
        "line-width": {
          "fn": "exponential",
          "z": 9,
          "val": 1,
          "slope": 0.21,
          "min": 4
        },
        "line-opacity": {
          "fn": "linear",
          "z": 14,
          "val": 0,
          "slope": 1,
          "min": 0,
          "max": 1
        },
        "transition-line-width": {
          "duration": 500,
          "delay": 0
        },
        "line-blur": "road_blur"
      },
      "road_regular_casing": {
        "line-color": [0.6, 0.6, 0.6, 1],
        "line-width": {
          "fn": "exponential",
          "z": 10,
          "val": 0.5,
          "slope": 0.2,
          "min": 1
        },
        "line-opacity": {
          "fn": "linear",
          "z": 15.5,
          "val": 0,
          "slope": 1,
          "min": 0,
          "max": 1
        },
        "line-blur": "road_blur"
      },
      "road_limited": {
        "line-dasharray": [10, 2],
        "line-color": "road",
        "line-blur": "road_blur",
        "line-width": {
          "fn": "exponential",
          "z": 10,
          "val": -1,
          "slope": 0.2,
          "min": 1
        }
      },
      "road_large": {
        "line-color": "road",
        "line-blur": "road_blur",
        "line-width": {
          "fn": "exponential",
          "z": 9,
          "val": -1,
          "slope": 0.2,
          "min": 1
        }
      },
      "road_regular": {
        "line-color": "road",
        "line-blur": "road_blur",
        "line-width": {
          "fn": "exponential",
          "z": 10,
          "val": -1,
          "slope": 0.2,
          "min": 1
        }
      },
      "path": {
        "line-color": [1, 1, 1, 1],
        "line-dasharray": [2, 2],
        "line-width": 2
      },
      "rail": {
        "line-color": [0.3, 0.3, 0.3, 0.8],
        "line-dasharray": [2, 1],
        "line-width": 3
      },
      "tunnel_rail": {
        "line-color": [0.3, 0.3, 0.3, 0.3],
        "line-dasharray": [2, 1],
        "line-width": 3
      },
      "road_markers": {
        "point-alignment": "line"
      },
      "building": {
        "fill-color": "building",
        "transition-fill-opacity": {
          "duration": 500,
          "delay": 500
        },
        "fill-opacity": {
          "fn": "linear",
          "z": 14,
          "val": 0,
          "slope": 1,
          "min": 0,
          "max": 1
        },
        "stroke-color": "building_outline"
      },
      "borders": {
        "line-color": [0, 0, 0, 0.3],
        "line-width": 1
      },
      "bridge_large_casing": {
        "line-color": [0, 0, 0, 0.4],
        "line-width": {
          "fn": "exponential",
          "z": 9,
          "val": 1.5,
          "slope": 0.2,
          "min": 1
        }
      },
      "bridge_large": {
        "line-color": "road",
        "line-width": {
          "fn": "exponential",
          "z": 9,
          "val": -1,
          "slope": 0.2,
          "min": 1
        }
      },
      "park_poi": {
        "point-color": "green"
      },
      "poi": {
        "point-alignment": "screen"
      },
      "country_label": {
        "text-halo-color": [1, 1, 1, 0.7],
        "text-halo-width": "stroke_width",
        "text-color": "text"
      },
      "place_label": {
        "text-halo-color": [1, 1, 1, 0.7],
        "text-halo-width": "stroke_width",
        "text-color": "text"
      },
      "road_label": {
        "text-color": "text",
        "text-halo-color": [1, 1, 1, 0.7],
        "text-halo-width": "stroke_width",
        "text-size": {
          "fn": "exponential",
          "z": 14,
          "val": 8,
          "slope": 1,
          "min": 8,
          "max": 12
        }
      }
    },
    "satellite": {
      "background": {
        "transition-fill-color": {
          "duration": 500,
          "delay": 500
        },
        "fill-opacity": 0,
        "fill-color": [1, 0, 0, 0]
      },
      "roads": {
        "transition-opacity": {
          "duration": 500,
          "delay": 500
        },
        "opacity": 0.5
      },
      "building": {
        "fill-opacity": 0,
        "transition-fill-opacity": {
          "duration": 500,
          "delay": 0
        }
      },
      "park": {
        "transition-fill-color": {
          "duration": 500,
          "delay": 0
        },
        "fill-color": [0, 0, 0, 0]
      },
      "water": {
        "fill-opacity": 0
      },
      "road_large": {
        "transition-line-width": {
          "duration": 500,
          "delay": 1000
        },
        "line-width": {
          "fn": "exponential",
          "z": 10,
          "val": -1,
          "slope": 0.2,
          "min": 1
        }
      },
      "road_large_casing": {
        "line-width": {
          "fn": "exponential",
          "z": 10,
          "val": 1,
          "slope": 0.21,
          "min": 4
        },
        "transition-line-width": {
          "duration": 500,
          "delay": 1000
        }
      },
      "road_regular_casing": {
        "transition-line-width": {
          "duration": 500,
          "delay": 1000
        },
        "line-width": {
          "fn": "exponential",
          "z": 11,
          "val": 0.5,
          "slope": 0.2,
          "min": 1
        }
      },
      "road_regular": {
        "transition-line-width": {
          "duration": 500,
          "delay": 1000
        },
        "line-width": {
          "fn": "exponential",
          "z": 11,
          "val": -1,
          "slope": 0.2,
          "min": 1
        }
      },
      "satellite": {
        "raster-brightness-low": "satellite_brightness_low",
        "raster-brightness-high": "satellite_brightness_high",
        "raster-saturation": "satellite_saturation",
        "raster-spin": "satellite_spin",
        "raster-contrast": "satellite_contrast"
      }
    },
    "test": {
      "road_large_casing": {
        "line-width": {
          "fn": "exponential",
          "z": 8,
          "val": 1,
          "slope": 0.21,
          "min": 4
        },
        "line-color": [1, 0, 0, 1],
        "transition-line-width": {
          "duration": 500,
          "delay": 0
        },
        "transition-line-color": {
          "duration": 2000,
          "delay": 500
        }
      }
    }
  },
  "sprite": "img/sprite"
};
