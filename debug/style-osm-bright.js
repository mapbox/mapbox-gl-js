"use strict";

module.exports = {
    "buckets": {
        "admin_maritime": {
            "source": "mapbox streets",
            "layer": "admin",
            "field": "maritime",
            "value": "1",
            "join": "round",
            "type": "line"
        },
        "admin_level_2": {
            "source": "mapbox streets",
            "layer": "admin",
            "field": "admin_level",
            "value": 2,
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "admin_level_3": {
            "source": "mapbox streets",
            "layer": "admin",
            "field": "admin_level",
            "value": [
                3,
                4,
                5
            ],
            "join": "round",
            "type": "line"
        },
        "water": {
            "source": "mapbox streets",
            "layer": "water",
            "type": "fill"
        },
        "waterway_other": {
            "source": "mapbox streets",
            "layer": "waterway",
            "field": "type",
            "value": [
                "ditch",
                "drain"
            ],
            "cap": "round",
            "type": "line"
        },
        "waterway_river": {
            "source": "mapbox streets",
            "layer": "waterway",
            "field": "type",
            "value": "river",
            "cap": "round",
            "type": "line"
        },
        "waterway_stream_canal": {
            "source": "mapbox streets",
            "layer": "waterway",
            "field": "type",
            "value": [
                "stream",
                "canal"
            ],
            "cap": "round",
            "type": "line"
        },
        "landuse_park": {
            "source": "mapbox streets",
            "layer": "landuse",
            "field": "class",
            "value": "park",
            "type": "fill"
        },
        "landuse_cemetary": {
            "source": "mapbox streets",
            "layer": "landuse",
            "field": "class",
            "value": "cemetary",
            "type": "fill"
        },
        "landuse_hospital": {
            "source": "mapbox streets",
            "layer": "landuse",
            "field": "class",
            "value": "hospital",
            "type": "fill"
        },
        "landuse_school": {
            "source": "mapbox streets",
            "layer": "landuse",
            "field": "class",
            "value": "school",
            "type": "fill"
        },
        "landuse_wood": {
            "source": "mapbox streets",
            "layer": "landuse",
            "field": "class",
            "value": "wood",
            "type": "fill"
        },
        "building": {
            "source": "mapbox streets",
            "layer": "building",
            "type": "fill"
        },
        "aeroway_fill": {
            "source": "mapbox streets",
            "layer": "aeroway",
            "type": "fill",
            "enabled": 12
        },
        "aeroway_runway": {
            "source": "mapbox streets",
            "layer": "aeroway",
            "field": "type",
            "value": "runway",
            "type": "line",
            "enabled": 12
        },
        "aeroway_taxiway": {
            "source": "mapbox streets",
            "layer": "aeroway",
            "field": "type",
            "value": "taxiway",
            "type": "line",
            "enabled": 12
        },
        "motorway": {
            "source": "mapbox streets",
            "layer": "road",
            "field": "class",
            "value": "motorway",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "motorway_link": {
            "source": "mapbox streets",
            "layer": "road",
            "field": "class",
            "value": "motorway_link",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "main": {
            "source": "mapbox streets",
            "layer": "road",
            "field": "class",
            "value": "main",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "street": {
            "source": "mapbox streets",
            "layer": "road",
            "field": "class",
            "value": [
                "street",
                "street_limited"
            ],
            "join": "round",
            "cap": "round",
            "type": "line",
            "enabled": 12
        },
        "service": {
            "source": "mapbox streets",
            "layer": "road",
            "field": "class",
            "value": "service",
            "join": "round",
            "cap": "round",
            "type": "line",
            "enabled": 15
        },
        "path": {
            "source": "mapbox streets",
            "layer": "road",
            "field": "class",
            "value": "path",
            "type": "line",
            "enabled": 15
        },
        "major_rail": {
            "source": "mapbox streets",
            "layer": "road",
            "field": "class",
            "value": "major_rail",
            "type": "line"
        },
        "tunnel_motorway": {
            "source": "mapbox streets",
            "layer": "tunnel",
            "field": "class",
            "value": "motorway",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "tunnel_motorway_link": {
            "source": "mapbox streets",
            "layer": "tunnel",
            "field": "class",
            "value": "motorway_link",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "tunnel_main": {
            "source": "mapbox streets",
            "layer": "tunnel",
            "field": "class",
            "value": "main",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "tunnel_street": {
            "source": "mapbox streets",
            "layer": "tunnel",
            "field": "class",
            "value": [
                "street",
                "street_limited"
            ],
            "join": "round",
            "type": "line"
        },
        "tunnel_service": {
            "source": "mapbox streets",
            "layer": "tunnel",
            "field": "class",
            "value": "service",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "tunnel_path": {
            "source": "mapbox streets",
            "layer": "tunnel",
            "field": "class",
            "value": "path",
            "type": "line",
            "enabled": 15
        },
        "tunnel_major_rail": {
            "source": "mapbox streets",
            "layer": "tunnel",
            "field": "class",
            "value": "major_rail",
            "type": "line"
        },
        "bridge_motorway": {
            "source": "mapbox streets",
            "layer": "bridge",
            "field": "class",
            "value": "motorway",
            "join": "round",
            "type": "line"
        },
        "bridge_motorway_link": {
            "source": "mapbox streets",
            "layer": "bridge",
            "field": "class",
            "value": "motorway_link",
            "join": "round",
            "type": "line"
        },
        "bridge_main": {
            "source": "mapbox streets",
            "layer": "bridge",
            "field": "class",
            "value": "main",
            "join": "round",
            "type": "line"
        },
        "bridge_street": {
            "source": "mapbox streets",
            "layer": "bridge",
            "field": "class",
            "value": [
                "street",
                "street_limited"
            ],
            "join": "round",
            "type": "line",
            "enabled": 12
        },
        "bridge_service": {
            "source": "mapbox streets",
            "layer": "bridge",
            "field": "class",
            "value": "service",
            "join": "round",
            "type": "line",
            "enabled": 15
        },
        "bridge_major_rail": {
            "source": "mapbox streets",
            "layer": "bridge",
            "field": "class",
            "value": "major_rail",
            "type": "line"
        },
        "bridge_path": {
            "source": "mapbox streets",
            "layer": "bridge",
            "field": "class",
            "value": "path",
            "type": "line",
            "enabled": 15
        },
        "country_label": {
            "source": "mapbox streets",
            "layer": "country_label",
            "text_field": "name",
            "path": "horizontal",
            "fontSize": 13,
            "feature_type": "point",
            "type": "text",
            "enabled": 3
        },
        "country_label_line": {
            "source": "mapbox streets",
            "layer": "country_label_line",
            "type": "line",
            "enabled": 3
        },
        "marin_label_1": {
            "source": "mapbox streets",
            "layer": "marin_label",
            "field": "labelrank",
            "value": 1,
            "feature_type": "line",
            "type": "text",
            "text_field": "name",
            "path": "curve",
            "fontSize": 22
        },
        "marin_label_2": {
            "source": "mapbox streets",
            "layer": "marin_label",
            "field": "labelrank",
            "value": 2,
            "feature_type": "line",
            "type": "text",
            "text_field": "name",
            "path": "curve",
            "fontSize": 16
        },
        "marin_label_3": {
            "source": "mapbox streets",
            "layer": "marin_label",
            "field": "labelrank",
            "value": 3,
            "feature_type": "line",
            "type": "text",
            "text_field": "name",
            "path": "curve",
            "fontSize": 14
        },
        "place_label_city_point": {
            "source": "mapbox streets",
            "layer": "place_label",
            "field": "type",
            "value": "city",
            "type": "point"
        },
        "place_label_city": {
            "source": "mapbox streets",
            "layer": "place_label",
            "field": "type",
            "value": "city",
            "text_field": "name",
            "path": "horizontal",
            "fontSize": 24,
            "feature_type": "point",
            "type": "text"
        },
        "place_label_town": {
            "source": "mapbox streets",
            "layer": "place_label",
            "field": "type",
            "value": "town",
            "text_field": "name",
            "path": "horizontal",
            "fontSize": 24,
            "feature_type": "point",
            "type": "text"
        },
        "place_label_village": {
            "source": "mapbox streets",
            "layer": "place_label",
            "field": "type",
            "value": "village",
            "text_field": "name",
            "path": "horizontal",
            "fontSize": 22,
            "feature_type": "point",
            "type": "text"
        },
        "place_label_other": {
            "source": "mapbox streets",
            "layer": "place_label",
            "field": "type",
            "value": [
                "hamlet",
                "suburb",
                "neighbourhood"
            ],
            "text_field": "name",
            "path": "horizontal",
            "fontSize": 14,
            "feature_type": "point",
            "type": "text"
        },
        "poi_label": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "text_field": "name",
            "path": "horizontal",
            "padding": 2,
            "fontSize": 12,
            "feature_type": "point",
            "type": "text"
        },
        "road_label": {
            "source": "mapbox streets",
            "layer": "road_label",
            "text_field": "name",
            "path": "curve",
            "padding": 2,
            "fontSize": 13,
            "feature_type": "line",
            "type": "text"
        },
        "water_label": {
            "source": "mapbox streets",
            "layer": "water_label",
            "text_field": "name",
            "path": "horizontal",
            "fontSize": 12,
            "feature_type": "point",
            "type": "text"
        },
        "poi_airport": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "airport",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        },
        "poi_rail": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "rail",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        },
        "poi_fire_station": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "fire-station",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        },
        "poi_bus": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "bus",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        },
        "poi_restaurant": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "restaurant",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        },
        "poi_park": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "park",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        },
        "poi_playground": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "playground",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        },
        "poi_hospital": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "hospital",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        },
        "poi_cafe": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "cafe",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        },
        "poi_beer": {
            "source": "mapbox streets",
            "layer": "poi_label",
            "field": "maki",
            "value": "beer",
            "size": {
                "x": 12,
                "y": 12
            },
            "type": "point"
        }
    },
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
        "point_translate": [
            0, -30
        ]
    },
    "structure": [{
        "name": "background",
        "bucket": "background"
    }, {
        "name": "waterway_other",
        "bucket": "waterway_other"
    }, {
        "name": "waterway_river",
        "bucket": "waterway_river"
    }, {
        "name": "waterway_stream_canal",
        "bucket": "waterway_stream_canal"
    }, {
        "name": "landuse_park",
        "bucket": "landuse_park"
    }, {
        "name": "landuse_cemetary",
        "bucket": "landuse_cemetary"
    }, {
        "name": "landuse_hospital",
        "bucket": "landuse_hospital"
    }, {
        "name": "landuse_school",
        "bucket": "landuse_school"
    }, {
        "name": "landuse_wood",
        "bucket": "landuse_wood"
    }, {
        "name": "water",
        "bucket": "water"
    }, {
        "name": "water_offset",
        "bucket": "water"
    }, {
        "name": "aeroway_fill",
        "bucket": "aeroway_fill"
    }, {
        "name": "aeroway_runway",
        "bucket": "aeroway_runway"
    }, {
        "name": "aeroway_taxiway",
        "bucket": "aeroway_taxiway"
    }, {
        "name": "building_shadow",
        "bucket": "building"
    }, {
        "name": "building",
        "bucket": "building"
    }, {
        "name": "building_wall",
        "bucket": "building"
    }, {
        "name": "tunnel_motorway_link_casing",
        "bucket": "tunnel_motorway_link"
    }, {
        "name": "tunnel_motorway_casing",
        "bucket": "tunnel_motorway"
    }, {
        "name": "tunnel_motorway_link",
        "bucket": "tunnel_motorway_link"
    }, {
        "name": "tunnel_motorway",
        "bucket": "tunnel_motorway"
    }, {
        "name": "tunnel_path",
        "bucket": "tunnel_path"
    }, {
        "name": "tunnel_major_rail",
        "bucket": "tunnel_major_rail"
    }, {
        "name": "tunnel_major_rail_hatching",
        "bucket": "tunnel_major_rail"
    }, {
        "name": "tunnel_service_casing",
        "bucket": "tunnel_service"
    }, {
        "name": "tunnel_service",
        "bucket": "tunnel_service"
    }, {
        "name": "tunnel_main_casing",
        "bucket": "tunnel_main"
    }, {
        "name": "tunnel_street_casing",
        "bucket": "tunnel_street"
    }, {
        "name": "tunnel_street",
        "bucket": "tunnel_street"
    }, {
        "name": "tunnel_main",
        "bucket": "tunnel_main"
    }, {
        "name": "road_motorway_link_casing",
        "bucket": "motorway_link"
    }, {
        "name": "road_service_casing",
        "bucket": "service"
    }, {
        "name": "road_main_casing",
        "bucket": "main"
    }, {
        "name": "road_street_casing",
        "bucket": "street"
    }, {
        "name": "road_motorway_link",
        "bucket": "motorway_link"
    }, {
        "name": "road_service",
        "bucket": "service"
    }, {
        "name": "road_street",
        "bucket": "street"
    }, {
        "name": "road_main",
        "bucket": "main"
    }, {
        "name": "road_motorway_casing",
        "bucket": "motorway"
    }, {
        "name": "road_motorway",
        "bucket": "motorway"
    }, {
        "name": "bridge_service_casing",
        "bucket": "bridge_service"
    }, {
        "name": "bridge_service",
        "bucket": "bridge_service"
    }, {
        "name": "bridge_main_casing",
        "bucket": "bridge_main"
    }, {
        "name": "bridge_main",
        "bucket": "bridge_main"
    }, {
        "name": "bridge_street_casing",
        "bucket": "bridge_street"
    }, {
        "name": "bridge_street",
        "bucket": "bridge_street"
    }, {
        "name": "bridge_motorway_link_casing",
        "bucket": "bridge_motorway_link"
    }, {
        "name": "bridge_motorway_link",
        "bucket": "bridge_motorway_link"
    }, {
        "name": "bridge_motorway_casing",
        "bucket": "bridge_motorway"
    }, {
        "name": "bridge_motorway",
        "bucket": "bridge_motorway"
    }, {
        "name": "road_path",
        "bucket": "path"
    }, {
        "name": "road_major_rail",
        "bucket": "major_rail"
    }, {
        "name": "road_major_rail_hatching",
        "bucket": "major_rail"
    }, {
        "name": "bridge_path",
        "bucket": "bridge_path"
    }, {
        "name": "bridge_major_rail",
        "bucket": "bridge_major_rail"
    }, {
        "name": "bridge_major_rail_hatching",
        "bucket": "bridge_major_rail"
    }, {
        "name": "admin_level_3",
        "bucket": "admin_level_3"
    }, {
        "name": "admin_level_2",
        "bucket": "admin_level_2"
    }, {
        "name": "admin_maritime",
        "bucket": "admin_maritime"
    }, {
        "name": "country_label_line",
        "bucket": "country_label_line"
    }, {
        "name": "country_label",
        "bucket": "country_label"
    }, {
        "name": "marin_label_1",
        "bucket": "marin_label_1"
    }, {
        "name": "marin_label_2",
        "bucket": "marin_label_2"
    }, {
        "name": "marin_label_3",
        "bucket": "marin_label_3"
    }, {
        "name": "place_label_city_point",
        "bucket": "place_label_city_point"
    }, {
        "name": "place_label_city",
        "bucket": "place_label_city"
    }, {
        "name": "place_label_town",
        "bucket": "place_label_town"
    }, {
        "name": "place_label_village",
        "bucket": "place_label_village"
    }, {
        "name": "place_label_other",
        "bucket": "place_label_other"
    }, {
        "name": "road_label",
        "bucket": "road_label"
    }, {
        "name": "poi_label",
        "bucket": "poi_label"
    }, {
        "name": "water_label",
        "bucket": "water_label"
    }, {
        "name": "poi_airport",
        "bucket": "poi_airport"
    }, {
        "name": "poi_rail",
        "bucket": "poi_rail"
    }, {
        "name": "poi_bus",
        "bucket": "poi_bus"
    }, {
        "name": "poi_fire_station",
        "bucket": "poi_fire_station"
    }, {
        "name": "poi_restaurant",
        "bucket": "poi_restaurant"
    }, {
        "name": "poi_park",
        "bucket": "poi_park"
    }, {
        "name": "poi_hospital",
        "bucket": "poi_hospital"
    }, {
        "name": "poi_playground",
        "bucket": "poi_playground"
    }, {
        "name": "poi_cafe",
        "bucket": "poi_cafe"
    }, {
        "name": "poi_beer",
        "bucket": "poi_beer"
    }],
    "classes": [{
        "name": "default",
        "layers": {
            "background": {
                "color": "land",
            },
            "admin_maritime": {
                "color": "#cfe0fa",
                "width": 4.5,
            },
            "admin_level_2": {
                "color": "#446",
                "width": [
                    "stops", {
                        "z": 0,
                        "val": 1.5
                    }, {
                        "z": 6,
                        "val": 1.5
                    }, {
                        "z": 8,
                        "val": 3
                    }, {
                        "z": 22,
                        "val": 3
                    }
                ],
            },
            "admin_level_3": {
                "color": "#446",
                "dasharray": [
                    30,
                    5
                ],
                "width": [
                    "stops", {
                        "z": 0,
                        "val": 0.5
                    }, {
                        "z": 6,
                        "val": 0.5
                    }, {
                        "z": 8,
                        "val": 1
                    }, {
                        "z": 12,
                        "val": 1.5
                    }, {
                        "z": 22,
                        "val": 1.5
                    }
                ],
            },
            "waterway_other": {
                "color": "water",
                "width": 0.5,
            },
            "waterway_river": {
                "color": "water",
                "width": [
                    "stops", {
                        "z": 0,
                        "val": 1
                    }, {
                        "z": 12,
                        "val": 1
                    }, {
                        "z": 14,
                        "val": 2
                    }, {
                        "z": 16,
                        "val": 3
                    }, {
                        "z": 22,
                        "val": 3
                    }
                ],
            },
            "waterway_stream_canal": {
                "color": "water",
                "width": [
                    "stops", {
                        "z": 0,
                        "val": 1
                    }, {
                        "z": 14,
                        "val": 1
                    }, {
                        "z": 16,
                        "val": 2
                    }, {
                        "z": 18,
                        "val": 3
                    }, {
                        "z": 22,
                        "val": 3
                    }
                ],
            },
            "landuse_park": {
                "color": "park",
            },
            "landuse_cemetary": {
                "color": "cemetary",
            },
            "landuse_hospital": {
                "color": "hospital",
            },
            "landuse_school": {
                "color": "school",
            },
            "landuse_wood": {
                "color": "wood",
                "opacity": 0.1,
            },
            "water": {
                "color": "water",
            },
            "water_offset": {
                "color": "#f0f0ff",
                "image": "wave",
                "opacity": 0.4,
                "translate": [
                    0,
                    2.5
                ],
            },
            "aeroway_fill": {
                "color": "aeroway",
                "opacity": 0.7,
            },
            "aeroway_runway": {
                "color": "aeroway",
                "width": 5,
            },
            "aeroway_taxiway": {
                "color": "aeroway",
                "width": 1.5,
            },
            "building": {
                "color": "building",
            },
            "building_wall": {
                "color": "building",
                "stroke": "building_shadow",
                "opacity": [
                    "stops", {
                        "z": 0,
                        "val": 0
                    }, {
                        "z": 17,
                        "val": 0
                    }, {
                        "z": 18,
                        "val": 1
                    }, {
                        "z": 22,
                        "val": 1
                    }
                ],
            },
            "building_shadow": {
                "color": "building_shadow",
                "translate": [
                    2,
                    2
                ],
                "opacity": [
                    "stops", {
                        "z": 0,
                        "val": 0
                    }, {
                        "z": 17,
                        "val": 0
                    }, {
                        "z": 18,
                        "val": 1
                    }, {
                        "z": 22,
                        "val": 1
                    }
                ],
            },
            "road_motorway_casing": {
                "color": "motorway_casing",
                "width": [
                    "stops", {
                        "z": 6,
                        "val": 0.4
                    }, {
                        "z": 7,
                        "val": 0.6
                    }, {
                        "z": 8,
                        "val": 1.5
                    }, {
                        "z": 10,
                        "val": 3
                    }, {
                        "z": 13,
                        "val": 3.5
                    }, {
                        "z": 14,
                        "val": 5
                    }, {
                        "z": 15,
                        "val": 7
                    }, {
                        "z": 16,
                        "val": 9
                    }, {
                        "z": 22,
                        "val": 9
                    }
                ],
            },
            "road_motorway": {
                "color": "motorway",
                "width": [
                    "stops", {
                        "z": 7,
                        "val": 0
                    }, {
                        "z": 8,
                        "val": 0.5
                    }, {
                        "z": 10,
                        "val": 1
                    }, {
                        "z": 13,
                        "val": 2
                    }, {
                        "z": 14,
                        "val": 3.5
                    }, {
                        "z": 15,
                        "val": 5
                    }, {
                        "z": 16,
                        "val": 7
                    }, {
                        "z": 22,
                        "val": 7
                    }
                ],
                "opacity": [
                    "stops", {
                        "z": 7,
                        "val": 0
                    }, {
                        "z": 8,
                        "val": 1
                    }, {
                        "z": 22,
                        "val": 1
                    }
                ],
            },
            "road_main_casing": {
                "color": "motorway_casing",
                "width": [
                    "stops", {
                        "z": 6,
                        "val": 0.2
                    }, {
                        "z": 16,
                        "val": 8
                    }, {
                        "z": 22,
                        "val": 8
                    }
                ],
            },
            "road_main": {
                "color": "main",
                "width": [
                    "stops", {
                        "z": 8,
                        "val": 0.5
                    }, {
                        "z": 10,
                        "val": 1
                    }, {
                        "z": 13,
                        "val": 1.5
                    }, {
                        "z": 14,
                        "val": 2.5
                    }, {
                        "z": 15,
                        "val": 3.5
                    }, {
                        "z": 16,
                        "val": 6
                    }, {
                        "z": 22,
                        "val": 6
                    }
                ],
            },
            "road_motorway_link_casing": {
                "color": "motorway_casing",
                "width": [
                    "stops", {
                        "z": 13,
                        "val": 1
                    }, {
                        "z": 14,
                        "val": 3
                    }, {
                        "z": 15,
                        "val": 5
                    }, {
                        "z": 16,
                        "val": 6.5
                    }, {
                        "z": 22,
                        "val": 6.5
                    }
                ],
            },
            "road_motorway_link": {
                "color": "motorway",
                "width": [
                    "stops", {
                        "z": 13,
                        "val": 1.5
                    }, {
                        "z": 14,
                        "val": 1.5
                    }, {
                        "z": 15,
                        "val": 3
                    }, {
                        "z": 16,
                        "val": 4.5
                    }, {
                        "z": 22,
                        "val": 4.5
                    }
                ],
            },
            "road_street_casing": {
                "color": "street_casing",
                "width": [
                    "stops", {
                        "z": 0,
                        "val": 1
                    }, {
                        "z": 12,
                        "val": 1
                    }, {
                        "z": 14,
                        "val": 1
                    }, {
                        "z": 15,
                        "val": 4
                    }, {
                        "z": 16,
                        "val": 6.5
                    }, {
                        "z": 22,
                        "val": 6.5
                    }
                ],
            },
            "road_street": {
                "color": "street",
                "width": [
                    "stops", {
                        "z": 14.5,
                        "val": 0
                    }, {
                        "z": 15,
                        "val": 2.5
                    }, {
                        "z": 16,
                        "val": 4
                    }, {
                        "z": 22,
                        "val": 4
                    }
                ],
            },
            "road_service_casing": {
                "color": "street_casing",
                "width": [
                    "stops", {
                        "z": 0,
                        "val": 1
                    }, {
                        "z": 15,
                        "val": 1
                    }, {
                        "z": 16,
                        "val": 4
                    }, {
                        "z": 22,
                        "val": 4
                    }
                ],
            },
            "road_service": {
                "color": "street",
                "width": 2,
            },
            "road_path": {
                "color": "path",
                "dasharray": [
                    2,
                    1
                ],
                "width": [
                    "stops", {
                        "z": 15,
                        "val": 1
                    }, {
                        "z": 16,
                        "val": 1.2
                    }, {
                        "z": 17,
                        "val": 1.5
                    }, {
                        "z": 22,
                        "val": 1.5
                    }
                ],
            },
            "road_major_rail": {
                "color": "rail",
                "width": [
                    "stops", {
                        "z": 0,
                        "val": 0.4
                    }, {
                        "z": 16,
                        "val": 0.75
                    }, {
                        "z": 22,
                        "val": 0.75
                    }
                ],
            },
            "road_major_rail_hatching": {
                "color": "rail",
                "dasharray": [
                    2,
                    31
                ],
                "width": 4,
            },
            "bridge_motorway_casing": {
                "color": "motorway_casing",
                "width": [
                    "stops", {
                        "z": 6,
                        "val": 0.4
                    }, {
                        "z": 7,
                        "val": 0.6
                    }, {
                        "z": 8,
                        "val": 1.5
                    }, {
                        "z": 10,
                        "val": 3
                    }, {
                        "z": 13,
                        "val": 3.5
                    }, {
                        "z": 14,
                        "val": 5
                    }, {
                        "z": 15,
                        "val": 7
                    }, {
                        "z": 16,
                        "val": 9
                    }, {
                        "z": 22,
                        "val": 9
                    }
                ],
            },
            "bridge_motorway": {
                "color": "motorway",
                "width": [
                    "stops", {
                        "z": 7,
                        "val": 0
                    }, {
                        "z": 8,
                        "val": 0.5
                    }, {
                        "z": 10,
                        "val": 1
                    }, {
                        "z": 13,
                        "val": 2
                    }, {
                        "z": 14,
                        "val": 3.5
                    }, {
                        "z": 15,
                        "val": 5
                    }, {
                        "z": 16,
                        "val": 7
                    }, {
                        "z": 22,
                        "val": 7
                    }
                ],
                "opacity": [
                    "stops", {
                        "z": 7,
                        "val": 0
                    }, {
                        "z": 8,
                        "val": 1
                    }, {
                        "z": 22,
                        "val": 1
                    }
                ],
            },
            "bridge_main_casing": {
                "color": "motorway_casing",
                "width": [
                    "stops", {
                        "z": 6,
                        "val": 0.2
                    }, {
                        "z": 16,
                        "val": 8
                    }, {
                        "z": 22,
                        "val": 8
                    }
                ],
            },
            "bridge_main": {
                "color": "main",
                "width": [
                    "stops", {
                        "z": 8,
                        "val": 0.5
                    }, {
                        "z": 10,
                        "val": 1
                    }, {
                        "z": 13,
                        "val": 1.5
                    }, {
                        "z": 14,
                        "val": 2.5
                    }, {
                        "z": 15,
                        "val": 3.5
                    }, {
                        "z": 16,
                        "val": 6
                    }, {
                        "z": 22,
                        "val": 6
                    }
                ],
            },
            "bridge_motorway_link_casing": {
                "color": "motorway_casing",
                "width": [
                    "stops", {
                        "z": 13,
                        "val": 1
                    }, {
                        "z": 14,
                        "val": 3
                    }, {
                        "z": 15,
                        "val": 5
                    }, {
                        "z": 16,
                        "val": 6.5
                    }, {
                        "z": 22,
                        "val": 6.5
                    }
                ],
            },
            "bridge_motorway_link": {
                "color": "motorway",
                "width": [
                    "stops", {
                        "z": 13,
                        "val": 1.5
                    }, {
                        "z": 14,
                        "val": 1.5
                    }, {
                        "z": 15,
                        "val": 3
                    }, {
                        "z": 16,
                        "val": 4.5
                    }, {
                        "z": 22,
                        "val": 4.5
                    }
                ],
            },
            "bridge_street_casing": {
                "color": "street_casing",
                "width": [
                    "stops", {
                        "z": 12,
                        "val": 0.5
                    }, {
                        "z": 14,
                        "val": 1
                    }, {
                        "z": 15,
                        "val": 4
                    }, {
                        "z": 16,
                        "val": 6.5
                    }, {
                        "z": 22,
                        "val": 6.5
                    }
                ],
            },
            "bridge_street": {
                "color": "street",
                "width": [
                    "stops", {
                        "z": 14,
                        "val": 0
                    }, {
                        "z": 15,
                        "val": 2.5
                    }, {
                        "z": 16,
                        "val": 4
                    }, {
                        "z": 22,
                        "val": 4
                    }
                ],
                "opacity": [
                    "stops", {
                        "z": 14,
                        "val": 0
                    }, {
                        "z": 15,
                        "val": 1
                    }, {
                        "z": 22,
                        "val": 1
                    }
                ],
            },
            "bridge_service_casing": {
                "color": "street_casing",
                "width": [
                    "stops", {
                        "z": 15,
                        "val": 1
                    }, {
                        "z": 16,
                        "val": 4
                    }, {
                        "z": 22,
                        "val": 4
                    }
                ],
            },
            "bridge_service": {
                "color": "street",
                "width": 2,
            },
            "bridge_path": {
                "color": "path",
                "dasharray": [
                    2,
                    1
                ],
                "width": [
                    "stops", {
                        "z": 15,
                        "val": 1
                    }, {
                        "z": 16,
                        "val": 1.2
                    }, {
                        "z": 17,
                        "val": 1.5
                    }, {
                        "z": 22,
                        "val": 1.5
                    }
                ],
            },
            "bridge_major_rail": {
                "color": "rail",
                "width": [
                    "stops", {
                        "z": 0,
                        "val": 0.4
                    }, {
                        "z": 16,
                        "val": 0.75
                    }, {
                        "z": 22,
                        "val": 0.75
                    }
                ],
            },
            "bridge_major_rail_hatching": {
                "color": "rail",
                "dasharray": [
                    2,
                    31
                ],
                "width": 4,
            },
            "tunnel_motorway_casing": {
                "color": "motorway_casing",
                "dasharray": [
                    7,
                    2
                ],
                "width": [
                    "stops", {
                        "z": 6,
                        "val": 0.4
                    }, {
                        "z": 7,
                        "val": 0.6
                    }, {
                        "z": 8,
                        "val": 1.5
                    }, {
                        "z": 10,
                        "val": 3
                    }, {
                        "z": 13,
                        "val": 3.5
                    }, {
                        "z": 14,
                        "val": 5
                    }, {
                        "z": 15,
                        "val": 7
                    }, {
                        "z": 16,
                        "val": 9
                    }, {
                        "z": 22,
                        "val": 9
                    }
                ],
            },
            "tunnel_motorway": {
                "color": "motorway_tunnel",
                "width": [
                    "stops", {
                        "z": 7,
                        "val": 0
                    }, {
                        "z": 8,
                        "val": 0.5
                    }, {
                        "z": 10,
                        "val": 1
                    }, {
                        "z": 13,
                        "val": 2
                    }, {
                        "z": 14,
                        "val": 3.5
                    }, {
                        "z": 15,
                        "val": 5
                    }, {
                        "z": 16,
                        "val": 7
                    }, {
                        "z": 22,
                        "val": 7
                    }
                ],
                "opacity": [
                    "stops", {
                        "z": 7,
                        "val": 0
                    }, {
                        "z": 8,
                        "val": 1
                    }, {
                        "z": 22,
                        "val": 1
                    }
                ],
            },
            "tunnel_main_casing": {
                "color": "motorway_casing",
                "dasharray": [
                    7,
                    2
                ],
                "width": [
                    "stops", {
                        "z": 6,
                        "val": 0.2
                    }, {
                        "z": 16,
                        "val": 8
                    }, {
                        "z": 22,
                        "val": 8
                    }
                ],
            },
            "tunnel_main": {
                "color": "main_tunnel",
                "width": [
                    "stops", {
                        "z": 8,
                        "val": 0.5
                    }, {
                        "z": 10,
                        "val": 1
                    }, {
                        "z": 13,
                        "val": 1.5
                    }, {
                        "z": 14,
                        "val": 2.5
                    }, {
                        "z": 15,
                        "val": 3.5
                    }, {
                        "z": 16,
                        "val": 6
                    }, {
                        "z": 22,
                        "val": 6
                    }
                ],
            },
            "tunnel_motorway_link_casing": {
                "color": "motorway_casing",
                "width": [
                    "stops", {
                        "z": 13,
                        "val": 1
                    }, {
                        "z": 14,
                        "val": 3
                    }, {
                        "z": 15,
                        "val": 5
                    }, {
                        "z": 16,
                        "val": 6.5
                    }, {
                        "z": 22,
                        "val": 6.5
                    }
                ],
            },
            "tunnel_motorway_link": {
                "color": "motorway",
                "width": [
                    "stops", {
                        "z": 14,
                        "val": 1.5
                    }, {
                        "z": 15,
                        "val": 3
                    }, {
                        "z": 16,
                        "val": 4.5
                    }, {
                        "z": 22,
                        "val": 4.5
                    }
                ],
            },
            "tunnel_street_casing": {
                "color": "street_casing",
                "dasharray": [
                    7,
                    2
                ],
                "width": [
                    "stops", {
                        "z": 12,
                        "val": 0.5
                    }, {
                        "z": 14,
                        "val": 1
                    }, {
                        "z": 15,
                        "val": 4
                    }, {
                        "z": 16,
                        "val": 6.5
                    }, {
                        "z": 22,
                        "val": 6.5
                    }
                ],
            },
            "tunnel_street": {
                "color": "street",
                "width": [
                    "stops", {
                        "z": 14,
                        "val": 0
                    }, {
                        "z": 15,
                        "val": 2.5
                    }, {
                        "z": 16,
                        "val": 4
                    }, {
                        "z": 22,
                        "val": 4
                    }
                ],
                "opacity": [
                    "stops", {
                        "z": 14,
                        "val": 0
                    }, {
                        "z": 15,
                        "val": 1
                    }, {
                        "z": 22,
                        "val": 1
                    }
                ],
            },
            "tunnel_service_casing": {
                "color": "street_casing",
                "dasharray": [
                    7,
                    2
                ],
                "width": [
                    "stops", {
                        "z": 15,
                        "val": 1
                    }, {
                        "z": 16,
                        "val": 4
                    }, {
                        "z": 22,
                        "val": 4
                    }
                ],
            },
            "tunnel_service": {
                "color": "street",
                "width": 2,
            },
            "tunnel_major_rail": {
                "color": "rail",
                "width": [
                    "stops", {
                        "z": 0,
                        "val": 0.4
                    }, {
                        "z": 16,
                        "val": 0.75
                    }, {
                        "z": 22,
                        "val": 0.75
                    }
                ],
            },
            "tunnel_major_rail_hatching": {
                "color": "rail",
                "dasharray": [
                    2,
                    31
                ],
                "width": 4,
            },
            "country_label": {
                "color": "text",
                "stroke": [
                    1,
                    1,
                    1,
                    0.8
                ],
            },
            "country_label_line": {
                "color": "text",
                "width": 0.5,
                "opacity": 0.5,
            },
            "marin_label_1": {
                "color": "marine_text",
                "stroke": [
                    1,
                    1,
                    1,
                    0.8
                ],
            },
            "marin_label_2": {
                "color": "marine_text",
                "stroke": [
                    1,
                    1,
                    1,
                    0.8
                ],
            },
            "marin_label_3": {
                "color": "marine_text",
                "stroke": [
                    1,
                    1,
                    1,
                    0.8
                ],
            },
            "place_label_city_point": {
                "color": "#333",
                "radius": 2,
            },
            "place_label_city": {
                "color": "#333",
                "stroke": [
                    1,
                    1,
                    1,
                    0.8
                ],
                "size": [
                    "stops", {
                        "z": 0,
                        "val": 10
                    }, {
                        "z": 10,
                        "val": 18
                    }, {
                        "z": 12,
                        "val": 24
                    }
                ],
                "translate": [
                    0,
                    30
                ],
            },
            "place_label_town": {
                "color": "#333",
                "stroke": [
                    1,
                    1,
                    1,
                    0.8
                ],
                "size": [
                    "stops", {
                        "z": 0,
                        "val": 14
                    }, {
                        "z": 12,
                        "val": 16
                    }, {
                        "z": 14,
                        "val": 20
                    }, {
                        "z": 16,
                        "val": 24
                    }
                ],
            },
            "place_label_village": {
                "color": "#333",
                "stroke": [
                    1,
                    1,
                    1,
                    0.8
                ],
                "size": [
                    "stops", {
                        "z": 0,
                        "val": 12
                    }, {
                        "z": 12,
                        "val": 14
                    }, {
                        "z": 14,
                        "val": 28
                    }, {
                        "z": 16,
                        "val": 22
                    }
                ],
            },
            "place_label_other": {
                "color": "#633",
                "stroke": [
                    1,
                    1,
                    1,
                    0.8
                ],
                "size": [
                    "stops", {
                        "z": 0,
                        "val": 10
                    }, {
                        "z": 14,
                        "val": 11
                    }, {
                        "z": 15,
                        "val": 12
                    }, {
                        "z": 16,
                        "val": 14
                    }
                ],
            },
            "poi_label": {
                "color": "#666",
                "stroke": [
                    1,
                    1,
                    1,
                    0.5
                ],
            },
            "road_label": {
                "color": "#765",
                "stroke": [
                    1,
                    1,
                    1,
                    0.5
                ],
                "size": [
                    "stops", {
                        "z": 0,
                        "val": 12
                    }, {
                        "z": 14,
                        "val": 12
                    }, {
                        "z": 15,
                        "val": 13
                    }
                ],
            },
            "water_label": {
                "color": "marine_text",
                "stroke": [
                    1,
                    1,
                    1,
                    0.75
                ],
            },
            "poi_airport": {
                "color": "maki",
                "image": "airport-12",
                "translate": "point_translate",
            },
            "poi_restaurant": {
                "color": "maki",
                "image": "restaurant-12",
                "translate": "point_translate",
            },
            "poi_bus": {
                "color": "maki",
                "image": "bus-12",
                "translate": "point_translate",
            },
            "poi_rail": {
                "color": "maki",
                "image": "rail-12",
                "translate": "point_translate",
            },
            "poi_fire_station": {
                "color": "maki",
                "image": "fire-station-12",
                "translate": "point_translate",
            },
            "poi_park": {
                "color": "maki",
                "image": "park-12",
                "translate": "point_translate",
            },
            "poi_hospital": {
                "color": "maki",
                "image": "hospital-12",
                "translate": "point_translate",
            },
            "poi_playground": {
                "color": "maki",
                "image": "playground-12",
                "translate": "point_translate",
            },
            "poi_cafe": {
                "color": "maki",
                "image": "cafe-12",
                "translate": "point_translate",
            },
            "poi_beer": {
                "color": "maki",
                "image": "beer-12",
                "translate": "point_translate",
            }
        }
    }],
    "sprite": "/debug/img/osm-bright-sprite"
};
