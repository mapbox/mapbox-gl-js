var style = {
  "version": "1",
  "buckets": {
    "waterway_other": {
      "filter": {"source": "osm-bright", "layer": "waterway", "type": ["ditch", "drain"]},
      "line": true,
      "line-cap": "round"
    },
    "waterway_river": {
      "filter": {"source": "osm-bright", "layer": "waterway", "type": "river"},
      "line": true,
      "line-cap": "round"
    },
    "waterway_stream_canal": {
      "filter": {"source": "osm-bright", "layer": "waterway", "type": ["stream", "canal"]},
      "line": true,
      "line-cap": "round"
    },
    "landuse_park": {
      "filter": {"source": "osm-bright", "layer": "landuse", "class": "park"},
      "fill": true
    },
    "landuse_cemetary": {
      "filter": {"source": "osm-bright", "layer": "landuse", "class": "cemetary"},
      "fill": true
    },
    "landuse_hospital": {
      "filter": {"source": "osm-bright", "layer": "landuse", "class": "hospital"},
      "fill": true
    },
    "landuse_school": {
      "filter": {"source": "osm-bright", "layer": "landuse", "class": "school"},
      "fill": true
    },
    "landuse_wood": {
      "filter": {"source": "osm-bright", "layer": "landuse", "class": "wood"},
      "fill": true
    },
    "water": {
      "filter": {"source": "osm-bright", "layer": "water"},
      "fill": true
    },
    "aeroway_fill": {
      "filter": {"source": "osm-bright", "layer": "aeroway"},
      "fill": true,
      "min-zoom": 12
    },
    "aeroway_runway": {
      "filter": {"source": "osm-bright", "layer": "aeroway", "type": "runway"},
      "line": true,
      "min-zoom": 12
    },
    "aeroway_taxiway": {
      "filter": {"source": "osm-bright", "layer": "aeroway", "type": "taxiway"},
      "line": true,
      "min-zoom": 12
    },
    "building": {
      "filter": {"source": "osm-bright", "layer": "building"},
      "fill": true
    },
    "tunnel_motorway_link": {
      "filter": {"source": "osm-bright", "layer": "tunnel", "class": "motorway_link"},
      "line": true,
      "line-cap": "round",
      "line-join": "round"
    },
    "tunnel_motorway": {
      "filter": {"source": "osm-bright", "layer": "tunnel", "class": "motorway"},
      "line": true,
      "line-cap": "round",
      "line-join": "round"
    },
    "tunnel_path": {
      "filter": {"source": "osm-bright", "layer": "tunnel", "class": "path"}
    },
    "tunnel_major_rail": {
      "filter": {"source": "osm-bright", "layer": "tunnel", "class": "major_rail"},
      "line": true
    },
    "tunnel_service": {
      "filter": {"source": "osm-bright", "layer": "tunnel", "class": "service"},
      "line": true,
      "min-zoom": 15,
      "line-cap": "round",
      "line-join": "round"
    },
    "tunnel_main": {
      "filter": {"source": "osm-bright", "layer": "tunnel", "class": "main"},
      "line": true,
      "line-cap": "round",
      "line-join": "round"
    },
    "tunnel_street": {
      "filter": {"source": "osm-bright", "layer": "tunnel", "class": ["street", "street_limited"]},
      "line": true,
      "min-zoom": 12,
      "line-join": "round"
    },
    "road_motorway_link": {
      "filter": {"source": "osm-bright", "layer": "road", "class": "motorway_link"},
      "line": true,
      "line-cap": "round",
      "line-join": "round"
    },
    "road_service": {
      "filter": {"source": "osm-bright", "layer": "road", "class": "service"},
      "line": true,
      "min-zoom": 15,
      "line-cap": "round",
      "line-join": "round"
    },
    "road_main": {
      "filter": {"source": "osm-bright", "layer": "road", "class": "main"},
      "line": true,
      "line-cap": "round",
      "line-join": "round"
    },
    "road_street": {
      "filter": {"source": "osm-bright", "layer": "road", "class": ["street", "street_limited"]},
      "line": true,
      "min-zoom": 12,
      "line-cap": "round",
      "line-join": "round"
    },
    "road_motorway": {
      "filter": {"source": "osm-bright", "layer": "road", "class": "motorway"},
      "line": true,
      "line-cap": "round",
      "line-join": "round"
    },
    "bridge_service": {
      "filter": {"source": "osm-bright", "layer": "bridge", "class": "service"},
      "line": true,
      "min-zoom": 15,
      "line-join": "round"
    },
    "bridge_main": {
      "filter": {"source": "osm-bright", "layer": "bridge", "class": "main"},
      "line": true,
      "line-join": "round"
    },
    "bridge_street": {
      "filter": {"source": "osm-bright", "layer": "bridge", "class": ["street", "street_limited"]},
      "line": true,
      "min-zoom": 12,
      "line-join": "round"
    },
    "bridge_motorway_link": {
      "filter": {"source": "osm-bright", "layer": "bridge", "class": "motorway_link"},
      "line": true,
      "line-join": "round"
    },
    "bridge_motorway": {
      "filter": {"source": "osm-bright", "layer": "bridge", "class": "motorway"},
      "line": true,
      "line-join": "round"
    },
    "road_path": {
      "filter": {"source": "osm-bright", "layer": "road", "class": "path"},
      "line": true,
      "min-zoom": 15
    },
    "road_major_rail": {
      "filter": {"source": "osm-bright", "layer": "road", "class": "major_rail"},
      "line": true
    },
    "bridge_path": {
      "filter": {"source": "osm-bright", "layer": "bridge", "class": "path"},
      "line": true,
      "min-zoom": 15
    },
    "bridge_major_rail": {
      "filter": {"source": "osm-bright", "layer": "bridge", "class": "major_rail"},
      "line": true
    },
    "admin_level_3": {
      "filter": {"source": "osm-bright", "layer": "admin", "admin_level": [3, 4, 5]},
      "line": true,
      "line-join": "round"
    },
    "admin_level_2": {
      "filter": {"source": "osm-bright", "layer": "admin", "admin_level": 2},
      "line": true,
      "line-cap": "round",
      "line-join": "round"
    },
    "admin_maritime": {
      "filter": {"source": "osm-bright", "layer": "admin", "maritime": "1"},
      "line": true,
      "line-join": "round"
    },
    "country_label_line": {
      "filter": {"source": "osm-bright", "layer": "country_label_line"},
      "line": true,
      "min-zoom": 3
    },
    "country_label": {
      "filter": {"source": "osm-bright", "layer": "country_label", "feature_type": "point"},
      "text": true,
      "min-zoom": 3,
      "text-field": "name",
      "text-max-size": 13,
      "text-path": "horizontal"
    },
    "marin_label_1": {
      "filter": {"source": "osm-bright", "layer": "marin_label", "labelrank": 1, "feature_type": "line"},
      "text": true,
      "text-field": "name",
      "text-max-size": 22,
      "text-path": "curve"
    },
    "marin_label_2": {
      "filter": {"source": "osm-bright", "layer": "marin_label", "labelrank": 2, "feature_type": "line"},
      "text": true,
      "text-field": "name",
      "text-max-size": 16,
      "text-path": "curve"
    },
    "marin_label_3": {
      "filter": {"source": "osm-bright", "layer": "marin_label", "labelrank": 3, "feature_type": "line"},
      "text": true,
      "text-field": "name",
      "text-max-size": 14,
      "text-path": "curve"
    },
    "place_label_city_point": {
      "filter": {"source": "osm-bright", "layer": "place_label", "type": "city"},
      "point": true
    },
    "place_label_city": {
      "filter": {"source": "osm-bright", "layer": "place_label", "type": "city", "feature_type": "point"},
      "text": true,
      "text-field": "name",
      "text-max-size": 24,
      "text-path": "horizontal"
    },
    "place_label_town": {
      "filter": {"source": "osm-bright", "layer": "place_label", "type": "town", "feature_type": "point"},
      "text": true,
      "text-field": "name",
      "text-max-size": 24,
      "text-path": "horizontal"
    },
    "place_label_village": {
      "filter": {
        "source": "osm-bright",
        "layer": "place_label",
        "type": "village",
        "feature_type": "point"
      },
      "text": true,
      "text-field": "name",
      "text-max-size": 22,
      "text-path": "horizontal"
    },
    "place_label_other": {
      "filter": {
        "source": "osm-bright",
        "layer": "place_label",
        "type": ["hamlet", "suburb", "neighbourhood"],
        "feature_type": "point"
      },
      "text": true,
      "text-field": "name",
      "text-max-size": 14,
      "text-path": "horizontal"
    },
    "road_label": {
      "filter": {"source": "osm-bright", "layer": "road_label", "feature_type": "line"},
      "text": true,
      "text-field": "name",
      "text-max-size": 13,
      "text-path": "curve",
      "text-padding": 2
    },
    "poi_label": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "feature_type": "point"},
      "text": true,
      "text-field": "name",
      "text-max-size": 12,
      "text-path": "horizontal",
      "text-padding": 2
    },
    "water_label": {
      "filter": {"source": "osm-bright", "layer": "water_label", "feature_type": "point"},
      "text": true,
      "text-field": "name",
      "text-max-size": 12,
      "text-path": "horizontal"
    },
    "poi_airport": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "airport"},
      "point": true,
      "point-size": [12, 12]
    },
    "poi_rail": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "rail"},
      "point": true,
      "point-size": [12, 12]
    },
    "poi_bus": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "bus"},
      "point": true,
      "point-size": [12, 12]
    },
    "poi_fire_station": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "fire-station"},
      "point": true,
      "point-size": [12, 12]
    },
    "poi_restaurant": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "restaurant"},
      "point": true,
      "point-size": [12, 12]
    },
    "poi_park": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "park"},
      "point": true,
      "point-size": [12, 12]
    },
    "poi_hospital": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "hospital"},
      "point": true,
      "point-size": [12, 12]
    },
    "poi_playground": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "playground"},
      "point": true,
      "point-size": [12, 12]
    },
    "poi_cafe": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "cafe"},
      "point": true,
      "point-size": [12, 12]
    },
    "poi_beer": {
      "filter": {"source": "osm-bright", "layer": "poi_label", "maki": "beer"},
      "point": true,
      "point-size": [12, 12]
    }
  },
  "layers": [{
    "id": "background"
  }, {
    "id": "waterway_other",
    "bucket": "waterway_other"
  }, {
    "id": "waterway_river",
    "bucket": "waterway_river"
  }, {
    "id": "waterway_stream_canal",
    "bucket": "waterway_stream_canal"
  }, {
    "id": "landuse_park",
    "bucket": "landuse_park"
  }, {
    "id": "landuse_cemetary",
    "bucket": "landuse_cemetary"
  }, {
    "id": "landuse_hospital",
    "bucket": "landuse_hospital"
  }, {
    "id": "landuse_school",
    "bucket": "landuse_school"
  }, {
    "id": "landuse_wood",
    "bucket": "landuse_wood"
  }, {
    "id": "water",
    "bucket": "water"
  }, {
    "id": "water_offset",
    "bucket": "water"
  }, {
    "id": "aeroway_fill",
    "bucket": "aeroway_fill"
  }, {
    "id": "aeroway_runway",
    "bucket": "aeroway_runway"
  }, {
    "id": "aeroway_taxiway",
    "bucket": "aeroway_taxiway"
  }, {
    "id": "building_shadow",
    "bucket": "building"
  }, {
    "id": "building",
    "bucket": "building"
  }, {
    "id": "building_wall",
    "bucket": "building"
  }, {
    "id": "tunnel_motorway_link_casing",
    "bucket": "tunnel_motorway_link"
  }, {
    "id": "tunnel_motorway_casing",
    "bucket": "tunnel_motorway"
  }, {
    "id": "tunnel_motorway_link",
    "bucket": "tunnel_motorway_link"
  }, {
    "id": "tunnel_motorway",
    "bucket": "tunnel_motorway"
  }, {
    "id": "tunnel_path",
    "bucket": "tunnel_path"
  }, {
    "id": "tunnel_major_rail",
    "bucket": "tunnel_major_rail"
  }, {
    "id": "tunnel_major_rail_hatching",
    "bucket": "tunnel_major_rail"
  }, {
    "id": "tunnel_service_casing",
    "bucket": "tunnel_service"
  }, {
    "id": "tunnel_service",
    "bucket": "tunnel_service"
  }, {
    "id": "tunnel_main_casing",
    "bucket": "tunnel_main"
  }, {
    "id": "tunnel_street_casing",
    "bucket": "tunnel_street"
  }, {
    "id": "tunnel_street",
    "bucket": "tunnel_street"
  }, {
    "id": "tunnel_main",
    "bucket": "tunnel_main"
  }, {
    "id": "road_motorway_link_casing",
    "bucket": "road_motorway_link"
  }, {
    "id": "road_service_casing",
    "bucket": "road_service"
  }, {
    "id": "road_main_casing",
    "bucket": "road_main"
  }, {
    "id": "road_street_casing",
    "bucket": "road_street"
  }, {
    "id": "road_motorway_link",
    "bucket": "road_motorway_link"
  }, {
    "id": "road_service",
    "bucket": "road_service"
  }, {
    "id": "road_street",
    "bucket": "road_street"
  }, {
    "id": "road_main",
    "bucket": "road_main"
  }, {
    "id": "road_motorway_casing",
    "bucket": "road_motorway"
  }, {
    "id": "road_motorway",
    "bucket": "road_motorway"
  }, {
    "id": "bridge_service_casing",
    "bucket": "bridge_service"
  }, {
    "id": "bridge_service",
    "bucket": "bridge_service"
  }, {
    "id": "bridge_main_casing",
    "bucket": "bridge_main"
  }, {
    "id": "bridge_main",
    "bucket": "bridge_main"
  }, {
    "id": "bridge_street_casing",
    "bucket": "bridge_street"
  }, {
    "id": "bridge_street",
    "bucket": "bridge_street"
  }, {
    "id": "bridge_motorway_link_casing",
    "bucket": "bridge_motorway_link"
  }, {
    "id": "bridge_motorway_link",
    "bucket": "bridge_motorway_link"
  }, {
    "id": "bridge_motorway_casing",
    "bucket": "bridge_motorway"
  }, {
    "id": "bridge_motorway",
    "bucket": "bridge_motorway"
  }, {
    "id": "road_path",
    "bucket": "road_path"
  }, {
    "id": "road_major_rail",
    "bucket": "road_major_rail"
  }, {
    "id": "road_major_rail_hatching",
    "bucket": "road_major_rail"
  }, {
    "id": "bridge_path",
    "bucket": "bridge_path"
  }, {
    "id": "bridge_major_rail",
    "bucket": "bridge_major_rail"
  }, {
    "id": "bridge_major_rail_hatching",
    "bucket": "bridge_major_rail"
  }, {
    "id": "admin",
    "layers": [{
      "id": "admin_level_3",
      "bucket": "admin_level_3"
    }, {
      "id": "admin_level_2",
      "bucket": "admin_level_2"
    }, {
      "id": "admin_maritime",
      "bucket": "admin_maritime"
    }]
  }, {
    "id": "country_label_line",
    "bucket": "country_label_line"
  }, {
    "id": "country_label",
    "bucket": "country_label"
  }, {
    "id": "marin_label_1",
    "bucket": "marin_label_1"
  }, {
    "id": "marin_label_2",
    "bucket": "marin_label_2"
  }, {
    "id": "marin_label_3",
    "bucket": "marin_label_3"
  }, {
    "id": "place_label_city_point",
    "bucket": "place_label_city_point"
  }, {
    "id": "place_label_city",
    "bucket": "place_label_city"
  }, {
    "id": "place_label_town",
    "bucket": "place_label_town"
  }, {
    "id": "place_label_village",
    "bucket": "place_label_village"
  }, {
    "id": "place_label_other",
    "bucket": "place_label_other"
  }, {
    "id": "road_label",
    "bucket": "road_label"
  }, {
    "id": "poi_label",
    "bucket": "poi_label"
  }, {
    "id": "water_label",
    "bucket": "water_label"
  }, {
    "id": "poi_airport",
    "bucket": "poi_airport"
  }, {
    "id": "poi_rail",
    "bucket": "poi_rail"
  }, {
    "id": "poi_bus",
    "bucket": "poi_bus"
  }, {
    "id": "poi_fire_station",
    "bucket": "poi_fire_station"
  }, {
    "id": "poi_restaurant",
    "bucket": "poi_restaurant"
  }, {
    "id": "poi_park",
    "bucket": "poi_park"
  }, {
    "id": "poi_hospital",
    "bucket": "poi_hospital"
  }, {
    "id": "poi_playground",
    "bucket": "poi_playground"
  }, {
    "id": "poi_cafe",
    "bucket": "poi_cafe"
  }, {
    "id": "poi_beer",
    "bucket": "poi_beer"
  }],
  "constants": {
    "land": "#f8f4f0",
    "water": "#a0c8f0",
    "park": "#d8e8c8",
    "cemetary": "#e0e4dd",
    "hospital": "#fde",
    "school": "#f0e8f8",
    "wood": "#6a4",
    "building": "#f2eae2",
    "building_shadow": "#dfdbd7",
    "aeroway": "#f0ede9",
    "motorway": "#fc8",
    "motorway_casing": "#e9ac77",
    "motorway_tunnel": "#ffdaa6",
    "main": "#fea",
    "main_tunnel": "#fff4c6",
    "street": "#fff",
    "street_limited": "#f3f3f3",
    "street_casing": "#cfcdca",
    "path": "#cba",
    "rail": "#bbb",
    "text": "#334",
    "marine_text": "#8dbeed",
    "maki": "#666",
    "point_translate": [0, -30]
  },
  "styles": {
    "default": {
      "background": {
        "fill-color": "land",
        "transition-fill-color": {
          "duration": 500,
          "delay": 0
        }
      },
      "admin": {
        "opacity": 0.5
      },
      "admin_maritime": {
        "line-color": "#cfe0fa",
        "line-width": 4.5
      },
      "admin_level_2": {
        "line-color": "#446",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 1.5], [6, 1.5], [8, 3], [22, 3]]
        }
      },
      "admin_level_3": {
        "line-color": "#446",
        "line-dasharray": [30, 5],
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.5], [6, 0.5], [8, 1], [12, 1.5], [22, 1.5]]
        }
      },
      "waterway_other": {
        "line-color": "water",
        "line-width": 0.5
      },
      "waterway_river": {
        "line-color": "water",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 1], [12, 1], [14, 2], [16, 3], [22, 3]]
        }
      },
      "waterway_stream_canal": {
        "line-color": "water",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 1], [14, 1], [16, 2], [18, 3], [22, 3]]
        }
      },
      "landuse_park": {
        "fill-color": "park"
      },
      "landuse_cemetary": {
        "fill-color": "cemetary"
      },
      "landuse_hospital": {
        "fill-color": "hospital"
      },
      "landuse_school": {
        "fill-color": "school"
      },
      "landuse_wood": {
        "fill-color": "wood",
        "fill-opacity": 0.1
      },
      "water": {
        "fill-color": "water"
      },
      "water_offset": {
        "fill-color": "#f0f0ff",
        "fill-image": "wave",
        "fill-opacity": 0.4,
        "fill-translate": [0, 2.5]
      },
      "aeroway_fill": {
        "fill-color": "aeroway",
        "fill-opacity": 0.7
      },
      "aeroway_runway": {
        "line-color": "aeroway",
        "line-width": 5
      },
      "aeroway_taxiway": {
        "line-color": "aeroway",
        "line-width": 1.5
      },
      "building": {
        "fill-color": "building"
      },
      "building_wall": {
        "fill-color": "building",
        "fill-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [17, 0], [18, 1], [22, 1]]
        },
        "stroke-color": "building_shadow"
      },
      "building_shadow": {
        "fill-color": "building_shadow",
        "fill-translate": [2, 2],
        "fill-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [17, 0], [18, 1], [22, 1]]
        }
      },
      "road_motorway_casing": {
        "line-color": "motorway_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[6, 0.4], [7, 0.6], [8, 1.5], [10, 3], [13, 3.5], [14, 5], [15, 7], [16, 9], [22, 9]]
        }
      },
      "road_motorway": {
        "line-color": "motorway",
        "line-width": {
          "fn": "stops",
          "stops": [[7, 0], [8, 0.5], [10, 1], [13, 2], [14, 3.5], [15, 5], [16, 7], [22, 7]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[7, 0], [8, 1], [22, 1]]
        }
      },
      "road_main_casing": {
        "line-color": "motorway_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[6, 0.2], [16, 8], [22, 8]]
        }
      },
      "road_main": {
        "line-color": "main",
        "line-width": {
          "fn": "stops",
          "stops": [[8, 0.5], [10, 1], [13, 1.5], [14, 2.5], [15, 3.5], [16, 6], [22, 6]]
        }
      },
      "road_motorway_link_casing": {
        "line-color": "motorway_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[13, 1], [14, 3], [15, 5], [16, 6.5], [22, 6.5]]
        }
      },
      "road_motorway_link": {
        "line-color": "motorway",
        "line-width": {
          "fn": "stops",
          "stops": [[13, 1.5], [14, 1.5], [15, 3], [16, 4.5], [22, 4.5]]
        }
      },
      "road_street_casing": {
        "line-color": "street_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 1], [12, 1], [14, 1], [15, 4], [16, 6.5], [22, 6.5]]
        }
      },
      "road_street": {
        "line-color": "street",
        "line-width": {
          "fn": "stops",
          "stops": [[14.5, 0], [15, 2.5], [16, 4], [22, 4]]
        }
      },
      "road_service_casing": {
        "line-color": "street_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 1], [15, 1], [16, 4], [22, 4]]
        }
      },
      "road_service": {
        "line-color": "street",
        "line-width": 2
      },
      "road_path": {
        "line-color": "path",
        "line-dasharray": [2, 1],
        "line-width": {
          "fn": "stops",
          "stops": [[15, 1], [16, 1.2], [17, 1.5], [22, 1.5]]
        }
      },
      "road_major_rail": {
        "line-color": "rail",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.4], [16, 0.75], [22, 0.75]]
        }
      },
      "road_major_rail_hatching": {
        "line-color": "rail",
        "line-dasharray": [2, 31],
        "line-width": 4
      },
      "bridge_motorway_casing": {
        "line-color": "motorway_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[6, 0.4], [7, 0.6], [8, 1.5], [10, 3], [13, 3.5], [14, 5], [15, 7], [16, 9], [22, 9]]
        }
      },
      "bridge_motorway": {
        "line-color": "motorway",
        "line-width": {
          "fn": "stops",
          "stops": [[7, 0], [8, 0.5], [10, 1], [13, 2], [14, 3.5], [15, 5], [16, 7], [22, 7]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[7, 0], [8, 1], [22, 1]]
        }
      },
      "bridge_main_casing": {
        "line-color": "motorway_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[6, 0.2], [16, 8], [22, 8]]
        }
      },
      "bridge_main": {
        "line-color": "main",
        "line-width": {
          "fn": "stops",
          "stops": [[8, 0.5], [10, 1], [13, 1.5], [14, 2.5], [15, 3.5], [16, 6], [22, 6]]
        }
      },
      "bridge_motorway_link_casing": {
        "line-color": "motorway_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[13, 1], [14, 3], [15, 5], [16, 6.5], [22, 6.5]]
        }
      },
      "bridge_motorway_link": {
        "line-color": "motorway",
        "line-width": {
          "fn": "stops",
          "stops": [[13, 1.5], [14, 1.5], [15, 3], [16, 4.5], [22, 4.5]]
        }
      },
      "bridge_street_casing": {
        "line-color": "street_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[12, 0.5], [14, 1], [15, 4], [16, 6.5], [22, 6.5]]
        }
      },
      "bridge_street": {
        "line-color": "street",
        "line-width": {
          "fn": "stops",
          "stops": [[14, 0], [15, 2.5], [16, 4], [22, 4]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[14, 0], [15, 1], [22, 1]]
        }
      },
      "bridge_service_casing": {
        "line-color": "street_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[15, 1], [16, 4], [22, 4]]
        }
      },
      "bridge_service": {
        "line-color": "street",
        "line-width": 2
      },
      "bridge_path": {
        "line-color": "path",
        "line-dasharray": [2, 1],
        "line-width": {
          "fn": "stops",
          "stops": [[15, 1], [16, 1.2], [17, 1.5], [22, 1.5]]
        }
      },
      "bridge_major_rail": {
        "line-color": "rail",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.4], [16, 0.75], [22, 0.75]]
        }
      },
      "bridge_major_rail_hatching": {
        "line-color": "rail",
        "line-dasharray": [2, 31],
        "line-width": 4
      },
      "tunnel_motorway_casing": {
        "line-color": "motorway_casing",
        "line-dasharray": [7, 2],
        "line-width": {
          "fn": "stops",
          "stops": [[6, 0.4], [7, 0.6], [8, 1.5], [10, 3], [13, 3.5], [14, 5], [15, 7], [16, 9], [22, 9]]
        }
      },
      "tunnel_motorway": {
        "line-color": "motorway_tunnel",
        "line-width": {
          "fn": "stops",
          "stops": [[7, 0], [8, 0.5], [10, 1], [13, 2], [14, 3.5], [15, 5], [16, 7], [22, 7]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[7, 0], [8, 1], [22, 1]]
        }
      },
      "tunnel_main_casing": {
        "line-color": "motorway_casing",
        "line-dasharray": [7, 2],
        "line-width": {
          "fn": "stops",
          "stops": [[6, 0.2], [16, 8], [22, 8]]
        }
      },
      "tunnel_main": {
        "line-color": "main_tunnel",
        "line-width": {
          "fn": "stops",
          "stops": [[8, 0.5], [10, 1], [13, 1.5], [14, 2.5], [15, 3.5], [16, 6], [22, 6]]
        }
      },
      "tunnel_motorway_link_casing": {
        "line-color": "motorway_casing",
        "line-width": {
          "fn": "stops",
          "stops": [[13, 1], [14, 3], [15, 5], [16, 6.5], [22, 6.5]]
        }
      },
      "tunnel_motorway_link": {
        "line-color": "motorway",
        "line-width": {
          "fn": "stops",
          "stops": [[14, 1.5], [15, 3], [16, 4.5], [22, 4.5]]
        }
      },
      "tunnel_street_casing": {
        "line-color": "street_casing",
        "line-dasharray": [7, 2],
        "line-width": {
          "fn": "stops",
          "stops": [[12, 0.5], [14, 1], [15, 4], [16, 6.5], [22, 6.5]]
        }
      },
      "tunnel_street": {
        "line-color": "street",
        "line-width": {
          "fn": "stops",
          "stops": [[14, 0], [15, 2.5], [16, 4], [22, 4]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[14, 0], [15, 1], [22, 1]]
        }
      },
      "tunnel_service_casing": {
        "line-color": "street_casing",
        "line-dasharray": [7, 2],
        "line-width": {
          "fn": "stops",
          "stops": [[15, 1], [16, 4], [22, 4]]
        }
      },
      "tunnel_service": {
        "line-color": "street",
        "line-width": 2
      },
      "tunnel_major_rail": {
        "line-color": "rail",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.4], [16, 0.75], [22, 0.75]]
        }
      },
      "tunnel_major_rail_hatching": {
        "line-color": "rail",
        "line-dasharray": [2, 31],
        "line-width": 4
      },
      "country_label": {
        "text-color": "text",
        "text-halo-color": [1, 1, 1, 0.8]
      },
      "country_label_line": {
        "line-color": "text",
        "line-width": 0.5,
        "line-opacity": 0.5
      },
      "marin_label_1": {
        "text-color": "marine_text",
        "text-halo-color": [1, 1, 1, 0.8]
      },
      "marin_label_2": {
        "text-color": "marine_text",
        "text-halo-color": [1, 1, 1, 0.8]
      },
      "marin_label_3": {
        "text-color": "marine_text",
        "text-halo-color": [1, 1, 1, 0.8]
      },
      "place_label_city_point": {
        "point-color": "#333",
        "point-radius": 2
      },
      "place_label_city": {
        "text-color": "#333",
        "text-halo-color": [1, 1, 1, 0.8],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 10], [10, 18], [12, 24]]
        },
        "text-translate": [0, 30]
      },
      "place_label_town": {
        "text-color": "#333",
        "text-halo-color": [1, 1, 1, 0.8],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 14], [12, 16], [14, 20], [16, 24]]
        }
      },
      "place_label_village": {
        "text-color": "#333",
        "text-halo-color": [1, 1, 1, 0.8],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 12], [12, 14], [14, 28], [16, 22]]
        }
      },
      "place_label_other": {
        "text-color": "#633",
        "text-halo-color": [1, 1, 1, 0.8],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 10], [14, 11], [15, 12], [16, 14]]
        }
      },
      "poi_label": {
        "text-color": "#666",
        "text-halo-color": [1, 1, 1, 0.5]
      },
      "road_label": {
        "text-color": "#765",
        "text-halo-color": [1, 1, 1, 0.5],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 12], [14, 12], [15, 13]]
        }
      },
      "water_label": {
        "text-color": "marine_text",
        "text-halo-color": [1, 1, 1, 0.75]
      },
      "poi_airport": {
        "point-color": "maki",
        "point-image": "airport-12",
        "point-translate": "point_translate"
      },
      "poi_restaurant": {
        "point-color": "maki",
        "point-image": "restaurant-12",
        "point-translate": "point_translate"
      },
      "poi_bus": {
        "point-color": "maki",
        "point-image": "bus-12",
        "point-translate": "point_translate"
      },
      "poi_rail": {
        "point-color": "maki",
        "point-image": "rail-12",
        "point-translate": "point_translate"
      },
      "poi_fire_station": {
        "point-color": "maki",
        "point-image": "fire-station-12",
        "point-translate": "point_translate"
      },
      "poi_park": {
        "point-color": "maki",
        "point-image": "park-12",
        "point-translate": "point_translate"
      },
      "poi_hospital": {
        "point-color": "maki",
        "point-image": "hospital-12",
        "point-translate": "point_translate"
      },
      "poi_playground": {
        "point-color": "maki",
        "point-image": "playground-12",
        "point-translate": "point_translate"
      },
      "poi_cafe": {
        "point-color": "maki",
        "point-image": "cafe-12",
        "point-translate": "point_translate"
      },
      "poi_beer": {
        "point-color": "maki",
        "point-image": "beer-12",
        "point-translate": "point_translate"
      }
    }
  },
  "sprite": "/img/sprite"
}
