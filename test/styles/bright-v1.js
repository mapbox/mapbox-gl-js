{
  "version": "1",
  "layers": [{
    "id": "background"
  }, {
    "id": "waterway_other",
    "filter": "source == 'osm-bright' && layer == 'waterway' && (type == 'ditch' || type == 'drain')"
  }, {
    "id": "waterway_river",
    "filter": "source == 'osm-bright' && layer == 'waterway' && type == 'river'"
  }, {
    "id": "waterway_stream_canal",
    "filter": "source == 'osm-bright' && layer == 'waterway' && (type == 'stream' || type == 'canal')"
  }, {
    "id": "landuse_park",
    "filter": "source == 'osm-bright' && layer == 'landuse' && class == 'park'"
  }, {
    "id": "landuse_cemetary",
    "filter": "source == 'osm-bright' && layer == 'landuse' && class == 'cemetary'"
  }, {
    "id": "landuse_hospital",
    "filter": "source == 'osm-bright' && layer == 'landuse' && class == 'hospital'"
  }, {
    "id": "landuse_school",
    "filter": "source == 'osm-bright' && layer == 'landuse' && class == 'school'"
  }, {
    "id": "landuse_wood",
    "filter": "source == 'osm-bright' && layer == 'landuse' && class == 'wood'"
  }, {
    "id": "water",
    "filter": "source == 'osm-bright' && layer == 'water'"
  }, {
    "id": "water_offset",
    "filter": "source == 'osm-bright' && layer == 'water'"
  }, {
    "id": "aeroway_fill",
    "filter": "source == 'osm-bright' && layer == 'aeroway'"
  }, {
    "id": "aeroway_runway",
    "filter": "source == 'osm-bright' && layer == 'aeroway' && type == 'runway'"
  }, {
    "id": "aeroway_taxiway",
    "filter": "source == 'osm-bright' && layer == 'aeroway' && type == 'taxiway'"
  }, {
    "id": "building_shadow",
    "filter": "source == 'osm-bright' && layer == 'building'"
  }, {
    "id": "building",
    "filter": "source == 'osm-bright' && layer == 'building'"
  }, {
    "id": "building_wall",
    "filter": "source == 'osm-bright' && layer == 'building'"
  }, {
    "id": "tunnel_motorway_link_casing",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'motorway_link'"
  }, {
    "id": "tunnel_motorway_casing",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'motorway'"
  }, {
    "id": "tunnel_motorway_link",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'motorway_link'"
  }, {
    "id": "tunnel_motorway",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'motorway'"
  }, {
    "id": "tunnel_path",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'path'"
  }, {
    "id": "tunnel_major_rail",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'major_rail'"
  }, {
    "id": "tunnel_major_rail_hatching",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'major_rail'"
  }, {
    "id": "tunnel_service_casing",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'service'"
  }, {
    "id": "tunnel_service",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'service'"
  }, {
    "id": "tunnel_main_casing",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'main'"
  }, {
    "id": "tunnel_street_casing",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && (class == 'street' || class == 'street_limited')"
  }, {
    "id": "tunnel_street",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && (class == 'street' || class == 'street_limited')"
  }, {
    "id": "tunnel_main",
    "filter": "source == 'osm-bright' && layer == 'tunnel' && class == 'main'"
  }, {
    "id": "road_motorway_link_casing",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'motorway_link'"
  }, {
    "id": "road_service_casing",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'service'"
  }, {
    "id": "road_main_casing",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'main'"
  }, {
    "id": "road_street_casing",
    "filter": "source == 'osm-bright' && layer == 'road' && (class == 'street' || class == 'street_limited')"
  }, {
    "id": "road_motorway_link",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'motorway_link'"
  }, {
    "id": "road_service",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'service'"
  }, {
    "id": "road_street",
    "filter": "source == 'osm-bright' && layer == 'road' && (class == 'street' || class == 'street_limited')"
  }, {
    "id": "road_main",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'main'"
  }, {
    "id": "road_motorway_casing",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'motorway'"
  }, {
    "id": "road_motorway",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'motorway'"
  }, {
    "id": "bridge_service_casing",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'service'"
  }, {
    "id": "bridge_service",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'service'"
  }, {
    "id": "bridge_main_casing",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'main'"
  }, {
    "id": "bridge_main",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'main'"
  }, {
    "id": "bridge_street_casing",
    "filter": "source == 'osm-bright' && layer == 'bridge' && (class == 'street' || class == 'street_limited')"
  }, {
    "id": "bridge_street",
    "filter": "source == 'osm-bright' && layer == 'bridge' && (class == 'street' || class == 'street_limited')"
  }, {
    "id": "bridge_motorway_link_casing",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'motorway_link'"
  }, {
    "id": "bridge_motorway_link",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'motorway_link'"
  }, {
    "id": "bridge_motorway_casing",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'motorway'"
  }, {
    "id": "bridge_motorway",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'motorway'"
  }, {
    "id": "road_path",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'path'"
  }, {
    "id": "road_major_rail",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'major_rail'"
  }, {
    "id": "road_major_rail_hatching",
    "filter": "source == 'osm-bright' && layer == 'road' && class == 'major_rail'"
  }, {
    "id": "bridge_path",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'path'"
  }, {
    "id": "bridge_major_rail",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'major_rail'"
  }, {
    "id": "bridge_major_rail_hatching",
    "filter": "source == 'osm-bright' && layer == 'bridge' && class == 'major_rail'"
  }, {
    "id": "admin",
    "layers": [{
      "id": "admin_level_3",
      "filter": "source == 'osm-bright' && layer == 'admin' && (admin_level == 3 || admin_level == 4 || admin_level == 5)"
    }, {
      "id": "admin_level_2",
      "filter": "source == 'osm-bright' && layer == 'admin' && admin_level == 2"
    }, {
      "id": "admin_maritime",
      "filter": "source == 'osm-bright' && layer == 'admin' && maritime == '1'"
    }]
  }, {
    "id": "country_label_line",
    "filter": "source == 'osm-bright' && layer == 'country_label_line'"
  }, {
    "id": "country_label",
    "filter": "source == 'osm-bright' && layer == 'country_label' && feature_type == 'point'"
  }, {
    "id": "marin_label_1",
    "filter": "source == 'osm-bright' && layer == 'marin_label' && labelrank == 1 && feature_type == 'line'"
  }, {
    "id": "marin_label_2",
    "filter": "source == 'osm-bright' && layer == 'marin_label' && labelrank == 2 && feature_type == 'line'"
  }, {
    "id": "marin_label_3",
    "filter": "source == 'osm-bright' && layer == 'marin_label' && labelrank == 3 && feature_type == 'line'"
  }, {
    "id": "place_label_city_point",
    "filter": "source == 'osm-bright' && layer == 'place_label' && type == 'city'"
  }, {
    "id": "place_label_city",
    "filter": "source == 'osm-bright' && layer == 'place_label' && type == 'city' && feature_type == 'point'"
  }, {
    "id": "place_label_town",
    "filter": "source == 'osm-bright' && layer == 'place_label' && type == 'town' && feature_type == 'point'"
  }, {
    "id": "place_label_village",
    "filter": "source == 'osm-bright' && layer == 'place_label' && type == 'village' && feature_type == 'point'"
  }, {
    "id": "place_label_other",
    "filter": "source == 'osm-bright' && layer == 'place_label' && (type == 'hamlet' || type == 'suburb' || type == 'neighbourhood') && feature_type == 'point'"
  }, {
    "id": "road_label",
    "filter": "source == 'osm-bright' && layer == 'road_label' && feature_type == 'line'"
  }, {
    "id": "poi_label",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && feature_type == 'point'"
  }, {
    "id": "water_label",
    "filter": "source == 'osm-bright' && layer == 'water_label' && feature_type == 'point'"
  }, {
    "id": "poi_airport",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'airport'"
  }, {
    "id": "poi_rail",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'rail'"
  }, {
    "id": "poi_bus",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'bus'"
  }, {
    "id": "poi_fire_station",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'fire-station'"
  }, {
    "id": "poi_restaurant",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'restaurant'"
  }, {
    "id": "poi_park",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'park'"
  }, {
    "id": "poi_hospital",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'hospital'"
  }, {
    "id": "poi_playground",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'playground'"
  }, {
    "id": "poi_cafe",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'cafe'"
  }, {
    "id": "poi_beer",
    "filter": "source == 'osm-bright' && layer == 'poi_label' && maki == 'beer'"
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
        "transition-fill-color": [500, 0]
      },
      "admin": {
        "opacity": 0.5
      },
      "admin_maritime": {
        "line-color": "#cfe0fa",
        "line-width": 4.5,
        "line-join": "round"
      },
      "admin_level_2": {
        "line-color": "#446",
        "line-width": ["stops", [0, 1.5], [6, 1.5], [8, 3], [22, 3]],
        "line-cap": "round",
        "line-join": "round"
      },
      "admin_level_3": {
        "line-color": "#446",
        "line-dasharray": [30, 5],
        "line-width": ["stops", [0, 0.5], [6, 0.5], [8, 1], [12, 1.5], [22, 1.5]],
        "line-join": "round"
      },
      "waterway_other": {
        "line-color": "water",
        "line-width": 0.5,
        "line-cap": "round"
      },
      "waterway_river": {
        "line-color": "water",
        "line-width": ["stops", [0, 1], [12, 1], [14, 2], [16, 3], [22, 3]],
        "line-cap": "round"
      },
      "waterway_stream_canal": {
        "line-color": "water",
        "line-width": ["stops", [0, 1], [14, 1], [16, 2], [18, 3], [22, 3]],
        "line-cap": "round"
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
        "fill-opacity": 0.7,
        "enabled": ["min", 12]
      },
      "aeroway_runway": {
        "line-color": "aeroway",
        "line-width": 5,
        "enabled": ["min", 12]
      },
      "aeroway_taxiway": {
        "line-color": "aeroway",
        "line-width": 1.5,
        "enabled": ["min", 12]
      },
      "building": {
        "fill-color": "building"
      },
      "building_wall": {
        "fill-color": "building",
        "line-color": "building_shadow",
        "fill-opacity": ["stops", [0, 0], [17, 0], [18, 1], [22, 1]]
      },
      "building_shadow": {
        "fill-color": "building_shadow",
        "fill-translate": [2, 2],
        "fill-opacity": ["stops", [0, 0], [17, 0], [18, 1], [22, 1]]
      },
      "road_motorway_casing": {
        "line-color": "motorway_casing",
        "line-width": ["stops", [6, 0.4], [7, 0.6], [8, 1.5], [10, 3], [13, 3.5], [14, 5], [15, 7], [16, 9], [22, 9]],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_motorway": {
        "line-color": "motorway",
        "line-width": ["stops", [7, 0], [8, 0.5], [10, 1], [13, 2], [14, 3.5], [15, 5], [16, 7], [22, 7]],
        "line-opacity": ["stops", [7, 0], [8, 1], [22, 1]],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_main_casing": {
        "line-color": "motorway_casing",
        "line-width": ["stops", [6, 0.2], [16, 8], [22, 8]],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_main": {
        "line-color": "main",
        "line-width": ["stops", [8, 0.5], [10, 1], [13, 1.5], [14, 2.5], [15, 3.5], [16, 6], [22, 6]],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_motorway_link_casing": {
        "line-color": "motorway_casing",
        "line-width": ["stops", [13, 1], [14, 3], [15, 5], [16, 6.5], [22, 6.5]],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_motorway_link": {
        "line-color": "motorway",
        "line-width": ["stops", [13, 1.5], [14, 1.5], [15, 3], [16, 4.5], [22, 4.5]],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_street_casing": {
        "line-color": "street_casing",
        "line-width": ["stops", [0, 1], [12, 1], [14, 1], [15, 4], [16, 6.5], [22, 6.5]],
        "enabled": ["min", 12],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_street": {
        "line-color": "street",
        "line-width": ["stops", [14.5, 0], [15, 2.5], [16, 4], [22, 4]],
        "enabled": ["min", 12],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_service_casing": {
        "line-color": "street_casing",
        "line-width": ["stops", [0, 1], [15, 1], [16, 4], [22, 4]],
        "enabled": ["min", 15],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_service": {
        "line-color": "street",
        "line-width": 2,
        "enabled": ["min", 15],
        "line-cap": "round",
        "line-join": "round"
      },
      "road_path": {
        "line-color": "path",
        "line-dasharray": [2, 1],
        "line-width": ["stops", [15, 1], [16, 1.2], [17, 1.5], [22, 1.5]],
        "enabled": ["min", 15]
      },
      "road_major_rail": {
        "line-color": "rail",
        "line-width": ["stops", [0, 0.4], [16, 0.75], [22, 0.75]]
      },
      "road_major_rail_hatching": {
        "line-color": "rail",
        "line-dasharray": [2, 31],
        "line-width": 4
      },
      "bridge_motorway_casing": {
        "line-color": "motorway_casing",
        "line-width": ["stops", [6, 0.4], [7, 0.6], [8, 1.5], [10, 3], [13, 3.5], [14, 5], [15, 7], [16, 9], [22, 9]],
        "line-join": "round"
      },
      "bridge_motorway": {
        "line-color": "motorway",
        "line-width": ["stops", [7, 0], [8, 0.5], [10, 1], [13, 2], [14, 3.5], [15, 5], [16, 7], [22, 7]],
        "line-opacity": ["stops", [7, 0], [8, 1], [22, 1]],
        "line-join": "round"
      },
      "bridge_main_casing": {
        "line-color": "motorway_casing",
        "line-width": ["stops", [6, 0.2], [16, 8], [22, 8]],
        "line-join": "round"
      },
      "bridge_main": {
        "line-color": "main",
        "line-width": ["stops", [8, 0.5], [10, 1], [13, 1.5], [14, 2.5], [15, 3.5], [16, 6], [22, 6]],
        "line-join": "round"
      },
      "bridge_motorway_link_casing": {
        "line-color": "motorway_casing",
        "line-width": ["stops", [13, 1], [14, 3], [15, 5], [16, 6.5], [22, 6.5]],
        "line-join": "round"
      },
      "bridge_motorway_link": {
        "line-color": "motorway",
        "line-width": ["stops", [13, 1.5], [14, 1.5], [15, 3], [16, 4.5], [22, 4.5]],
        "line-join": "round"
      },
      "bridge_street_casing": {
        "line-color": "street_casing",
        "line-width": ["stops", [12, 0.5], [14, 1], [15, 4], [16, 6.5], [22, 6.5]],
        "enabled": ["min", 12],
        "line-join": "round"
      },
      "bridge_street": {
        "line-color": "street",
        "line-width": ["stops", [14, 0], [15, 2.5], [16, 4], [22, 4]],
        "line-opacity": ["stops", [14, 0], [15, 1], [22, 1]],
        "enabled": ["min", 12],
        "line-join": "round"
      },
      "bridge_service_casing": {
        "line-color": "street_casing",
        "line-width": ["stops", [15, 1], [16, 4], [22, 4]],
        "enabled": ["min", 15],
        "line-join": "round"
      },
      "bridge_service": {
        "line-color": "street",
        "line-width": 2,
        "enabled": ["min", 15],
        "line-join": "round"
      },
      "bridge_path": {
        "line-color": "path",
        "line-dasharray": [2, 1],
        "line-width": ["stops", [15, 1], [16, 1.2], [17, 1.5], [22, 1.5]],
        "enabled": ["min", 15]
      },
      "bridge_major_rail": {
        "line-color": "rail",
        "line-width": ["stops", [0, 0.4], [16, 0.75], [22, 0.75]]
      },
      "bridge_major_rail_hatching": {
        "line-color": "rail",
        "line-dasharray": [2, 31],
        "line-width": 4
      },
      "tunnel_motorway_casing": {
        "line-color": "motorway_casing",
        "line-dasharray": [7, 2],
        "line-width": ["stops", [6, 0.4], [7, 0.6], [8, 1.5], [10, 3], [13, 3.5], [14, 5], [15, 7], [16, 9], [22, 9]],
        "line-cap": "round",
        "line-join": "round"
      },
      "tunnel_motorway": {
        "line-color": "motorway_tunnel",
        "line-width": ["stops", [7, 0], [8, 0.5], [10, 1], [13, 2], [14, 3.5], [15, 5], [16, 7], [22, 7]],
        "line-opacity": ["stops", [7, 0], [8, 1], [22, 1]],
        "line-cap": "round",
        "line-join": "round"
      },
      "tunnel_main_casing": {
        "line-color": "motorway_casing",
        "line-dasharray": [7, 2],
        "line-width": ["stops", [6, 0.2], [16, 8], [22, 8]],
        "line-cap": "round",
        "line-join": "round"
      },
      "tunnel_main": {
        "line-color": "main_tunnel",
        "line-width": ["stops", [8, 0.5], [10, 1], [13, 1.5], [14, 2.5], [15, 3.5], [16, 6], [22, 6]],
        "line-cap": "round",
        "line-join": "round"
      },
      "tunnel_motorway_link_casing": {
        "line-color": "motorway_casing",
        "line-width": ["stops", [13, 1], [14, 3], [15, 5], [16, 6.5], [22, 6.5]],
        "line-cap": "round",
        "line-join": "round"
      },
      "tunnel_motorway_link": {
        "line-color": "motorway",
        "line-width": ["stops", [14, 1.5], [15, 3], [16, 4.5], [22, 4.5]],
        "line-cap": "round",
        "line-join": "round"
      },
      "tunnel_street_casing": {
        "line-color": "street_casing",
        "line-dasharray": [7, 2],
        "line-width": ["stops", [12, 0.5], [14, 1], [15, 4], [16, 6.5], [22, 6.5]],
        "enabled": ["min", 12],
        "line-join": "round"
      },
      "tunnel_street": {
        "line-color": "street",
        "line-width": ["stops", [14, 0], [15, 2.5], [16, 4], [22, 4]],
        "line-opacity": ["stops", [14, 0], [15, 1], [22, 1]],
        "enabled": ["min", 12],
        "line-join": "round"
      },
      "tunnel_service_casing": {
        "line-color": "street_casing",
        "line-dasharray": [7, 2],
        "line-width": ["stops", [15, 1], [16, 4], [22, 4]],
        "enabled": ["min", 15],
        "line-cap": "round",
        "line-join": "round"
      },
      "tunnel_service": {
        "line-color": "street",
        "line-width": 2,
        "enabled": ["min", 15],
        "line-cap": "round",
        "line-join": "round"
      },
      "tunnel_major_rail": {
        "line-color": "rail",
        "line-width": ["stops", [0, 0.4], [16, 0.75], [22, 0.75]]
      },
      "tunnel_major_rail_hatching": {
        "line-color": "rail",
        "line-dasharray": [2, 31],
        "line-width": 4
      },
      "country_label": {
        "text-color": "text",
        "text-halo-color": [1, 1, 1, 0.8],
        "enabled": ["min", 3],
        "text-field": "name",
        "text-size": 13,
        "text-path": "horizontal"
      },
      "country_label_line": {
        "line-color": "text",
        "line-width": 0.5,
        "line-opacity": 0.5,
        "enabled": ["min", 3]
      },
      "marin_label_1": {
        "text-color": "marine_text",
        "text-halo-color": [1, 1, 1, 0.8],
        "text-field": "name",
        "text-size": 22,
        "text-path": "curve"
      },
      "marin_label_2": {
        "text-color": "marine_text",
        "text-halo-color": [1, 1, 1, 0.8],
        "text-field": "name",
        "text-size": 16,
        "text-path": "curve"
      },
      "marin_label_3": {
        "text-color": "marine_text",
        "text-halo-color": [1, 1, 1, 0.8],
        "text-field": "name",
        "text-size": 14,
        "text-path": "curve"
      },
      "place_label_city_point": {
        "point-color": "#333",
        "point-radius": 2
      },
      "place_label_city": {
        "text-color": "#333",
        "text-halo-color": [1, 1, 1, 0.8],
        "size": ["stops", [0, 10], [10, 18], [12, 24]],
        "text-translate": [0, 30],
        "text-field": "name",
        "text-size": 24,
        "text-path": "horizontal"
      },
      "place_label_town": {
        "text-color": "#333",
        "text-halo-color": [1, 1, 1, 0.8],
        "size": ["stops", [0, 14], [12, 16], [14, 20], [16, 24]],
        "text-field": "name",
        "text-size": 24,
        "text-path": "horizontal"
      },
      "place_label_village": {
        "text-color": "#333",
        "text-halo-color": [1, 1, 1, 0.8],
        "size": ["stops", [0, 12], [12, 14], [14, 28], [16, 22]],
        "text-field": "name",
        "text-size": 22,
        "text-path": "horizontal"
      },
      "place_label_other": {
        "text-color": "#633",
        "text-halo-color": [1, 1, 1, 0.8],
        "size": ["stops", [0, 10], [14, 11], [15, 12], [16, 14]],
        "text-field": "name",
        "text-size": 14,
        "text-path": "horizontal"
      },
      "poi_label": {
        "text-color": "#666",
        "text-halo-color": [1, 1, 1, 0.5],
        "text-field": "name",
        "text-size": 12,
        "text-path": "horizontal",
        "text-padding": 2
      },
      "road_label": {
        "text-color": "#765",
        "text-halo-color": [1, 1, 1, 0.5],
        "size": ["stops", [0, 12], [14, 12], [15, 13]],
        "text-field": "name",
        "text-size": 13,
        "text-path": "curve",
        "text-padding": 2
      },
      "water_label": {
        "text-color": "marine_text",
        "text-halo-color": [1, 1, 1, 0.75],
        "text-field": "name",
        "text-size": 12,
        "text-path": "horizontal"
      },
      "poi_airport": {
        "point-color": "maki",
        "point-image": "airport-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      },
      "poi_restaurant": {
        "point-color": "maki",
        "point-image": "restaurant-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      },
      "poi_bus": {
        "point-color": "maki",
        "point-image": "bus-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      },
      "poi_rail": {
        "point-color": "maki",
        "point-image": "rail-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      },
      "poi_fire_station": {
        "point-color": "maki",
        "point-image": "fire-station-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      },
      "poi_park": {
        "point-color": "maki",
        "point-image": "park-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      },
      "poi_hospital": {
        "point-color": "maki",
        "point-image": "hospital-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      },
      "poi_playground": {
        "point-color": "maki",
        "point-image": "playground-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      },
      "poi_cafe": {
        "point-color": "maki",
        "point-image": "cafe-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      },
      "poi_beer": {
        "point-color": "maki",
        "point-image": "beer-12",
        "point-translate": "point_translate",
        "point-size": [12, 12]
      }
    }
  },
  "sprite": "/img/sprite"
}
