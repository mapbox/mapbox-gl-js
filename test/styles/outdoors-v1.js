module.exports = {
  "version": "1",
  "layers": [{
    "id": "background"
  }, {
    "id": "waterway_river_canal",
    "filter": {"source": "outdoors", "layer": "waterway", "type": ["river", "canal"]}
  }, {
    "id": "waterway_stream",
    "filter": {"source": "outdoors", "layer": "waterway", "type": "stream"}
  }, {
    "id": "landcover_wood",
    "filter": {"source": "outdoors", "layer": "landcover", "class": "wood"}
  }, {
    "id": "landcover_scrub",
    "filter": {"source": "outdoors", "layer": "landcover", "class": "scrub"}
  }, {
    "id": "landcover_grass",
    "filter": {"source": "outdoors", "layer": "landcover", "class": "grass"}
  }, {
    "id": "landcover_crop",
    "filter": {"source": "outdoors", "layer": "landcover", "class": "crop"}
  }, {
    "id": "landcover_snow",
    "filter": {"source": "outdoors", "layer": "landcover", "class": "snow"}
  }, {
    "id": "landuse_park",
    "filter": {"source": "outdoors", "layer": "landuse", "class": "park"}
  }, {
    "id": "landuse_pitch",
    "filter": {"source": "outdoors", "layer": "landuse", "class": "pitch"}
  }, {
    "id": "landuse_cemetary",
    "filter": {"source": "outdoors", "layer": "landuse", "class": "cemetary"}
  }, {
    "id": "landuse_hospital",
    "filter": {"source": "outdoors", "layer": "landuse", "class": "hospital"}
  }, {
    "id": "landuse_industrial",
    "filter": {"source": "outdoors", "layer": "landuse", "class": "industrial"}
  }, {
    "id": "landuse_school",
    "filter": {"source": "outdoors", "layer": "landuse", "class": "school"}
  }, {
    "id": "overlay_wetland",
    "filter": {"source": "outdoors", "layer": "landuse_overlay", "class": "wetland"}
  }, {
    "id": "overlay_wetland_noveg",
    "filter": {"source": "outdoors", "layer": "landuse_overlay", "class": "wetland_noveg"}
  }, {
    "id": "overlay_breakwater_pier",
    "filter": {"source": "outdoors", "layer": "landuse_overlay", "class": ["breakwater", "pier"]}
  }, {
    "id": "hillshade_full_shadow",
    "filter": {"source": "outdoors", "layer": "hillshade", "class": "full_shadow"}
  }, {
    "id": "hillshade_medium_shadow",
    "filter": {"source": "outdoors", "layer": "hillshade", "class": "medium_shadow"}
  }, {
    "id": "hillshade_medium_highlight",
    "filter": {"source": "outdoors", "layer": "hillshade", "class": "medium_highlight"}
  }, {
    "id": "hillshade_full_highlight",
    "filter": {"source": "outdoors", "layer": "hillshade", "class": "full_highlight"}
  }, {
    "id": "contour_line_10",
    "filter": {"source": "outdoors", "layer": "contour", "index": 10}
  }, {
    "id": "contour_line_other",
    "filter": {"source": "outdoors", "layer": "contour"}
  }, {
    "id": "barrier_line_gate",
    "filter": {"source": "outdoors", "layer": "barrier_line", "class": "gate"}
  }, {
    "id": "barrier_line_fence",
    "filter": {"source": "outdoors", "layer": "barrier_line", "class": "fence"}
  }, {
    "id": "barrier_line_hedge",
    "filter": {"source": "outdoors", "layer": "barrier_line", "class": "hedge"}
  }, {
    "id": "barrier_line_land",
    "filter": {"source": "outdoors", "layer": "barrier_line", "class": "land"}
  }, {
    "id": "barrier_line_cliff",
    "filter": {"source": "outdoors", "layer": "barrier_line", "class": "cliff"}
  }, {
    "id": "water",
    "filter": {"source": "outdoors", "layer": "water"}
  }, {
    "id": "aeroway_fill",
    "filter": {"source": "outdoors", "layer": "aeroway"}
  }, {
    "id": "aeroway_runway",
    "filter": {"source": "outdoors", "layer": "aeroway", "type": "runway"}
  }, {
    "id": "aeroway_taxiway",
    "filter": {"source": "outdoors", "layer": "aeroway", "type": "taxiway"}
  }, {
    "id": "building_shadow",
    "filter": {"source": "outdoors", "layer": "building"}
  }, {
    "id": "building",
    "filter": {"source": "outdoors", "layer": "building"}
  }, {
    "id": "building_wall",
    "filter": {"source": "outdoors", "layer": "building"}
  }, {
    "id": "tunnel_motorway_link_casing",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "motorway_link"}
  }, {
    "id": "tunnel_service_casing",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "service"}
  }, {
    "id": "tunnel_main_casing",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "main"}
  }, {
    "id": "tunnel_street_casing_group",
    "layers": [{
      "id": "tunnel_street_casing",
      "filter": {"source": "outdoors", "layer": "tunnel", "class": ["street", "street_limited"]}
    }]
  }, {
    "id": "tunnel_motorway_link",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "motorway_link"}
  }, {
    "id": "tunnel_service",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "service"}
  }, {
    "id": "tunnel_street_group",
    "layers": [{
      "id": "tunnel_street",
      "filter": {"source": "outdoors", "layer": "tunnel", "class": ["street", "street_limited"]}
    }]
  }, {
    "id": "tunnel_main",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "main"}
  }, {
    "id": "tunnel_motorway_casing",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "motorway"}
  }, {
    "id": "tunnel_motorway",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "motorway"}
  }, {
    "id": "road_path_case",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "path"}
  }, {
    "id": "road_path_footway",
    "filter": {"source": "outdoors", "layer": "tunnel", "type": "footway"}
  }, {
    "id": "road_path_path",
    "filter": {"source": "outdoors", "layer": "tunnel", "type": "path"}
  }, {
    "id": "road_path_cycleway",
    "filter": {"source": "outdoors", "layer": "tunnel", "type": "cycleway"}
  }, {
    "id": "road_path_mtb",
    "filter": {"source": "outdoors", "layer": "tunnel", "type": "mtb"}
  }, {
    "id": "road_path_piste",
    "filter": {"source": "outdoors", "layer": "tunnel", "type": "piste"}
  }, {
    "id": "road_path_steps",
    "filter": {"source": "outdoors", "layer": "tunnel", "type": "steps"}
  }, {
    "id": "road_major_rail",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "major_rail"}
  }, {
    "id": "road_major_rail_hatching",
    "filter": {"source": "outdoors", "layer": "tunnel", "class": "major_rail"}
  }, {
    "id": "road_motorway_link_casing",
    "filter": {"source": "outdoors", "layer": "road", "class": "motorway_link"}
  }, {
    "id": "road_service_casing",
    "filter": {"source": "outdoors", "layer": "road", "class": "service"}
  }, {
    "id": "road_main_casing",
    "filter": {"source": "outdoors", "layer": "road", "class": "main"}
  }, {
    "id": "road_street_casing_group",
    "layers": [{
      "id": "road_street_casing",
      "filter": {"source": "outdoors", "layer": "road", "class": ["street", "street_limited"]}
    }]
  }, {
    "id": "road_motorway_link",
    "filter": {"source": "outdoors", "layer": "road", "class": "motorway_link"}
  }, {
    "id": "road_service",
    "filter": {"source": "outdoors", "layer": "road", "class": "service"}
  }, {
    "id": "road_street_group",
    "layers": [{
      "id": "road_street",
      "filter": {"source": "outdoors", "layer": "road", "class": ["street", "street_limited"]}
    }]
  }, {
    "id": "road_main",
    "filter": {"source": "outdoors", "layer": "road", "class": "main"}
  }, {
    "id": "road_motorway_casing",
    "filter": {"source": "outdoors", "layer": "road", "class": "motorway"}
  }, {
    "id": "road_motorway",
    "filter": {"source": "outdoors", "layer": "road", "class": "motorway"}
  }, {
    "id": "road_path_case",
    "filter": {"source": "outdoors", "layer": "road", "class": "path"}
  }, {
    "id": "road_path_footway",
    "filter": {"source": "outdoors", "layer": "road", "type": "footway"}
  }, {
    "id": "road_path_path",
    "filter": {"source": "outdoors", "layer": "road", "type": "path"}
  }, {
    "id": "road_path_cycleway",
    "filter": {"source": "outdoors", "layer": "road", "type": "cycleway"}
  }, {
    "id": "road_path_mtb",
    "filter": {"source": "outdoors", "layer": "road", "type": "mtb"}
  }, {
    "id": "road_path_piste",
    "filter": {"source": "outdoors", "layer": "road", "type": "piste"}
  }, {
    "id": "road_path_steps",
    "filter": {"source": "outdoors", "layer": "road", "type": "steps"}
  }, {
    "id": "road_major_rail",
    "filter": {"source": "outdoors", "layer": "road", "class": "major_rail"}
  }, {
    "id": "road_major_rail_hatching",
    "filter": {"source": "outdoors", "layer": "road", "class": "major_rail"}
  }, {
    "id": "bridge_motorway_link_casing",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "motorway_link"}
  }, {
    "id": "bridge_service_casing",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "service"}
  }, {
    "id": "bridge_main_casing",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "main"}
  }, {
    "id": "bridge_street_casing_group",
    "layers": [{
      "id": "bridge_street_casing",
      "filter": {"source": "outdoors", "layer": "bridge", "class": ["street", "street_limited"]}
    }]
  }, {
    "id": "bridge_motorway_link",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "motorway_link"}
  }, {
    "id": "bridge_service",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "service"}
  }, {
    "id": "bridge_street_group",
    "layers": [{
      "id": "bridge_street",
      "filter": {"source": "outdoors", "layer": "bridge", "class": ["street", "street_limited"]}
    }]
  }, {
    "id": "bridge_main",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "main"}
  }, {
    "id": "bridge_motorway_casing",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "motorway"}
  }, {
    "id": "bridge_motorway",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "motorway"}
  }, {
    "id": "road_path_footway",
    "filter": {"source": "outdoors", "layer": "bridge", "type": "footway"}
  }, {
    "id": "road_path_path",
    "filter": {"source": "outdoors", "layer": "bridge", "type": "path"}
  }, {
    "id": "road_path_cycleway",
    "filter": {"source": "outdoors", "layer": "bridge", "type": "cycleway"}
  }, {
    "id": "road_path_mtb",
    "filter": {"source": "outdoors", "layer": "bridge", "type": "mtb"}
  }, {
    "id": "road_path_piste",
    "filter": {"source": "outdoors", "layer": "bridge", "type": "piste"}
  }, {
    "id": "road_path_steps",
    "filter": {"source": "outdoors", "layer": "bridge", "type": "steps"}
  }, {
    "id": "bridge_aerialway_casing",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "aerialway"}
  }, {
    "id": "bridge_aerialway",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "aerialway"}
  }, {
    "id": "road_major_rail",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "major_rail"}
  }, {
    "id": "road_major_rail_hatching",
    "filter": {"source": "outdoors", "layer": "bridge", "class": "major_rail"}
  }, {
    "id": "admin_level_3",
    "filter": {"source": "outdoors", "layer": "admin", "admin_level": [3, 4, 5]}
  }, {
    "id": "admin_level_2",
    "filter": {"source": "outdoors", "layer": "admin", "admin_level": 2}
  }, {
    "id": "admin_maritime_cover",
    "filter": {"source": "outdoors", "layer": "admin", "maritime": 1}
  }, {
    "id": "admin_maritime",
    "filter": {"source": "outdoors", "layer": "admin", "maritime": 1}
  }, {
    "id": "country_label_line",
    "filter": {"source": "outdoors", "layer": "country_label_line"}
  }, {
    "id": "country_label",
    "filter": {"source": "outdoors", "layer": "country_label", "feature_type": "point"}
  }, {
    "id": "marine_label_point",
    "filter": {"source": "outdoors", "layer": "marine_label", "feature_type": "point"}
  }, {
    "id": "marine_label_line",
    "filter": {"source": "outdoors", "layer": "marine_label", "feature_type": "line"}
  }, {
    "id": "state_label",
    "filter": {"source": "outdoors", "layer": "state_label", "feature_type": "point"}
  }, {
    "id": "place_label_city_point",
    "filter": {"source": "outdoors", "layer": "place_label", "type": "city"}
  }, {
    "id": "place_label_city",
    "filter": {"source": "outdoors", "layer": "place_label", "type": "city", "feature_type": "point"}
  }, {
    "id": "place_label_town",
    "filter": {"source": "outdoors", "layer": "place_label", "type": "town", "feature_type": "point"}
  }, {
    "id": "place_label_village",
    "filter": {
      "source": "outdoors",
      "layer": "place_label",
      "type": "village",
      "feature_type": "point"
    }
  }, {
    "id": "place_label_other",
    "filter": {
      "source": "outdoors",
      "layer": "place_label",
      "type": ["hamlet", "suburb", "neighbourhood"],
      "feature_type": "point"
    }
  }, {
    "id": "poi_label_1",
    "filter": {
      "source": "outdoors",
      "layer": "poi_label",
      "scalerank": [1, 2],
      "feature_type": "point"
    }
  }, {
    "id": "road_label",
    "filter": {"source": "outdoors", "layer": "road_label", "feature_type": "line"}
  }, {
    "id": "contour_label",
    "filter": {"source": "outdoors", "layer": "contour", "index": 10, "feature_type": "line"}
  }, {
    "id": "water_label",
    "filter": {"source": "outdoors", "layer": "water_label", "feature_type": "point"}
  }, {
    "id": "waterway_label",
    "filter": {"source": "outdoors", "layer": "waterway_label", "feature_type": "line"}
  }, {
    "id": "poi_airport",
    "filter": {"source": "outdoors", "layer": "poi_label", "maki": "airport"}
  }, {
    "id": "poi_rail",
    "filter": {"source": "outdoors", "layer": "poi_label", "maki": "rail"}
  }, {
    "id": "poi_golf",
    "filter": {"source": "outdoors", "layer": "poi_label", "maki": "golf"}
  }, {
    "id": "poi_park",
    "filter": {"source": "outdoors", "layer": "poi_label", "maki": "park"}
  }, {
    "id": "poi_hospital",
    "filter": {"source": "outdoors", "layer": "poi_label", "maki": "hospital"}
  }, {
    "id": "poi_college",
    "filter": {"source": "outdoors", "layer": "poi_label", "maki": "college"}
  }],
  "constants": {
    "land": "#f4efe1",
    "water": "#cdd",
    "water_dark": "#185869",
    "crop": "#eeeed4",
    "grass": "#e7ebd1",
    "scrub": "#e0e8cd",
    "wood": "#d4e2c6",
    "snow": "#f4f8ff",
    "rock": "#ddd",
    "sand": "#ffd",
    "cemetary": "#edf4ed",
    "pitch": "#fff",
    "park": "#d4e4bc",
    "piste": "blue",
    "school": "#e8dfe0",
    "hospital": "#f8eee0",
    "builtup": "#f6faff",
    "case": "#fff",
    "motorway": "#d7a8a8",
    "main": "#ddc0b9",
    "street": "#fff",
    "text": "#666",
    "country_text": "#323330",
    "marine_text": "#a0bdc0",
    "water_text": "#185869"
  },
  "styles": {
    "default": {
      "background": {
        "fill-color": "land"
      },
      "admin_maritime_cover": {
        "line-color": "water",
        "line-width": 5,
        "line-cap": "round",
        "line-join": "round"
      },
      "admin_maritime": {
        "line-color": "#c0d6d6",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.4], [6, 1], [8, 2], [12, 3], [22, 3]]
        },
        "line-cap": "round",
        "line-join": "round"
      },
      "admin_level_2": {
        "line-color": "#88a",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.4], [2, 0.4], [3, 0.8], [4, 1], [5, 1.5], [6, 2], [8, 3], [10, 4], [22, 4]]
        },
        "line-cap": "round",
        "line-join": "round"
      },
      "admin_level_3": {
        "line-color": "#88a",
        "line-dasharray": [30, 5],
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.4], [6, 1], [8, 2], [12, 3], [22, 3]]
        },
        "line-join": "round"
      },
      "waterway_other": {},
      "waterway_river_canal": {
        "line-color": "#87abaf",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.5], [12, 1], [14, 2], [16, 3], [22, 3]]
        },
        "line-cap": "round"
      },
      "waterway_stream": {
        "line-color": "#87abaf",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.25], [13, 0.25], [14, 0.5], [16, 1.5], [18, 2], [22, 2]]
        },
        "line-cap": "round"
      },
      "landcover_wood": {
        "fill-color": "wood",
        "fill-opacity": 0.8
      },
      "landcover_scrub": {
        "fill-color": "scrub",
        "fill-opacity": 0.8
      },
      "landcover_grass": {
        "fill-color": "grass",
        "fill-opacity": 0.8
      },
      "landcover_crop": {
        "fill-color": "crop",
        "fill-opacity": 0.8
      },
      "landcover_snow": {
        "fill-color": "snow",
        "fill-opacity": 0.8
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
      "landuse_pitch": {
        "fill-color": "rgba(255,255,255,0.5)",
        "line-color": "pitch"
      },
      "overlay_wetland": {
        "fill-color": "#e1e9d3",
        "fill-image": "wetland_noveg_64"
      },
      "overlay_wetland_noveg": {
        "fill-color": "#e1e9d3",
        "fill-image": "wetland_noveg_64"
      },
      "overlay_breakwater_pier": {
        "fill-color": "land"
      },
      "hillshade_full_shadow": {
        "fill-color": "#103",
        "fill-opacity": {
          "fn": "stops",
          "stops": [[0, 0.08], [15, 0.075], [17, 0.05], [18, 0.025], [22, 0.025]]
        }
      },
      "hillshade_medium_shadow": {
        "fill-color": "#206",
        "fill-opacity": {
          "fn": "stops",
          "stops": [[0, 0.08], [15, 0.075], [17, 0.05], [18, 0.025], [22, 0.025]]
        }
      },
      "hillshade_full_highlight": {
        "fill-color": "#fffff3",
        "fill-opacity": {
          "fn": "stops",
          "stops": [[0, 0.25], [15, 0.3], [17, 0.2], [18, 0.1], [22, 0.1]]
        }
      },
      "hillshade_medium_highlight": {
        "fill-color": "#ffd",
        "fill-opacity": {
          "fn": "stops",
          "stops": [[0, 0.2], [15, 0.3], [17, 0.2], [18, 0.1], [22, 0.1]]
        }
      },
      "contour_line_10": {
        "line-color": "#008",
        "line-width": 1.2,
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0.06], [12, 0.06], [13, 0.12], [22, 0.12]]
        }
      },
      "contour_line_other": {
        "line-color": "#008",
        "line-width": 0.5,
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0.06], [12, 0.06], [13, 0.12], [22, 0.12]]
        }
      },
      "water": {
        "fill-color": "water",
        "line-color": "#a2bdc0"
      },
      "aeroway_fill": {
        "fill-color": "#ddd",
        "min-zoom": 12
      },
      "aeroway_runway": {
        "line-color": "#ddd",
        "line-width": {
          "fn": "stops",
          "stops": [[10, 1], [11, 2], [12, 3], [13, 5], [14, 7], [15, 11], [16, 15], [17, 19], [18, 23], [22, 23]]
        },
        "min-zoom": 12
      },
      "aeroway_taxiway": {
        "line-color": "#ddd",
        "line-width": {
          "fn": "stops",
          "stops": [[10, 0.2], [12, 0.2], [13, 1], [14, 1.5], [15, 2], [16, 3], [17, 4], [18, 5], [22, 5]]
        },
        "min-zoom": 12
      },
      "building": {
        "fill-color": "#ebe7db"
      },
      "building_wall": {
        "fill-color": "#ebe7db",
        "line-color": "#d5d1c6",
        "fill-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [16.5, 0], [17, 0.7], [22, 0.7]]
        }
      },
      "building_shadow": {
        "fill-color": "#d5d1c6",
        "line-color": "#d5d1c6",
        "fill-translate": [2, 2],
        "fill-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [16.5, 0], [17, 1], [22, 1]]
        }
      },
      "tunnel_motorway_casing": {
        "line-color": "case",
        "line-dasharray": [6, 6],
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.6], [7.5, 0.6], [8, 0.8], [10, 2.8], [11, 3], [12, 4], [13, 5], [14, 6.5], [15, 9], [16, 12], [17, 15], [18, 17], [22, 17]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [9.5, 0], [10, 1], [22, 1]]
        }
      },
      "tunnel_motorway": {
        "line-color": "#e6cec7",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0], [5, 0], [6, 0.5], [8, 0.8], [10, 1], [11, 1.2], [12, 2], [13, 3], [14, 4], [15, 6], [16, 9], [17, 12], [18, 14], [22, 14]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [6.5, 0], [7, 1], [22, 1]]
        }
      },
      "tunnel_main_casing": {
        "line-color": "case",
        "line-dasharray": [6, 6],
        "line-width": {
          "fn": "stops",
          "stops": [[10, 2.9], [13, 2.9], [14, 3.5], [15, 4], [16, 5.5], [17, 9], [18, 15], [22, 15]]
        }
      },
      "tunnel_main": {
        "line-color": "#e6cec7",
        "line-width": {
          "fn": "stops",
          "stops": [[6, 1], [12, 1], [13, 1], [14, 1.5], [15, 2], [16, 3], [17, 6], [18, 10], [19, 12], [22, 12]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [6.5, 0], [7, 1], [22, 1]]
        }
      },
      "tunnel_motorway_link_casing": {
        "line-color": "case",
        "line-dasharray": [6, 6],
        "line-width": {
          "fn": "stops",
          "stops": [[12, 2.8], [14, 3.5], [16, 5], [18, 6], [22, 6]]
        }
      },
      "tunnel_motorway_link": {
        "line-color": "#e6cec7",
        "line-width": {
          "fn": "stops",
          "stops": [[12, 1.2], [14, 2], [16, 3], [18, 4], [22, 4]]
        }
      },
      "tunnel_street_casing_group": {
        "opacity": {
          "fn": "stops",
          "stops": [[0, 0], [12.5, 0], [13.5, 0.6], [22, 0.6]]
        }
      },
      "tunnel_street_casing": {
        "line-color": "#d9d5c6",
        "line-width": {
          "fn": "stops",
          "stops": [[10, 0.5], [12.5, 0.5], [13, 0.5], [14, 2.25], [15, 5], [16, 7], [17, 9], [18, 11], [22, 11]]
        },
        "min-zoom": 12
      },
      "tunnel_street_group": {
        "opacity": {
          "fn": "stops",
          "stops": [[0, 0], [13.5, 0], [14.25, 1], [22, 1]]
        }
      },
      "tunnel_street": {
        "line-color": "#d9d5c6",
        "line-width": {
          "fn": "stops",
          "stops": [[11, 0], [12.5, 0], [13, 0.6], [14, 1.2], [15, 1.8], [16, 3], [17, 5], [18, 8], [22, 8]]
        },
        "min-zoom": 12
      },
      "tunnel_service_casing": {
        "line-color": "#000",
        "line-opacity": 0.04,
        "line-dasharray": [6, 6],
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.5], [14, 0.5], [15, 3], [16, 3.5], [17, 4], [18, 5], [19, 6], [22, 6]]
        },
        "min-zoom": 15
      },
      "tunnel_service": {
        "line-color": "#e6cec7",
        "line-width": 2,
        "min-zoom": 15
      },
      "road_motorway_casing": {
        "line-color": "case",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.6], [7.5, 0.6], [8, 0.8], [10, 2.8], [11, 3], [12, 4], [13, 5], [14, 6.5], [15, 9], [16, 12], [17, 15], [18, 17], [22, 17]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [9.5, 0], [10, 1], [22, 1]]
        },
        "line-cap": "round",
        "line-join": "round"
      },
      "road_motorway": {
        "line-color": "motorway",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0], [5, 0], [6, 0.5], [8, 0.8], [10, 1], [11, 1.2], [12, 2], [13, 3], [14, 4], [15, 6], [16, 9], [17, 12], [18, 14], [22, 14]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [6.5, 0], [7, 1], [22, 1]]
        },
        "line-cap": "round",
        "line-join": "round"
      },
      "road_main_casing": {
        "line-color": "case",
        "line-width": {
          "fn": "stops",
          "stops": [[10, 2.9], [13, 2.9], [14, 3.5], [15, 4], [16, 5.5], [17, 9], [18, 15], [22, 15]]
        },
        "line-cap": "round",
        "line-join": "round"
      },
      "road_main": {
        "line-color": "main",
        "line-width": {
          "fn": "stops",
          "stops": [[6, 1], [12, 1], [13, 1], [14, 1.5], [15, 2], [16, 3], [17, 6], [18, 10], [19, 12], [22, 12]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [6.5, 0], [7, 1], [22, 1]]
        },
        "line-cap": "round",
        "line-join": "round"
      },
      "road_motorway_link_casing": {
        "line-color": "case",
        "line-width": {
          "fn": "stops",
          "stops": [[12, 2.8], [14, 3.5], [16, 5], [18, 6], [22, 6]]
        },
        "line-cap": "round",
        "line-join": "round"
      },
      "road_motorway_link": {
        "line-color": "motorway",
        "line-width": {
          "fn": "stops",
          "stops": [[12, 1.2], [14, 2], [16, 3], [18, 4], [22, 4]]
        },
        "line-cap": "round",
        "line-join": "round"
      },
      "road_street_casing_group": {
        "opacity": {
          "fn": "stops",
          "stops": [[0, 0], [12.5, 0], [13.5, 0.6], [22, 0.6]]
        }
      },
      "road_street_casing": {
        "line-color": "#d9d5c6",
        "line-width": {
          "fn": "stops",
          "stops": [[10, 0.5], [12.5, 0.5], [13, 0.5], [14, 2.25], [15, 5], [16, 7], [17, 9], [18, 11], [22, 11]]
        },
        "min-zoom": 12,
        "line-cap": "round",
        "line-join": "round"
      },
      "road_street_group": {
        "opacity": {
          "fn": "stops",
          "stops": [[0, 0], [13.5, 0], [14.25, 1], [22, 1]]
        }
      },
      "road_street": {
        "line-color": "street",
        "line-width": {
          "fn": "stops",
          "stops": [[11, 0], [12.5, 0], [13, 0.6], [14, 1.2], [15, 1.8], [16, 3], [17, 5], [18, 8], [22, 8]]
        },
        "min-zoom": 12,
        "line-cap": "round",
        "line-join": "round"
      },
      "road_service_casing": {
        "line-color": "#000",
        "line-opacity": 0.04,
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.5], [14, 0.5], [15, 3], [16, 3.5], [17, 4], [18, 5], [19, 6], [22, 6]]
        },
        "min-zoom": 15,
        "line-cap": "round",
        "line-join": "round"
      },
      "road_service": {
        "line-color": "street",
        "line-width": 2,
        "min-zoom": 15,
        "line-cap": "round",
        "line-join": "round"
      },
      "road_path_case": {
        "line-color": "#ffd",
        "line-opacity": 0.4,
        "line-width": {
          "fn": "stops",
          "stops": [[10, 3], [16, 3], [17, 4], [22, 4]]
        }
      },
      "road_path_footway": {
        "line-color": "#bba",
        "line-dasharray": [4, 2],
        "line-width": {
          "fn": "stops",
          "stops": [[15, 1.2], [16, 1.5], [17, 1.8], [22, 1.8]]
        }
      },
      "road_path_path": {
        "line-color": "#987",
        "line-dasharray": [6, 2],
        "line-opacity": 0.8,
        "line-width": {
          "fn": "stops",
          "stops": [[15, 0.8], [16, 0.9], [17, 1.2], [22, 1.2]]
        }
      },
      "road_path_cycleway": {
        "line-color": "#488",
        "line-dasharray": [4, 2],
        "line-width": {
          "fn": "stops",
          "stops": [[15, 1.2], [16, 1.5], [17, 1.8], [22, 1.8]]
        }
      },
      "road_path_mtb": {
        "line-color": "#488",
        "line-dasharray": [12, 4],
        "line-width": {
          "fn": "stops",
          "stops": [[15, 1.2], [16, 1.5], [17, 1.8], [22, 1.8]]
        }
      },
      "road_path_piste": {
        "line-color": "#87b",
        "line-dasharray": [8, 4],
        "line-width": {
          "fn": "stops",
          "stops": [[15, 1.2], [16, 1.5], [17, 1.8], [22, 1.8]]
        }
      },
      "road_path_steps": {
        "line-color": "#bba",
        "line-dasharray": [4, 2],
        "line-width": 4
      },
      "road_major_rail": {
        "line-color": "#c8c4c0",
        "line-width": 0.8
      },
      "road_major_rail_hatching": {
        "line-color": "#c8c4c0",
        "line-dasharray": [2, 31],
        "line-width": 5
      },
      "bridge_motorway_casing": {
        "line-color": "case",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.6], [7.5, 0.6], [8, 0.8], [10, 2.8], [11, 3], [12, 4], [13, 5], [14, 6.5], [15, 9], [16, 12], [17, 15], [18, 17], [22, 17]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [9.5, 0], [10, 1], [22, 1]]
        }
      },
      "bridge_motorway": {
        "line-color": "motorway",
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0], [5, 0], [6, 0.5], [8, 0.8], [10, 1], [11, 1.2], [12, 2], [13, 3], [14, 4], [15, 6], [16, 9], [17, 12], [18, 14], [22, 14]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [6.5, 0], [7, 1], [22, 1]]
        }
      },
      "bridge_main_casing": {
        "line-color": "case",
        "line-width": {
          "fn": "stops",
          "stops": [[10, 2.9], [13, 2.9], [14, 3.5], [15, 4], [16, 5.5], [17, 9], [18, 15], [22, 15]]
        }
      },
      "bridge_main": {
        "line-color": "main",
        "line-width": {
          "fn": "stops",
          "stops": [[6, 1], [12, 1], [13, 1], [14, 1.5], [15, 2], [16, 3], [17, 6], [18, 10], [19, 12], [22, 12]]
        },
        "line-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [6.5, 0], [7, 1], [22, 1]]
        }
      },
      "bridge_motorway_link_casing": {
        "line-color": "case",
        "line-width": {
          "fn": "stops",
          "stops": [[12, 2.8], [14, 3.5], [16, 5], [18, 6], [22, 6]]
        }
      },
      "bridge_motorway_link": {
        "line-color": "motorway",
        "line-width": {
          "fn": "stops",
          "stops": [[12, 1.2], [14, 2], [16, 3], [18, 4], [22, 4]]
        }
      },
      "bridge_street_casing_group": {
        "opacity": {
          "fn": "stops",
          "stops": [[0, 0], [12.5, 0], [13.5, 0.6], [22, 0.6]]
        }
      },
      "bridge_street_casing": {
        "line-color": "#d9d5c6",
        "line-width": {
          "fn": "stops",
          "stops": [[10, 0.5], [12.5, 0.5], [13, 0.5], [14, 2.25], [15, 5], [16, 7], [17, 9], [18, 11], [22, 11]]
        },
        "min-zoom": 12
      },
      "bridge_street_group": {
        "opacity": {
          "fn": "stops",
          "stops": [[0, 0], [13.5, 0], [14.25, 1], [22, 1]]
        }
      },
      "bridge_street": {
        "line-color": "street",
        "line-width": {
          "fn": "stops",
          "stops": [[11, 0], [12.5, 0], [13, 0.6], [14, 1.2], [15, 1.8], [16, 3], [17, 5], [18, 8], [22, 8]]
        },
        "min-zoom": 12
      },
      "bridge_service_casing": {
        "line-color": "#000",
        "line-opacity": 0.04,
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.5], [14, 0.5], [15, 3], [16, 3.5], [17, 4], [18, 5], [19, 6], [22, 6]]
        },
        "min-zoom": 15
      },
      "bridge_service": {
        "line-color": "street",
        "line-width": 2,
        "min-zoom": 15
      },
      "bridge_aerialway_casing": {
        "line-color": "white",
        "line-opacity": 0.5,
        "line-width": {
          "fn": "stops",
          "stops": [[0, 2], [13.5, 2], [14, 2.5], [15, 3], [16, 3.5], [17, 4], [22, 5]]
        }
      },
      "bridge_aerialway": {
        "line-color": "#876",
        "line-opacity": 0.5,
        "line-width": {
          "fn": "stops",
          "stops": [[0, 0.8], [13.5, 0.8], [14, 1.4], [15, 1.6], [16, 2], [17, 2.4], [18, 3], [22, 3]]
        }
      },
      "country_label": {
        "text-color": "country_text",
        "text-halo-color": [1, 1, 1, 0.5],
        "min-zoom": 3,
        "text-field": "name",
        "text-max-size": 13,
        "text-path": "horizontal"
      },
      "country_label_line": {
        "line-color": "country_text",
        "line-width": 0.5,
        "line-opacity": 0.5,
        "min-zoom": 3
      },
      "marine_label_point": {
        "text-color": "marine_text",
        "text-field": "name",
        "text-max-size": 16,
        "text-path": "curve"
      },
      "marine_label_line": {
        "text-color": "marine_text",
        "text-field": "name",
        "text-max-size": 16,
        "text-path": "curve"
      },
      "state_label": {
        "text-color": "#666",
        "text-halo-width": 0.4,
        "text-halo-color": [1, 1, 1, 0.8],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 0], [3.99, 0], [4, 10], [9.99, 16], [10, 0], [22, 0]]
        },
        "min-zoom": 4,
        "text-field": "name",
        "text-max-size": 16,
        "text-path": "horizontal"
      },
      "place_label_city_point": {
        "point-color": "#4a4032",
        "point-radius": 3,
        "point-opacity": {
          "fn": "stops",
          "stops": [[0, 1], [5.99, 1], [6, 0], [22, 0]]
        }
      },
      "place_label_city": {
        "text-color": "#4a4032",
        "text-halo-width": 0.4,
        "text-halo-color": [1, 1, 1, 0.8],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 0], [3.99, 0], [4, 10], [7, 14], [14.99, 20], [15, 0], [22, 0]]
        },
        "text-translate": [0, ["stops", {
          "z": 0,
          "val": 10
        }, {
          "z": 4,
          "val": 10
        }, {
          "z": 6,
          "val": 30
        }, {
          "z": 7,
          "val": 0
        }, {
          "z": 22,
          "val": 0
        }]],
        "text-field": "name",
        "text-max-size": 20,
        "text-path": "horizontal"
      },
      "place_label_town": {
        "text-color": "#635644",
        "text-halo-width": 0.4,
        "text-halo-color": [1, 1, 1, 0.8],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 14], [12, 16], [14, 20], [16, 24]]
        },
        "text-field": "name",
        "text-max-size": 24,
        "text-path": "horizontal"
      },
      "place_label_village": {
        "text-color": "#635644",
        "text-halo-width": 0.4,
        "text-halo-color": [1, 1, 1, 0.8],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 12], [12, 14], [14, 28], [16, 22]]
        },
        "text-field": "name",
        "text-max-size": 22,
        "text-path": "horizontal"
      },
      "place_label_other": {
        "text-color": "#7d6c55",
        "text-halo-color": [1, 1, 1, 0.8],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 10], [14, 11], [15, 12], [16, 14]]
        },
        "text-field": "name",
        "text-max-size": 14,
        "text-path": "horizontal"
      },
      "road_label": {
        "text-color": "#765",
        "text-halo-color": [1, 1, 1, 0.5],
        "text-size": {
          "fn": "stops",
          "stops": [[0, 12], [14, 12], [15, 13]]
        },
        "text-field": "name",
        "text-max-size": 13,
        "text-path": "curve",
        "text-padding": 2,
        "text-max-angle": 0.5
      },
      "water_label": {
        "text-color": "water_text",
        "text-halo-color": [1, 1, 1, 0.75],
        "text-field": "name",
        "text-max-size": 12,
        "text-path": "horizontal"
      },
      "waterway_label": {
        "text-color": "water_text",
        "text-halo-color": [1, 1, 1, 0.75],
        "text-field": "name",
        "text-max-size": 12,
        "text-path": "curve",
        "text-min-dist": 10
      },
      "poi_airport": {
        "point-color": "#666",
        "point-image": "airport-24",
        "point-size": [12, 12]
      },
      "poi_label_1": {
        "text-color": "#444",
        "text-halo-color": [1, 1, 1, 0.5],
        "text-translate": [0, 26],
        "text-field": "name",
        "text-max-size": 12,
        "text-path": "horizontal",
        "text-padding": 2,
        "text-always-visible": true
      },
      "poi_rail": {
        "point-color": "#666",
        "point-image": "rail-12",
        "point-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [16.75, 0], [17, 1], [22, 1]]
        },
        "point-size": [12, 12]
      },
      "poi_park": {
        "point-color": "#666",
        "point-image": "park-12",
        "point-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [15.75, 0], [16, 1], [22, 1]]
        },
        "point-size": [12, 12],
        "text-always-visible": true
      },
      "poi_golf": {
        "point-color": "#666",
        "point-image": "golf-12",
        "point-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [15.75, 0], [16, 1], [22, 1]]
        },
        "point-size": [12, 12],
        "text-always-visible": true
      },
      "poi_hospital": {
        "point-color": "#666",
        "point-image": "hospital-12",
        "point-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [16.75, 0], [17, 1], [22, 1]]
        },
        "point-size": [12, 12],
        "text-always-visible": true
      },
      "poi_college": {
        "point-color": "#666",
        "point-image": "college-12",
        "point-opacity": {
          "fn": "stops",
          "stops": [[0, 0], [16.75, 0], [17, 1], [22, 1]]
        },
        "point-size": [12, 12],
        "text-always-visible": true
      },
      "contour_label": {
        "text-color": "text",
        "text-halo-color": "#fff",
        "text-size": 10,
        "text-field": "ele",
        "text-max-size": 10,
        "text-path": "curve"
      }
    }
  },
  "sprite": "img/sprite"
}
