module.exports = {
    "buckets": {
        "admin_maritime": {
            "source": "outdoors",
            "layer": "admin",
            "field": "maritime",
            "value": 1,
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "admin_l2": {
            "source": "outdoors",
            "layer": "admin",
            "field": "admin_level",
            "value": 2,
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "admin_l3": {
            "source": "outdoors",
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
        "landcover_wood": {
            "source": "outdoors",
            "layer": "landcover",
            "field": "class",
            "value": "wood",
            "type": "fill"
        },
        "landcover_scrub": {
            "source": "outdoors",
            "layer": "landcover",
            "field": "class",
            "value": "scrub",
            "type": "fill"
        },
        "landcover_grass": {
            "source": "outdoors",
            "layer": "landcover",
            "field": "class",
            "value": "grass",
            "type": "fill"
        },
        "landcover_crop": {
            "source": "outdoors",
            "layer": "landcover",
            "field": "class",
            "value": "crop",
            "type": "fill"
        },
        "landcover_snow": {
            "source": "outdoors",
            "layer": "landcover",
            "field": "class",
            "value": "snow",
            "type": "fill"
        },
        "water": {
            "source": "outdoors",
            "layer": "water",
            "type": "fill"
        },
        "waterway_other": {
            "source": "outdoors",
            "layer": "waterway",
            "field": "type",
            "value": [
                "ditch",
                "drain"
            ],
            "cap": "round",
            "type": "line"
        },
        "waterway_river_canal": {
            "source": "outdoors",
            "layer": "waterway",
            "field": "type",
            "value": [
                "river",
                "canal"
            ],
            "cap": "round",
            "type": "line"
        },
        "waterway_stream": {
            "source": "outdoors",
            "layer": "waterway",
            "field": "type",
            "value": "stream",
            "cap": "round",
            "type": "line"
        },
        "landuse_park": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "park",
            "type": "fill"
        },
        "landuse_pitch": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "pitch",
            "type": "fill"
        },
        "landuse_cemetery": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "cemetery",
            "type": "fill"
        },
        "landuse_hospital": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "hospital",
            "type": "fill"
        },
        "landuse_industrial": {
            "source": "outdoors",
            "layer": "landuse",
            "type": "fill",
            "field": "class",
            "value": "industrial"
        },
        "landuse_school": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "school",
            "type": "fill"
        },
        "landuse_wood": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "wood",
            "type": "fill"
        },
        "landuse_scrub": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "scrub",
            "type": "fill"
        },
        "landuse_grass": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "grass",
            "type": "fill"
        },
        "landuse_crop": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "crop",
            "type": "fill"
        },
        "landuse_sand": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "sand",
            "type": "fill"
        },
        "landuse_rock": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "rock",
            "type": "fill"
        },
        "landuse_snow": {
            "source": "outdoors",
            "layer": "landuse",
            "field": "class",
            "value": "snow",
            "type": "fill"
        },
        "overlay_wetland": {
            "source": "outdoors",
            "layer": "landuse_overlay",
            "field": "class",
            "value": ["wetland", "wetland_noveg"],
            "type": "fill"
        },
        "overlay_breakwater_pier": {
            "source": "outdoors",
            "layer": "landuse_overlay",
            "field": "class",
            "value": [
                "breakwater",
                "pier"
            ],
            "type": "fill"
        },
        "hillshade_full_shadow": {
            "source": "outdoors",
            "layer": "hillshade",
            "field": "class",
            "value": "full_shadow",
            "type": "fill"
        },
        "hillshade_medium_shadow": {
            "source": "outdoors",
            "layer": "hillshade",
            "field": "class",
            "value": "medium_shadow",
            "type": "fill"
        },
        "hillshade_medium_highlight": {
            "source": "outdoors",
            "layer": "hillshade",
            "field": "class",
            "value": "medium_highlight",
            "type": "fill"
        },
        "hillshade_full_highlight": {
            "source": "outdoors",
            "layer": "hillshade",
            "field": "class",
            "value": "full_highlight",
            "type": "fill"
        },
        "contour_line_5": {
            "source": "outdoors",
            "layer": "contour",
            "field": "index",
            "join": "round",
            "value": 5,
            "type": "line"
        },
        "contour_line_10": {
            "source": "outdoors",
            "layer": "contour",
            "field": "index",
            "join": "round",
            "value": 10,
            "type": "line"
        },
        "contour_line_other": {
            "source": "outdoors",
            "layer": "contour",
            "join": "round",
            "type": "line"
        },
        "contour_label": {
            "source": "outdoors",
            "layer": "contour",
            "field": "index",
            "value": [5, 10],
            "path": "curve",
            "text_field": "{{ele}} m",
            "font": "Open Sans Regular, Arial Unicode MS Regular",
            "fontSize": 10,
            "feature_type": "line",
            "type": "text",
            "maxAngleDelta": 0.5
        },
        "building": {
            "source": "outdoors",
            "layer": "building",
            "type": "fill"
        },
        "barrier_line_gate": {
            "source": "outdoors",
            "layer": "barrier_line",
            "field": "class",
            "value": "gate",
            "type": "line"
        },
        "barrier_line_fence": {
            "source": "outdoors",
            "layer": "barrier_line",
            "field": "class",
            "value": "fence",
            "type": "line"
        },
        "barrier_line_hedge": {
            "source": "outdoors",
            "layer": "barrier_line",
            "field": "class",
            "value": "hedge",
            "type": "line"
        },
        "barrier_line_land": {
            "source": "outdoors",
            "layer": "barrier_line",
            "field": "class",
            "value": "land",
            "type": "line"
        },
        "barrier_line_land_fill": {
            "source": "outdoors",
            "layer": "barrier_line",
            "field": "class",
            "value": "land",
            "type": "fill"
        },
        "barrier_line_cliff": {
            "source": "outdoors",
            "layer": "barrier_line",
            "field": "class",
            "value": "cliff",
            "type": "line"
        },
        "aeroway_fill": {
            "source": "outdoors",
            "layer": "aeroway",
            "type": "fill",
            "enabled": 12
        },
        "aeroway_runway": {
            "source": "outdoors",
            "layer": "aeroway",
            "field": "type",
            "value": "runway",
            "type": "line",
            "enabled": 12
        },
        "aeroway_taxiway": {
            "source": "outdoors",
            "layer": "aeroway",
            "field": "type",
            "value": "taxiway",
            "type": "line",
            "enabled": 12
        },
        "motorway": {
            "source": "outdoors",
            "layer": "road",
            "field": "class",
            "value": "motorway",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "motorway_link": {
            "source": "outdoors",
            "layer": "road",
            "field": "class",
            "value": "motorway_link",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "main": {
            "source": "outdoors",
            "layer": "road",
            "field": "class",
            "value": "main",
            "join": "round",
            "cap": "round",
            "type": "line"
        },
        "street": {
            "source": "outdoors",
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
            "source": "outdoors",
            "layer": "road",
            "field": "class",
            "value": "service",
            "join": "round",
            "cap": "round",
            "type": "line",
            "enabled": 15
        },
        "path": {
            "source": "outdoors",
            "layer": "road",
            "field": "class",
            "value": "path",
            "type": "line"
        },
        "path_footway": {
            "source": "outdoors",
            "layer": "road",
            "field": "type",
            "value": "footway",
            "type": "line"
        },
        "path_path": {
            "source": "outdoors",
            "layer": "road",
            "field": "type",
            "value": "path",
            "type": "line"
        },
        "path_cycleway": {
            "source": "outdoors",
            "layer": "road",
            "field": "type",
            "value": "cycleway",
            "type": "line"
        },
        "path_mtb": {
            "source": "outdoors",
            "layer": "road",
            "field": "type",
            "value": "mtb",
            "type": "line"
        },
        "path_steps": {
            "source": "outdoors",
            "layer": "road",
            "field": "type",
            "value": "steps",
            "type": "line"
        },
        "path_piste": {
            "source": "outdoors",
            "layer": "road",
            "field": "type",
            "value": "piste",
            "type": "line"
        },
        "major_rail": {
            "source": "outdoors",
            "layer": "road",
            "field": "class",
            "value": "major_rail",
            "type": "line"
        },
        "tunnel_motorway": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "class",
            "value": "motorway",
            "type": "line"
        },
        "tunnel_motorway_link": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "class",
            "value": "motorway_link",
            "type": "line"
        },
        "tunnel_main": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "class",
            "value": "main",
            "type": "line"
        },
        "tunnel_street": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "class",
            "value": [
                "street",
                "street_limited"
            ],
            "type": "line",
            "enabled": 12
        },
        "tunnel_service": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "class",
            "value": "service",
            "type": "line",
            "enabled": 15
        },
        "tunnel_path": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "class",
            "value": "path",
            "type": "line"
        },
        "tunnel_path_footway": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "type",
            "value": "footway",
            "type": "line"
        },
        "tunnel_path_path": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "type",
            "value": "path",
            "type": "line"
        },
        "tunnel_path_cycleway": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "type",
            "value": "cycleway",
            "type": "line"
        },
        "tunnel_path_mtb": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "type",
            "value": "mtb",
            "type": "line"
        },
        "tunnel_path_steps": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "type",
            "value": "steps",
            "type": "line"
        },
        "tunnel_path_piste": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "type",
            "value": "piste",
            "type": "line"
        },
        "tunnel_major_rail": {
            "source": "outdoors",
            "layer": "tunnel",
            "field": "class",
            "value": "major_rail",
            "type": "line"
        },
        "bridge_motorway": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "class",
            "value": "motorway",
            "type": "line"
        },
        "bridge_motorway_link": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "class",
            "value": "motorway_link",
            "type": "line"
        },
        "bridge_main": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "class",
            "value": "main",
            "type": "line"
        },
        "bridge_street": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "class",
            "value": [
                "street",
                "street_limited"
            ],
            "type": "line",
            "enabled": 12
        },
        "bridge_service": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "class",
            "value": "service",
            "type": "line",
            "enabled": 15
        },
        "bridge_path": {
            "source": "outdoors",
            "layer": "bridge",
            "type": "line"
        },
        "bridge_path_footway": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "type",
            "value": "footway",
            "type": "line"
        },
        "bridge_path_path": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "type",
            "value": "path",
            "type": "line"
        },
        "bridge_path_cycleway": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "type",
            "value": "cycleway",
            "type": "line"
        },
        "bridge_path_mtb": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "type",
            "value": "mtb",
            "type": "line"
        },
        "bridge_path_steps": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "type",
            "value": "steps",
            "type": "line"
        },
        "bridge_path_piste": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "type",
            "value": "piste",
            "type": "line"
        },
        "bridge_major_rail": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "class",
            "value": "major_rail",
            "type": "line"
        },
        "bridge_aerialway": {
            "source": "outdoors",
            "layer": "bridge",
            "field": "class",
            "value": "aerialway",
            "type": "line"
        },
        "country_label": {
            "source": "outdoors",
            "layer": "country_label",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "font": "Open Sans Semibold, Arial Unicode MS Bold",
            "fontSize": 24,
            "feature_type": "point",
            "type": "text",
            "maxWidth": 5,
        },
        "country_label_line": {
            "source": "outdoors",
            "layer": "country_label_line",
            "type": "line"
        },
        "marine_label_line_1": {
            "source": "outdoors",
            "layer": "marine_label",
            "feature_type": "line",
            "type": "text",
            "field": "labelrank",
            "value": 1,
            "text_field": "{{name_en}}",
            "path": "curve",
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 30,
            "letterSpacing": 0.4,
            "maxAngleDelta": 0.5
        },
        "marine_label_line_2": {
            "source": "outdoors",
            "layer": "marine_label",
            "feature_type": "line",
            "field": "labelrank",
            "value": 2,
            "type": "text",
            "text_field": "{{name_en}}",
            "path": "curve",
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 24,
            "letterSpacing": 0.2,
            "maxAngleDelta": 0.5
        },
        "marine_label_line_3": {
            "source": "outdoors",
            "layer": "marine_label",
            "feature_type": "line",
            "type": "text",
            "field": "labelrank",
            "value": 3,
            "text_field": "{{name_en}}",
            "path": "curve",
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 18,
            "letterSpacing": 0.1,
            "maxAngleDelta": 0.5
        },
        "marine_label_line_other": {
            "source": "outdoors",
            "layer": "marine_label",
            "feature_type": "line",
            "type": "text",
            "field": "labelrank",
            "value": [4, 5, 6],
            "text_field": "{{name_en}}",
            "path": "curve",
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 16,
            "letterSpacing": 0.1,
            "maxAngleDelta": 0.5
        },
        "marine_label_point_1": {
            "source": "outdoors",
            "layer": "marine_label",
            "feature_type": "point",
            "type": "text",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "field": "labelrank",
            "value": 1,
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 30,
            "maxWidth": 8,
            "letterSpacing": 0.4,
            "lineHeight": 2,
        },
        "marine_label_point_2": {
            "source": "outdoors",
            "layer": "marine_label",
            "feature_type": "point",
            "type": "text",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "field": "labelrank",
            "value": 2,
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 24,
            "maxWidth": 8,
            "letterSpacing": 0.2,
            "lineHeight": 1.5,
        },
        "marine_label_point_3": {
            "source": "outdoors",
            "layer": "marine_label",
            "feature_type": "point",
            "type": "text",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "field": "labelrank",
            "value": 3,
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 18,
            "maxWidth": 8,
            "letterSpacing": 0.1,
            "lineHeight": 1.3,
        },
        "marine_label_point_other": {
            "source": "outdoors",
            "layer": "marine_label",
            "feature_type": "point",
            "type": "text",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "field": "labelrank",
            "value": [4,5,6],
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 16,
            "maxWidth": 8,
            "letterSpacing": 0.1,
            "lineHeight": 1.2,
        },
        "state_label": {
            "source": "outdoors",
            "layer": "state_label",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "font": "Open Sans Regular, Arial Unicode MS Regular",
            "fontSize": 16,
            "feature_type": "point",
            "type": "text",
            "enabled": 4,
            "maxWidth": 8
        },
        "place_label_city": {
            "source": "outdoors",
            "layer": "place_label",
            "field": "type",
            "value": "city",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "font": "Open Sans Semibold, Arial Unicode MS Bold",
            "fontSize": 20,
            "feature_type": "point",
            "type": "text",
            "maxWidth": 8
        },
        "place_label_town": {
            "source": "outdoors",
            "layer": "place_label",
            "field": "type",
            "value": "town",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "font": "Open Sans Semibold, Arial Unicode MS Bold",
            "fontSize": 24,
            "feature_type": "point",
            "type": "text",
            "maxWidth": 8
        },
        "place_label_village": {
            "source": "outdoors",
            "layer": "place_label",
            "field": "type",
            "value": "village",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "font": "Open Sans Semibold, Arial Unicode MS Bold",
            "fontSize": 22,
            "feature_type": "point",
            "type": "text",
            "maxWidth": 8
        },
        "place_label_other": {
            "source": "outdoors",
            "layer": "place_label",
            "field": "type",
            "value": [
                "hamlet",
                "suburb",
                "neighbourhood"
            ],
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "font": "Open Sans Semibold, Arial Unicode MS Bold",
            "fontSize": 18,
            "maxWidth": 6,
            "feature_type": "point",
            "type": "text",
        },
        "road_label_1": {
            "source": "outdoors",
            "layer": "road_label",
            "field": "class",
            "value": ["motorway","main"],
            "text_field": "{{name_en}}",
            "path": "curve",
            "padding": 2,
            "font": "Open Sans Regular, Arial Unicode MS Regular",
            "fontSize": 18,
            "feature_type": "line",
            "type": "text",
            "maxAngleDelta": 0.5
        },
        "road_label_2": {
            "source": "outdoors",
            "layer": "road_label",
            "field": "class",
            "value": ["street","street_limited"],
            "text_field": "{{name_en}}",
            "path": "curve",
            "padding": 2,
            "font": "Open Sans Regular, Arial Unicode MS Regular",
            "fontSize": 16,
            "feature_type": "line",
            "type": "text",
            "maxAngleDelta": 0.5
        },
        "road_label_3": {
            "source": "outdoors",
            "layer": "road_label",
            "field": "class",
            "value": ["service","driveway","path"],
            "text_field": "{{name_en}}",
            "path": "curve",
            "padding": 2,
            "font": "Open Sans Regular, Arial Unicode MS Regular",
            "fontSize": 14,
            "feature_type": "line",
            "type": "text",
            "maxAngleDelta": 0.5
        },
        "water_label": {
            "source": "outdoors",
            "layer": "water_label",
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 12,
            "feature_type": "point",
            "type": "text",
            "maxWidth": 8
        },
        "waterway_label": {
            "source": "outdoors",
            "layer": "waterway_label",
            "text_field": "{{name_en}}",
            "path": "curve",
            "font": "Open Sans Semibold Italic, Arial Unicode MS Bold",
            "fontSize": 12,
            "feature_type": "line",
            "type": "text",
            "maxAngleDelta": 0.5
        },
        "poi": {
            "source": "outdoors",
            "layer": "poi_label",
            "icon": "maki",
            "field": "scalerank",
            "value": [1, 2],
            "size": 12,
            "type": "point"
        },
        "poi_3": {
            "source": "outdoors",
            "layer": "poi_label",
            "icon": "maki",
            "field": "scalerank",
            "value": 3,
            "size": 12,
            "type": "point"
        },
        "poi_4": {
            "source": "outdoors",
            "layer": "poi_label",
            "icon": "maki",
            "field": "scalerank",
            "value": 4,
            "size": 12,
            "type": "point"
        },
        "poi_aerodrome": {
            "source": "outdoors",
            "layer": "poi_label",
            "icon": "maki",
            "field": "maki",
            "value": "airport",
            "size": 24,
            "type": "point"
        },
        "poi_label_1-2": {
            "source": "outdoors",
            "layer": "poi_label",
            "field": "scalerank",
            "value": [
                1,
                2
            ],
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "padding": 2,
            "maxWidth": 10,
            "verticalAlignment": "top",
            "translate": [0, -1],
            "font": "Open Sans Semibold, Arial Unicode MS Bold",
            "fontSize": 12,
            "feature_type": "point",
            "type": "text",
        },
        "poi_label_3": {
            "source": "outdoors",
            "layer": "poi_label",
            "field": "scalerank",
            "value": 3,
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "padding": 2,
            "maxWidth": 10,
            "verticalAlignment": "top",
            "translate": [0, -1],
            "font": "Open Sans Semibold, Arial Unicode MS Bold",
            "fontSize": 11,
            "feature_type": "point",
            "type": "text",
        },
        "poi_label_4": {
            "source": "outdoors",
            "layer": "poi_label",
            "field": "scalerank",
            "value": 4,
            "text_field": "{{name_en}}",
            "path": "horizontal",
            "padding": 2,
            "maxWidth": 10,
            "verticalAlignment": "top",
            "translate": [0, -1],
            "font": "Open Sans Semibold, Arial Unicode MS Bold",
            "fontSize": 10,
            "feature_type": "point",
            "type": "text",
        }
    },
    "structure": [
        {
            "name": "background",
            "bucket": "background"
        },
        {
            "name": "landcover_snow",
            "bucket": "landcover_snow"
        },
        {
            "name": "landcover_crop",
            "bucket": "landcover_crop"
        },
        {
            "name": "landcover_grass",
            "bucket": "landcover_grass"
        },
        {
            "name": "landcover_scrub",
            "bucket": "landcover_scrub"
        },
        {
            "name": "landcover_wood",
            "bucket": "landcover_wood"
        },
        {
            "name": "landuse_wood",
            "bucket": "landuse_wood"
        },
        {
            "name": "landuse_school",
            "bucket": "landuse_school"
        },
        {
            "name": "landuse_sand",
            "bucket": "landuse_sand"
        },
        {
            "name": "landuse_pitch",
            "bucket": "landuse_pitch"
        },
        {
            "name": "landuse_park",
            "bucket": "landuse_park"
        },
        {
            "name": "landuse_industrial",
            "bucket": "landuse_industrial"
        },
        {
            "name": "landuse_scrub",
            "bucket": "landuse_scrub"
        },
        {
            "name": "landuse_grass",
            "bucket": "landuse_grass"
        },
        {
            "name": "landuse_crop",
            "bucket": "landuse_crop"
        },
        {
            "name": "landuse_rock",
            "bucket": "landuse_rock"
        },
        {
            "name": "landuse_snow",
            "bucket": "landuse_snow"
        },
        {
            "name": "landuse_hospital",
            "bucket": "landuse_hospital"
        },
        {
            "name": "landuse_cemetery",
            "bucket": "landuse_cemetery"
        },
        {
            "name": "overlay_wetland",
            "bucket": "overlay_wetland"
        },
        {
            "name": "overlay_breakwater_pier",
            "bucket": "overlay_breakwater_pier"
        },
        {
            "name": "waterway_river_canal",
            "bucket": "waterway_river_canal"
        },
        {
            "name": "waterway_stream",
            "bucket": "waterway_stream"
        },
        {
            "name": "building_shadow",
            "bucket": "building"
        },
        {
            "name": "building",
            "bucket": "building"
        },
        {
            "name": "building_wall",
            "bucket": "building"
        },
        {
            "name": "hillshade_full_highlight",
            "bucket": "hillshade_full_highlight"
        },
        {
            "name": "hillshade_medium_highlight",
            "bucket": "hillshade_medium_highlight"
        },
        {
            "name": "hillshade_medium_shadow",
            "bucket": "hillshade_medium_shadow"
        },
        {
            "name": "hillshade_full_shadow",
            "bucket": "hillshade_full_shadow"
        },
        {
            "name": "contour_line_loud",
            "bucket": "contour_line_10"
        },
        {
            "name": "contour_line_loud",
            "bucket": "contour_line_5"
        },
        {
            "name": "contour_line_regular",
            "bucket": "contour_line_other"
        },
        {
            "name": "barrier_line_gate",
            "bucket": "barrier_line_gate"
        },
        {
            "name": "barrier_line_fence",
            "bucket": "barrier_line_fence"
        },
        {
            "name": "barrier_line_hedge",
            "bucket": "barrier_line_hedge"
        },
        {
            "name": "barrier_line_land",
            "bucket": "barrier_line_land"
        },
        {
            "name": "barrier_line_land_fill",
            "bucket": "barrier_line_land_fill"
        },
        {
            "name": "barrier_line_cliff",
            "bucket": "barrier_line_cliff"
        },
        {
            "name": "water",
            "bucket": "water"
        },
        {
            "name": "aeroway_fill",
            "bucket": "aeroway_fill"
        },
        {
            "name": "aeroway_runway",
            "bucket": "aeroway_runway"
        },
        {
            "name": "aeroway_taxiway",
            "bucket": "aeroway_taxiway"
        },
        {
            "name": "tunnel_motorway_link_casing",
            "bucket": "tunnel_motorway_link"
        },
        {
            "name": "tunnel_service_casing",
            "bucket": "tunnel_service"
        },
        {
            "name": "tunnel_main_casing",
            "bucket": "tunnel_main"
        },
        {
            "name": "tunnel_street_casing",
            "bucket": "tunnel_street"
        },
        {
            "name": "tunnel_motorway_link",
            "bucket": "tunnel_motorway_link"
        },
        {
            "name": "tunnel_service",
            "bucket": "tunnel_service"
        },
        {
            "name": "tunnel_street",
            "bucket": "tunnel_street"
        },
        {
            "name": "tunnel_main",
            "bucket": "tunnel_main"
        },
        {
            "name": "tunnel_motorway_casing",
            "bucket": "tunnel_motorway"
        },
        {
            "name": "tunnel_motorway",
            "bucket": "tunnel_motorway"
        },
        {
            "name": "road_path_case",
            "bucket": "tunnel_path"
        },
        {
            "name": "road_path_footway",
            "bucket": "tunnel_path_footway"
        },
        {
            "name": "road_path_path",
            "bucket": "tunnel_path_path"
        },
        {
            "name": "road_path_cycleway",
            "bucket": "tunnel_path_cycleway"
        },
        {
            "name": "road_path_mtb",
            "bucket": "tunnel_path_mtb"
        },
        {
            "name": "road_path_piste",
            "bucket": "tunnel_path_piste"
        },
        {
            "name": "road_path_steps",
            "bucket": "tunnel_path_steps"
        },
        {
            "name": "road_major_rail",
            "bucket": "tunnel_major_rail"
        },
        {
            "name": "road_major_rail_hatching",
            "bucket": "tunnel_major_rail"
        },
        {
            "name": "road_motorway_link_casing",
            "bucket": "motorway_link"
        },
        {
            "name": "road_service_casing",
            "bucket": "service"
        },
        {
            "name": "road_main_casing",
            "bucket": "main"
        },
        {
            "name": "road_street_casing",
            "bucket": "street"
        },
        {
            "name": "road_motorway_link",
            "bucket": "motorway_link"
        },
        {
            "name": "road_service",
            "bucket": "service"
        },
        {
            "name": "road_street",
            "bucket": "street"
        },
        {
            "name": "road_main",
            "bucket": "main"
        },
        {
            "name": "road_motorway_casing",
            "bucket": "motorway"
        },
        {
            "name": "road_motorway",
            "bucket": "motorway"
        },
        {
            "name": "road_path_case",
            "bucket": "path"
        },
        {
            "name": "road_path_footway",
            "bucket": "path_footway"
        },
        {
            "name": "road_path_path",
            "bucket": "path_path"
        },
        {
            "name": "road_path_cycleway",
            "bucket": "path_cycleway"
        },
        {
            "name": "road_path_mtb",
            "bucket": "path_mtb"
        },
        {
            "name": "road_path_piste",
            "bucket": "path_piste"
        },
        {
            "name": "road_path_steps",
            "bucket": "path_steps"
        },
        {
            "name": "road_major_rail",
            "bucket": "major_rail"
        },
        {
            "name": "road_major_rail_hatching",
            "bucket": "major_rail"
        },
        {
            "name": "bridge_motorway_link_casing",
            "bucket": "bridge_motorway_link"
        },
        {
            "name": "bridge_service_casing",
            "bucket": "bridge_service"
        },
        {
            "name": "bridge_main_casing",
            "bucket": "bridge_main"
        },
        {
            "name": "bridge_street_casing",
            "bucket": "bridge_street"
        },
        {
            "name": "bridge_motorway_link",
            "bucket": "bridge_motorway_link"
        },
        {
            "name": "bridge_service",
            "bucket": "bridge_service"
        },
        {
            "name": "bridge_street",
            "bucket": "bridge_street"
        },
        {
            "name": "bridge_main",
            "bucket": "bridge_main"
        },
        {
            "name": "bridge_motorway_casing",
            "bucket": "bridge_motorway"
        },
        {
            "name": "bridge_motorway",
            "bucket": "bridge_motorway"
        },
        {
            "name": "road_path_footway",
            "bucket": "bridge_path_footway"
        },
        {
            "name": "road_path_path",
            "bucket": "bridge_path_path"
        },
        {
            "name": "road_path_cycleway",
            "bucket": "bridge_path_cycleway"
        },
        {
            "name": "road_path_mtb",
            "bucket": "bridge_path_mtb"
        },
        {
            "name": "road_path_piste",
            "bucket": "bridge_path_piste"
        },
        {
            "name": "road_path_steps",
            "bucket": "bridge_path_steps"
        },
        {
            "name": "bridge_aerialway_casing",
            "bucket": "bridge_aerialway"
        },
        {
            "name": "bridge_aerialway",
            "bucket": "bridge_aerialway"
        },
        {
            "name": "road_major_rail",
            "bucket": "bridge_major_rail"
        },
        {
            "name": "road_major_rail_hatching",
            "bucket": "bridge_major_rail"
        },
        {
            "name": "admin_l3",
            "bucket": "admin_l3"
        },
        {
            "name": "admin_l2",
            "bucket": "admin_l2"
        },
        {
            "name": "admin_maritime_cover",
            "bucket": "admin_maritime"
        },
        {
            "name": "admin_maritime",
            "bucket": "admin_maritime"
        },
        {
            "name": "country_label_line",
            "bucket": "country_label_line"
        },
        {
            "name": "country_label",
            "bucket": "country_label"
        },
        {
            "name": "marine_label_line_1",
            "bucket": "marine_label_line_1"
        },
        {
            "name": "marine_label_line_2",
            "bucket": "marine_label_line_2"
        },
        {
            "name": "marine_label_line_3",
            "bucket": "marine_label_line_3"
        },
        {
            "name": "marine_label_line_other",
            "bucket": "marine_label_line_other"
        },
        {
            "name": "marine_label_point_1",
            "bucket": "marine_label_point_1"
        },
        {
            "name": "marine_label_point_2",
            "bucket": "marine_label_point_2"
        },
        {
            "name": "marine_label_point_3",
            "bucket": "marine_label_point_3"
        },
        {
            "name": "marine_label_point_other",
            "bucket": "marine_label_point_other"
        },
        {
            "name": "state_label",
            "bucket": "state_label"
        },
        {
            "name": "place_label_city",
            "bucket": "place_label_city"
        },
        {
            "name": "place_label_town",
            "bucket": "place_label_town"
        },
        {
            "name": "place_label_village",
            "bucket": "place_label_village"
        },
        {
            "name": "place_label_other",
            "bucket": "place_label_other"
        },
        {
            "name": "road_label_1",
            "bucket": "road_label_1"
        },
        {
            "name": "road_label_2",
            "bucket": "road_label_2"
        },
        {
            "name": "road_label_3",
            "bucket": "road_label_3"
        },
        {
            "name": "contour_label",
            "bucket": "contour_label"
        },
        {
            "name": "water_label",
            "bucket": "water_label"
        },
        {
            "name": "waterway_label",
            "bucket": "waterway_label"
        },
        {
            "name": "poi",
            "bucket": "poi"
        },
        {
            "name": "poi_label_1-2",
            "bucket": "poi_label_1-2"
        },
        {
            "name": "poi_3",
            "bucket": "poi_3"
        },
        {
            "name": "poi_label_3",
            "bucket": "poi_label_3"
        },
        {
            "name": "poi_4",
            "bucket": "poi_4"
        },
        {
            "name": "poi_label_4",
            "bucket": "poi_label_4"
        },
        {
            "name": "poi_aerodrome",
            "bucket": "poi_aerodrome"
        }
    ],
    "constants": {
        "land": "rgb(244,239,225)",
        "water": "#cdd",
        "water_dark": "#185869",
        "crop": "#eeeed4",
        "grass": "#e6e6cc",
        "scrub": "#dfe5c8",
        "wood": "#cee2bd",
        "snow": "#f4f8ff",
        "rock": "#ddd",
        "sand": "#ffd",
        "cemetery": "#edf4ed",
        "pitch": "#fff",
        "park": "#d4e4bc",
        "piste": "blue",
        "school": "#e8dfe0",
        "hospital": "#f8eee0",
        "builtup": "#f6faff",
        "case": "#fff",
        "motorway": "#cda0a0",
        "main": "#ddc0b9",
        "street": "#fff",
        "text": "#666",
        "text_stroke": "rgba(255,255,255,0.8)",
        "country_text": "#222",
        "marine_text": "#a0bdc0",
        "water_text": "#185869",

        "land_night": "#017293",
        "water_night": "#103",
        "water_dark_night": "#003366",
        "crop_night": "#178d96",
        "grass_night": "#23948a",
        "scrub_night": "#31a186",
        "wood_night": "#45b581",
        "park_night": "#51bd8b",
        "snow_night": "#5ad9fe",
        "rock_night": "#999",
        "sand_night": "#437162",
        "cemetery_night": "#218c96",
        "pitch_night": "rgba(255,255,255,0.2)",
        "school_night": "#01536a",
        "hospital_night": "#015e7a",
        "builtup_night": "#014b60",

        "admin_night": "#ffb680",
        "text_night": "#fff",
        "text_water_night": "#2a5b8a",
        "text_stroke_night": "#103",
        "text2_stroke_night": "rgba(1,69,89,0.8)",

        "case_night": "#015e7a",
        "street_case_night": "#015b76",
        "motorway_night": "#bbdde7",
        "main_night": "#64b2c9",
        "street_night": "#0186ac",
        "contour_night": "#ffff80",

        "river_canal_width": [
            "stops",
            {"z": 11, "val": 0.5},
            {"z": 12, "val": 1},
            {"z": 14, "val": 2},
            {"z": 16, "val": 3}
        ],
        "stream_width": [
            "stops",
            {"z": 13, "val": 0.25},
            {"z": 14, "val": 0.5},
            {"z": 16, "val": 1.5},
            {"z": 18, "val": 2}
        ],
        "motorway_width": [
            "stops",
            {"z": 5, "val": 0},
            {"z": 6, "val": 0.5},
            {"z": 8, "val": 0.8},
            {"z": 10, "val": 1},
            {"z": 11, "val": 1.2},
            {"z": 12, "val": 2},
            {"z": 13, "val": 3},
            {"z": 14, "val": 4},
            {"z": 15, "val": 6},
            {"z": 16, "val": 9},
            {"z": 17, "val": 12},
            {"z": 18, "val": 14}
        ],
        "motorway_casing_width": [
            "stops",
            {"z": 7.5, "val": 0.6},
            {"z": 8, "val": 0.8},
            {"z": 10, "val": 2.8},
            {"z": 11, "val": 3},
            {"z": 12, "val": 4},
            {"z": 13, "val": 5},
            {"z": 14, "val": 6.5},
            {"z": 15, "val": 9},
            {"z": 16, "val": 12},
            {"z": 17, "val": 15},
            {"z": 18, "val": 17}
        ],
        "motorway_link_width": [
            "stops",
            {"z": 12, "val": 1.2},
            {"z": 14, "val": 2},
            {"z": 16, "val": 3},
            {"z": 18, "val": 4}
        ],
        "motorway_link_casing_width": [
            "stops",
            {"z": 12, "val": 2.8},
            {"z": 14, "val": 3.5},
            {"z": 16, "val": 5},
            {"z": 18, "val": 6}
        ],
        "main_width": [
            "stops",
            {"z": 5, "val": 1},
            {"z": 12, "val": 1},
            {"z": 13, "val": 1.5},
            {"z": 14, "val": 2},
            {"z": 15, "val": 3},
            {"z": 16, "val": 6},
            {"z": 17, "val": 10},
            {"z": 18, "val": 12}
        ],
        "main_casing_width": [
            "stops",
            {"z": 9, "val": 2.9},
            {"z": 12, "val": 2.9},
            {"z": 13, "val": 3.5},
            {"z": 14, "val": 4},
            {"z": 15, "val": 5.5},
            {"z": 16, "val": 9},
            {"z": 17, "val": 12},
            {"z": 18, "val": 14}
        ],
        "street_width": [
            "stops",
            {"z": 14.5, "val": 0},
            {"z": 15, "val": 1.5},
            {"z": 16, "val": 3},
            {"z": 17, "val": 8}
        ],
        "street_casing_width": [
            "stops",
            {"z": 13, "val": 0.4},
            {"z": 14, "val": 1},
            {"z": 15, "val": 2.5},
            {"z": 16, "val": 4},
            {"z": 17, "val": 10}
        ],
        "street_casing_opacity": [
            "stops",
            {"z": 14, "val": 0},
            {"z": 14.5, "val": 1}
        ],
        "service_casing_width": [
            "stops",
            {"z": 14, "val": 0.5},
            {"z": 15, "val": 3},
            {"z": 16, "val": 3.5},
            {"z": 17, "val": 4},
            {"z": 18, "val": 5},
            {"z": 19, "val": 6}
        ],
        "runway_width": [
            "stops",
            {"z": 10, "val": 1},
            {"z": 11, "val": 2},
            {"z": 12, "val": 3},
            {"z": 13, "val": 5},
            {"z": 14, "val": 7},
            {"z": 15, "val": 11},
            {"z": 16, "val": 15},
            {"z": 17, "val": 19},
            {"z": 18, "val": 23}
        ],
        "taxiway_width": [
            "stops",
            {"z": 10, "val": 0.2},
            {"z": 12, "val": 0.2},
            {"z": 13, "val": 1},
            {"z": 14, "val": 1.5},
            {"z": 15, "val": 2},
            {"z": 16, "val": 3},
            {"z": 17, "val": 4},
            {"z": 18,"val": 5}
        ],
        "aerialway_width": [
            "stops",
            {"z": 13.5, "val": 0.8},
            {"z": 14, "val": 1.4},
            {"z": 15, "val": 1.6},
            {"z": 16, "val": 2},
            {"z": 17, "val": 2.4},
            {"z": 18, "val": 3}
        ],
        "aerialway_casing_width": [
            "stops",
            {"z": 13.5, "val": 2},
            {"z": 14, "val": 2.5},
            {"z": 15, "val": 3},
            {"z": 16, "val": 3.5},
            {"z": 17, "val": 4},
            {"z": 22, "val": 5}
        ],
        "path_width": [
            "stops",
            {"z": 14, "val": 1.2},
            {"z": 15, "val": 1.5},
            {"z": 16, "val": 1.8}
        ],
        "admin_l2_width": [
            "stops",
            {"z": 2, "val": 0.5},
            {"z": 3, "val": 0.7},
            {"z": 4, "val": 0.7},
            {"z": 5, "val": 0.8},
            {"z": 6, "val": 1},
            {"z": 8, "val": 2},
            {"z": 10, "val": 3}
        ],
        "admin_l3_width": [
            "stops",
            {"z": 6, "val": 0.6},
            {"z": 8, "val": 1},
            {"z": 12, "val": 2}
        ],
        "road_label_1_size": [
            "stops",
            {"z": 13, "val": 11},
            {"z": 14, "val": 12},
            {"z": 15, "val": 13},
            {"z": 16, "val": 14},
            {"z": 17, "val": 16},
            {"z": 18, "val": 18}
        ],
        "road_label_2_size": [
            "stops",
            {"z": 13, "val": 11},
            {"z": 14, "val": 12},
            {"z": 16, "val": 14},
            {"z": 18, "val": 16}
        ],
        "road_label_3_size": [
            "stops",
            {"z": 15, "val": 10},
            {"z": 16, "val": 12},
            {"z": 18, "val": 14}
        ],
        "fence_width": [
            "stops",
            {"z": 17, "val": 0.6},
            {"z": 19, "val": 1}
        ],
        "hedge_width": [
            "stops",
            {"z": 16, "val": 0.6},
            {"z": 17, "val": 1.2},
            {"z": 19, "val": 1.6}
        ],
        "barrier_line_land_width": [
            "stops",
            {"z": 14, "val": 0.4},
            {"z": 15, "val": 0.75},
            {"z": 16, "val": 1.5},
            {"z": 17, "val": 3},
            {"z": 18, "val": 6},
            {"z": 19, "val": 12},
            {"z": 20, "val": 24},
            {"z": 21, "val": 48}
        ],
        "country_label_size": [
            "stops",
            {"z": 1, "val": 14},
            {"z": 12, "val": 24}
        ],
        "poi_label_1-2_size": [
            "stops",
            {"z": 15, "val": 10},
            {"z": 16, "val": 11},
            {"z": 17, "val": 12}
        ],
        "poi_label_3_size": [
            "stops",
            {"z": 16, "val": 10},
            {"z": 17, "val": 11}
        ],
        "hillshade_prerender": [
            "stops",
            {"z": 11, "val": 0},
            {"z": 12, "val": 1}
        ],
        "hillshade_prerender_size": [
            "stops",
            {"z": 11, "val": 1056},
            {"z": 12, "val": 512},
            {"z": 13, "val": 256}
        ]
    },
    "classes": [
        {
            "name": "default",
            "layers": {
                "background": {
                    "color": "land"
                },
                "admin_maritime_cover": {
                    "color": "water",
                    "width": 5
                },
                "admin_maritime": {
                    "color": "#c0d6d6",
                    "width": [
                        "stops",
                        {"z": 6, "val": 1},
                        {"z": 8, "val": 2},
                        {"z": 12, "val": 3}
                    ]
                },
                "admin_l2": {
                    "color": "#88a",
                    "width": "admin_l2_width"
                },
                "admin_l3": {
                    "color": "#88a",
                    "dasharray": [
                        60,
                        20
                    ],
                    "opacity": [
                        "stops",
                        {"z": 4, "val": 0},
                        {"z": 6, "val": 1}
                    ],
                    "width": "admin_l3_width"
                },
                "waterway_river_canal": {
                    "color": "#87abaf",
                    "width": "river_canal_width"
                },
                "waterway_stream": {
                    "color": "#87abaf",
                    "width": "stream_width"
                },
                "barrier_line_gate": {
                    "width": 2.5,
                    "color": "#aab"
                },
                "barrier_line_fence": {
                    "color": "#aeada3",
                    "width": "fence_width"
                },
                "barrier_line_hedge": {
                    "color": "#8de99b",
                    "width": "hedge_width"
                },
                "barrier_line_land": {
                    "color": "land",
                    "width": "barrier_line_land_width"
                },
                "barrier_line_land_fill": {
                    "color": "land"
                },
                "barrier_line_cliff": {
                    "color": "#987",
                    "width": 4
                },
                "landcover_wood": {
                    "color": "wood",
                    "opacity": [
                        "stops",
                        {"z": 13, "val": 1},
                        {"z": 14, "val": 0.8},
                        {"z": 17, "val": 0.2}
                    ]
                },
                "landcover_scrub": {
                    "color": "scrub",
                    "opacity": [
                        "stops",
                        {"z": 13, "val": 1},
                        {"z": 14, "val": 0.8},
                        {"z": 17, "val": 0.2}
                    ]
                },
                "landcover_grass": {
                    "color": "grass",
                    "opacity": [
                        "stops",
                        {"z": 13, "val": 1},
                        {"z": 14, "val": 0.8},
                        {"z": 17, "val": 0.2}
                    ]
                },
                "landcover_crop": {
                    "color": "crop"
                },
                "landcover_snow": {
                    "color": "snow"
                },
                "landuse_wood": {
                    "color": "wood"
                },
                "landuse_scrub": {
                    "color": "scrub"
                },
                "landuse_grass": {
                    "color": "grass"
                },
                "landuse_crop": {
                    "color": "crop"
                },
                "landuse_snow": {
                    "color": "snow"
                },
                "landuse_rock": {
                    "color": "rock"
                },
                "landuse_sand": {
                    "color": "sand"
                },
                "landuse_park": {
                    "color": "park"
                },
                "landuse_cemetery": {
                    "color": "cemetery"
                },
                "landuse_hospital": {
                    "color": "hospital"
                },
                "landuse_school": {
                    "color": "school"
                },
                "landuse_pitch": {
                    "color": "rgba(255,255,255,0.5)",
                    "stroke": "pitch"
                },
                "landuse_industrial": {
                    "color": "rgba(246,250,255,0.5)"
                },
                "overlay_wetland": {
                    "color": "rgba(210,225,225,0.2)",
                    "image": "wetland_noveg_64"
                },
                "overlay_breakwater_pier": {
                    "color": "land"
                },
                "hillshade_full_shadow": {
                    "color": "#103",
                    "antialias": false,
                    "prerender": "hillshade_prerender",
                    "prerender-size": "hillshade_prerender_size",
                    "prerender-blur": 1,
                    "opacity": [
                        "stops",
                        {"z": 15, "val": 0.08},
                        {"z": 16, "val": 0.075},
                        {"z": 17, "val": 0.05},
                        {"z": 18, "val": 0.05},
                        {"z": 19, "val": 0.025}
                    ]
                },
                "hillshade_medium_shadow": {
                    "color": "#206",
                    "antialias": false,
                    "prerender": "hillshade_prerender",
                    "prerender-size": "hillshade_prerender_size",
                    "prerender-blur": 1,
                    "opacity": [
                        "stops",
                        {"z": 15, "val": 0.08},
                        {"z": 16, "val": 0.075},
                        {"z": 17, "val": 0.05},
                        {"z": 18, "val": 0.05},
                        {"z": 19, "val": 0.025}
                    ]
                },
                "hillshade_full_highlight": {
                    "color": "#fffff3",
                    "antialias": false,
                    "prerender": "hillshade_prerender",
                    "prerender-size": "hillshade_prerender_size",
                    "prerender-blur": 1,
                    "opacity": [
                        "stops",
                        {"z": 15, "val": 0.3},
                        {"z": 16, "val": 0.3},
                        {"z": 17, "val": 0.2},
                        {"z": 18, "val": 0.2},
                        {"z": 19, "val": 0.1}
                    ]
                },
                "hillshade_medium_highlight": {
                    "color": "#ffd",
                    "antialias": false,
                    "prerender": "hillshade_prerender",
                    "prerender-size": "hillshade_prerender_size",
                    "prerender-blur": 1,
                    "opacity": [
                        "stops",
                        {"z": 15, "val": 0.3},
                        {"z": 16, "val": 0.3},
                        {"z": 17, "val": 0.2},
                        {"z": 18, "val": 0.2},
                        {"z": 19, "val": 0.1}
                    ]
                },
                "contour_line_loud": {
                    "color": "#008",
                    "width": 0.9,
                    "opacity": [
                        "stops",
                        {"z": 12, "val": 0.05},
                        {"z": 13, "val": 0.11}
                    ]
                },
                "contour_line_regular": {
                    "color": "#008",
                    "width": 0.5,
                    "opacity": [
                        "stops",
                        {"z": 12, "val": 0.05},
                        {"z": 13, "val": 0.11}
                    ]
                },
                "contour_label": {
                    "color": "text",
                    "stroke": "land",
                    "strokeWidth": 0.3,
                    "strokeBlur": 3,
                    "size": 10
                },
                "water": {
                    "color": "water",
                    "stroke": "#a2bdc0"
                },
                "aeroway_fill": {
                    "color": "#ddd"
                },
                "aeroway_runway": {
                    "color": "#ddd",
                    "width": "runway_width"
                },
                "aeroway_taxiway": {
                    "color": "#ddd",
                    "width": "taxiway_width"
                },
                "building": {
                    "color": "#ebe7db"
                },
                "building_wall": {
                    "color": "#ebe7db",
                    "stroke": "#d5d1c6",
                    "opacity": [
                        "stops",
                        {"z": 16.5, "val": 0},
                        {"z": 17, "val": 0.7}
                    ]
                },
                "building_shadow": {
                    "color": "#d5d1c6",
                    "stroke": "#d5d1c6",
                    "translate": [
                        1,
                        1
                    ],
                    "opacity": [
                        "stops",
                        {"z": 16.5, "val": 0},
                        {"z": 17, "val": 1}
                    ]
                },
                "tunnel_motorway_casing": {
                    "color": "case",
                    "dasharray": [
                        6,
                        6
                    ],
                    "width": "motorway_casing_width",
                    "opacity": [
                        "stops",
                        {"z": 9.5, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "tunnel_motorway": {
                    "color": "#e6cec7",
                    "width": "motorway_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "tunnel_main_casing": {
                    "color": "case",
                    "dasharray": [
                        6,
                        6
                    ],
                    "width": "main_casing_width",
                    "opacity": ["stops",
                        {"z": 9, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "tunnel_main": {
                    "color": "#e6cec7",
                    "width": "main_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "tunnel_motorway_link_casing": {
                    "color": "case",
                    "dasharray": [
                        6,
                        6
                    ],
                    "width": "motorway_link_casing_width"
                },
                "tunnel_motorway_link": {
                    "color": "#e6cec7",
                    "width": "motorway_link_width"
                },
                "tunnel_street_casing": {
                    "color": "#d9d5c6",
                    "width": "street_casing_width",
                    "opacity": "street_casing_opacity"
                },
                "tunnel_street": {
                    "color": "#d9d5c6",
                    "width": "street_width"
                },
                "tunnel_service_casing": {
                    "color": "#000",
                    "opacity": 0.04,
                    "dasharray": [
                        6,
                        6
                    ],
                    "width": "service_casing_width"
                },
                "tunnel_service": {
                    "color": "#e6cec7",
                    "width": 2
                },
                "road_motorway_casing": {
                    "color": "case",
                    "width": "motorway_casing_width",
                    "opacity": [
                        "stops",
                        {"z": 9.5, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "road_motorway": {
                    "color": "motorway",
                    "width": "motorway_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "road_main_casing": {
                    "color": "case",
                    "width": "main_casing_width",
                    "opacity": ["stops",
                        {"z": 9, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "road_main": {
                    "color": "main",
                    "width": "main_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "road_motorway_link_casing": {
                    "color": "case",
                    "width": "motorway_link_casing_width"
                },
                "road_motorway_link": {
                    "color": "motorway",
                    "width": "motorway_link_width"
                },
                "road_street_casing": {
                    "color": "#d9d5c6",
                    "width": "street_casing_width",
                    "opacity": "street_casing_opacity"
                },
                "road_street": {
                    "color": "street",
                    "width": "street_width"
                },
                "road_service_casing": {
                    "color": "#000",
                    "opacity": 0.04,
                    "width": "service_casing_width"
                },
                "road_service": {
                    "color": "street",
                    "width": 2
                },
                "road_path_case": {
                    "color": "#ffd",
                    "opacity": 0.4,
                    "width": [
                        "stops",
                        {"z": 15, "val": 3},
                        {"z": 16, "val": 4}
                    ]
                },
                "road_path_footway": {
                    "color": "#bba",
                    "dasharray": [
                        10,
                        4
                    ],
                    "width": "path_width"
                },
                "road_path_path": {
                    "color": "#987",
                    "dasharray": [
                        10,
                        4
                    ],
                    "opacity": 0.8,
                    "width": [
                        "stops",
                        {"z": 14, "val": 0.8},
                        {"z": 15, "val": 0.9},
                        {"z": 16, "val": 1.2}
                    ]
                },
                "road_path_cycleway": {
                    "color": "#488",
                    "dasharray": [
                        10,
                        4
                    ],
                    "width": "path_width"
                },
                "road_path_mtb": {
                    "color": "#488",
                    "dasharray": [
                        12,
                        4
                    ],
                    "width": "path_width"
                },
                "road_path_piste": {
                    "color": "#87b",
                    "dasharray": [
                        8,
                        4
                    ],
                    "width": "path_width"
                },
                "road_path_steps": {
                    "color": "#bba",
                    "dasharray": [
                        10,
                        4
                    ],
                    "width": 4
                },
                "road_major_rail": {
                    "color": "#c8c4c0",
                    "width": 0.8
                },
                "road_major_rail_hatching": {
                    "color": "#c8c4c0",
                    "dasharray": [
                        2,
                        31
                    ],
                    "width": 5
                },
                "bridge_motorway_casing": {
                    "color": "case",
                    "width": "motorway_casing_width",
                    "opacity": [
                        "stops",
                        {"z": 9.5, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "bridge_motorway": {
                    "color": "motorway",
                    "width": "motorway_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "bridge_main_casing": {
                    "color": "case",
                    "width": "main_casing_width",
                    "opacity": ["stops",
                        {"z": 9, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "bridge_main": {
                    "color": "main",
                    "width": "main_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "bridge_motorway_link_casing": {
                    "color": "case",
                    "width": "motorway_link_casing_width"
                },
                "bridge_motorway_link": {
                    "color": "motorway",
                    "width": "motorway_link_width"
                },
                "bridge_street_casing": {
                    "color": "#d9d5c6",
                    "width": "street_casing_width",
                    "opacity": "street_casing_opacity"
                },
                "bridge_street": {
                    "color": "street",
                    "width": "street_width"
                },
                "bridge_service_casing": {
                    "color": "#000",
                    "opacity": 0.04,
                    "width": "service_casing_width"
                },
                "bridge_service": {
                    "color": "street",
                    "width": 2
                },
                "bridge_aerialway_casing": {
                    "color": "white",
                    "opacity": 0.5,
                    "width": "aerialway_casing_width"
                },
                "bridge_aerialway": {
                    "color": "#876",
                    "opacity": 0.5,
                    "width": "aerialway_width"
                },
                "country_label": {
                    "color": "country_text",
                    "stroke": "rgba(255,255,255,0.5)",
                    "strokeWidth": 0.5,
                    "size": "country_label_size"
                },
                "country_label_line": {
                    "color": "country_text",
                    "width": 0.5,
                    "opacity": 0.5
                },
                "marine_label_line_1": {
                    "color": "marine_text",
                    "size": ["stops",
                        {"z": 3, "val": 20},
                        {"z": 4, "val": 25},
                        {"z": 5, "val": 30},
                        {"z": 22, "val": 30}
                    ],
                    "stroke": "water"
                },
                "marine_label_line_2": {
                    "color": "marine_text",
                    "size": ["stops",
                        {"z": 3, "val": 13},
                        {"z": 4, "val": 14},
                        {"z": 5, "val": 20},
                        {"z": 6, "val": 24},
                        {"z": 22, "val": 24}
                    ],
                    "stroke": "water"
                },
                "marine_label_line_3": {
                    "color": "marine_text",
                    "size": ["stops",
                        {"z": 3, "val": 12},
                        {"z": 4, "val": 13},
                        {"z": 5, "val": 15},
                        {"z": 6, "val": 18},
                        {"z": 22, "val": 18}
                    ],
                    "stroke": "water"
                },
                "marine_label_line_other": {
                    "color": "marine_text",
                    "size": ["stops",
                        {"z": 4, "val": 12},
                        {"z": 5, "val": 14},
                        {"z": 6, "val": 16},
                        {"z": 22, "val": 16}
                    ],
                    "stroke": "water"
                },
                "marine_label_point_1": {
                    "color": "marine_text",
                    "size": ["stops",
                        {"z": 3, "val": 20},
                        {"z": 4, "val": 25},
                        {"z": 5, "val": 30},
                        {"z": 22, "val": 30}
                    ],
                    "stroke": "water"
                },
                "marine_label_point_2": {
                    "color": "marine_text",
                    "size": ["stops",
                        {"z": 3, "val": 13},
                        {"z": 4, "val": 14},
                        {"z": 5, "val": 20},
                        {"z": 6, "val": 24},
                        {"z": 22, "val": 24}
                    ],
                    "stroke": "water"
                },
                "marine_label_point_3": {
                    "color": "marine_text",
                    "size": ["stops",
                        {"z": 3, "val": 12},
                        {"z": 4, "val": 13},
                        {"z": 5, "val": 15},
                        {"z": 6, "val": 18},
                        {"z": 22, "val": 18}
                    ],
                    "stroke": "water"
                },
                "marine_label_point_other": {
                    "color": "marine_text",
                    "size": ["stops",
                        {"z": 4, "val": 12},
                        {"z": 5, "val": 14},
                        {"z": 6, "val": 16},
                        {"z": 22, "val": 16}
                    ],
                    "stroke": "water"
                },
                "state_label": {
                    "color": "#333",
                    "strokeWidth": 0.4,
                    "strokeBlur": 1,
                    "stroke": "rgba(244,239,225,0.8)",
                    "size": [
                        "stops",
                        {"z": 3.99, "val": 0},
                        {"z": 4, "val": 10},
                        {"z": 9.99, "val": 16},
                        {"z": 10, "val": 0}
                    ]
                },
                "place_label_city": {
                    "color": "#444",
                    "strokeWidth": 0.4,
                    "stroke": "text_stroke",
                    "size": [
                        "stops",
                        {"z": 3.99, "val": 0},
                        {"z": 4, "val": 10},
                        {"z": 7, "val": 14},
                        {"z": 14.99, "val": 20},
                        {"z": 15, "val": 0}
                    ]
                },
                "place_label_town": {
                    "color": "#716656",
                    "strokeWidth": 0.3,
                    "strokeBlur": 2,
                    "stroke": "text_stroke",
                    "size": [
                        "stops",
                        {"z": 9, "val": 10},
                        {"z": 12, "val": 13},
                        {"z": 14, "val": 17},
                        {"z": 16, "val": 22}
                    ]
                },
                "place_label_village": {
                    "color": "#635644",
                    "strokeWidth": 0.3,
                    "strokeBlur": 2,
                    "stroke": "text_stroke",
                    "size": [
                        "stops",
                        {"z": 9, "val": 8},
                        {"z": 12, "val": 10},
                        {"z": 14, "val": 14},
                        {"z": 16, "val": 16},
                        {"z": 17, "val": 20}
                    ]
                },
                "place_label_other": {
                    "color": "#7d6c55",
                    "stroke": "text_stroke",
                    "size": [
                        "stops",
                        {"z": 13, "val": 11},
                        {"z": 14, "val": 12},
                        {"z": 16, "val": 14},
                        {"z": 18, "val": 18}
                    ]
                },
                "road_label_1": {
                    "color": "#585042",
                    "stroke": "land",
                    "strokeWidth": 0.6,
                    "strokeBlur": 2,
                    "size": "road_label_1_size"
                },
                "road_label_2": {
                    "color": "#585042",
                    "stroke": "land",
                    "strokeWidth": 0.6,
                    "strokeBlur": 2,
                    "size": "road_label_2_size"
                },
                "road_label_3": {
                    "color": "#585042",
                    "stroke": "land",
                    "strokeWidth": 0.6,
                    "strokeBlur": 2,
                    "size": "road_label_3_size"
                },
                "water_label": {
                    "color": "water_dark",
                    "stroke": "rgba(255,255,255,0.75)"
                },
                "waterway_label": {
                    "color": "water_dark",
                    "strokeWidth": 0.4,
                    "strokeBlur": 2,
                    "stroke": "text_stroke"
                },
                "poi": {
                    "antialias": false
                },
                "poi_3": {
                    "antialias": false,
                    "opacity": [
                        "stops",
                        {"z": 16.5, "val": 0},
                        {"z": 16.75, "val": 1}
                    ]
                },
                "poi_4": {
                    "antialias": false,
                    "opacity": [
                        "stops",
                        {"z": 18.5, "val": 0},
                        {"z": 18.75, "val": 1}
                    ]
                },
                "poi_label_1-2": {
                    "color": "#444",
                    "size": "poi_label_1-2_size",
                    "stroke": "land",
                    "strokeWidth": 0.3,
                    "strokeBlur": 1,
                },
                "poi_label_3": {
                    "color": "#444",
                    "size": "poi_label_3_size",
                    "stroke": "land",
                    "strokeWidth": 0.3,
                    "strokeBlur": 1,
                    "opacity": [
                        "stops",
                        {"z": 16.5, "val": 0},
                        {"z": 16.75, "val": 1}
                    ]
                },
                "poi_label_4": {
                    "color": "#444",
                    "size": 10,
                    "opacity": [
                        "stops",
                        {"z": 18.5, "val": 0},
                        {"z": 18.75, "val": 1}
                    ],
                    "stroke": "land",
                    "strokeWidth": 0.3,
                    "strokeBlur": 1,
                },
                "poi_aerodrome": {
                    "opacity": ["stops",
                        {"z": 13, "val": 0},
                        {"z": 13.25, "val": 1}
                    ],
                    "antialias": false
                }
            }
        },
        {
            "name": "night",
            "layers": {
                "background": {
                    "color": "land_night"
                },
                "admin_maritime_cover": {
                    "color": "water_night",
                    "width": 5
                },
                "admin_maritime": {
                    "color": "#0a1347",
                    "width": [
                        "stops",
                        {"z": 6, "val": 1},
                        {"z": 8, "val": 2},
                        {"z": 12, "val": 3}
                    ]
                },
                "admin_l2": {
                    "color": "admin_night",
                    "width": "admin_l2_width"
                },
                "admin_l3": {
                    "color": "admin_night",
                    "dasharray": [
                        60,
                        20
                    ],
                    "opacity": [
                        "stops",
                        {"z": 4, "val": 0},
                        {"z": 6, "val": 1}
                    ],
                    "width": "admin_l3_width"
                },
                "waterway_river_canal": {
                    "color": "rgb(10,20,71)",
                    "width": "river_canal_width"
                },
                "waterway_stream": {
                    "color": "rgb(10,20,71)",
                    "width": "stream_width"
                },
                "barrier_line_gate": {
                    "width": 2.5,
                    "color": "#59596f"
                },
                "barrier_line_fence": {
                    "color": "#014b61",
                    "width": "fence_width"
                },
                "barrier_line_hedge": {
                    "color": "#2e7a57",
                    "width": "hedge_width"
                },
                "barrier_line_land": {
                    "color": "land_night",
                    "width": "barrier_line_land_width"
                },
                "barrier_line_land_fill": {
                    "color": "land_night"
                },
                "barrier_line_cliff": {
                    "color": "#63574b",
                    "width": 4
                },
                "landcover_wood": {
                    "color": "wood_night",
                    "opacity": [
                        "stops",
                        {"z": 13, "val": 1},
                        {"z": 14, "val": 0.8},
                        {"z": 17, "val": 0.2}
                    ]
                },
                "landcover_scrub": {
                    "color": "scrub_night",
                    "opacity": [
                        "stops",
                        {"z": 13, "val": 1},
                        {"z": 14, "val": 0.8},
                        {"z": 17, "val": 0.2}
                    ]
                },
                "landcover_grass": {
                    "color": "grass_night",
                    "opacity": [
                        "stops",
                        {"z": 13, "val": 1},
                        {"z": 14, "val": 0.8},
                        {"z": 17, "val": 0.2}
                    ]
                },
                "landcover_crop": {
                    "color": "crop_night"
                },
                "landcover_snow": {
                    "color": "snow_night"
                },
                "landuse_wood": {
                    "color": "wood_night",
                    "opacity": 0.8
                },
                "landuse_scrub": {
                    "color": "scrub_night",
                    "opacity": 0.8
                },
                "landuse_grass": {
                    "color": "grass_night",
                    "opacity": 0.8
                },
                "landuse_crop": {
                    "color": "crop_night",
                    "opacity": 0.8
                },
                "landuse_snow": {
                    "color": "snow_night",
                    "opacity": 0.8
                },
                "landuse_rock": {
                    "color": "rock_night",
                    "opacity": 0.8
                },
                "landuse_sand": {
                    "color": "sand_night",
                    "opacity": 0.8
                },
                "landuse_park": {
                    "color": "park_night"
                },
                "landuse_cemetery": {
                    "color": "cemetery_night"
                },
                "landuse_hospital": {
                    "color": "hospital_night"
                },
                "landuse_school": {
                    "color": "school_night"
                },
                "landuse_pitch": {
                    "color": "pitch_night",
                    "stroke": "pitch"
                },
                "landuse_industrial": {
                    "color": "builtup_night"
                },
                "overlay_wetland": {
                    "color": "rgba(210,225,225,0.2)",
                    "image": "wetland_noveg_64"
                },
                "overlay_breakwater_pier": {
                    "color": "land_night"
                },
                "hillshade_full_shadow": {
                    "color": "#103",
                    "antialias": false,
                    "prerender": "hillshade_prerender",
                    "prerender-size": "hillshade_prerender_size",
                    "prerender-blur": 1,
                    "opacity": [
                        "stops",
                        {"z": 16, "val": 0.3},
                        {"z": 17, "val": 0.2},
                        {"z": 18, "val": 0.1},
                        {"z": 19, "val": 0.05}
                    ]
                },
                "hillshade_medium_shadow": {
                    "color": "#206",
                    "antialias": false,
                    "prerender": "hillshade_prerender",
                    "prerender-size": "hillshade_prerender_size",
                    "prerender-blur": 1,
                    "opacity": [
                        "stops",
                        {"z": 16, "val": 0.3},
                        {"z": 17, "val": 0.2},
                        {"z": 18, "val": 0.1},
                        {"z": 19, "val": 0.05}
                    ]
                },
                "hillshade_full_highlight": {
                    "color": "#fdfdad",
                    "antialias": false,
                    "prerender": "hillshade_prerender",
                    "prerender-size": "hillshade_prerender_size",
                    "prerender-blur": 1,
                    "opacity": [
                        "stops",
                        {"z": 14, "val": 0.4},
                        {"z": 15, "val": 0.3},
                        {"z": 17, "val": 0.2},
                        {"z": 18, "val": 0.1},
                        {"z": 19, "val": 0.05}
                    ]
                },
                "hillshade_medium_highlight": {
                    "color": "#ffe1b7",
                    "antialias": false,
                    "prerender": "hillshade_prerender",
                    "prerender-size": "hillshade_prerender_size",
                    "prerender-blur": 1,
                    "opacity": [
                        "stops",
                        {"z": 15, "val": 0.3},
                        {"z": 17, "val": 0.2},
                        {"z": 18, "val": 0.15},
                        {"z": 19, "val": 0.05}
                    ]
                },
                "contour_line_loud": {
                    "color": "contour_night",
                    "width": 0.9,
                    "opacity": [
                        "stops",
                        {"z": 12, "val": 0.1},
                        {"z": 13, "val": 0.2}
                    ]
                },
                "contour_line_regular": {
                    "color": "contour_night",
                    "width": 0.5,
                    "opacity": [
                        "stops",
                        {"z": 12, "val": 0.1},
                        {"z": 13, "val": 0.4}
                    ]
                },
                "contour_label": {
                    "color": "contour_night",
                    "stroke": "land_night",
                    "strokeWidth": 0.3,
                    "strokeBlur": 3,
                    "size": 10
                },
                "water": {
                    "color": "water_night",
                    "stroke": "water_dark_night"
                },
                "aeroway_fill": {
                    "color": "#367"
                },
                "aeroway_runway": {
                    "color": "#367",
                    "width": "runway_width"
                },
                "aeroway_taxiway": {
                    "color": "#367",
                    "width": "taxiway_width"
                },
                "building": {
                    "color": "#027797"
                },
                "building_wall": {
                    "color": "#027797",
                    "stroke": "#026688",
                    "opacity": [
                        "stops",
                        {"z": 16.5, "val": 0},
                        {"z": 17, "val": 0.7}
                    ]
                },
                "building_shadow": {
                    "color": "#026688",
                    "stroke": "#026688",
                    "translate": [
                        1,
                        1
                    ],
                    "opacity": [
                        "stops",
                        {"z": 16.5, "val": 0},
                        {"z": 17, "val": 1}
                    ]
                },
                "tunnel_motorway_casing": {
                    "color": "case_night",
                    "dasharray": [
                        6,
                        6
                    ],
                    "width": "motorway_casing_width",
                    "opacity": [
                        "stops",
                        {"z": 9.5, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "tunnel_motorway": {
                    "color": "#78b0c1",
                    "width": "motorway_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "tunnel_main_casing": {
                    "color": "case_night",
                    "dasharray": [
                        6,
                        6
                    ],
                    "width": "main_casing_width",
                    "opacity": ["stops",
                        {"z": 9, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "tunnel_main": {
                    "color": "#78b0c1",
                    "width": "main_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "tunnel_motorway_link_casing": {
                    "color": "case_night",
                    "dasharray": [
                        6,
                        6
                    ],
                    "width": "motorway_link_casing_width"
                },
                "tunnel_motorway_link": {
                    "color": "#78b0c1",
                    "width": "motorway_link_width"
                },
                "tunnel_street_casing": {
                    "color": "street_case_night",
                    "width": "street_casing_width",
                    "opacity": "street_casing_opacity"
                },
                "tunnel_street": {
                    "color": "street_night",
                    "width": "street_width"
                },
                "tunnel_service_casing": {
                    "color": "#000",
                    "opacity": 0.04,
                    "dasharray": [
                        6,
                        6
                    ],
                    "width": "service_casing_width"
                },
                "tunnel_service": {
                    "color": "#017ca0",
                    "width": 2
                },
                "road_motorway_casing": {
                    "color": "case_night",
                    "width": "motorway_casing_width",
                    "opacity": [
                        "stops",
                        {"z": 9.5, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "road_motorway": {
                    "color": "motorway_night",
                    "width": "motorway_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "road_main_casing": {
                    "color": "case_night",
                    "width": "main_casing_width",
                    "opacity": ["stops",
                        {"z": 9, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "road_main": {
                    "color": "main_night",
                    "width": "main_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "road_motorway_link_casing": {
                    "color": "case_night",
                    "width": "motorway_link_casing_width"
                },
                "road_motorway_link": {
                    "color": "motorway_night",
                    "width": "motorway_link_width"
                },
                "road_street_casing": {
                    "color": "street_case_night",
                    "width": "street_casing_width",
                    "opacity": "street_casing_opacity"
                },
                "road_street": {
                    "color": "street_night",
                    "width": "street_width"
                },
                "road_service_casing": {
                    "color": "#000",
                    "opacity": 0.04,
                    "width": "service_casing_width"
                },
                "road_service": {
                    "color": "street_night",
                    "width": 2
                },
                "road_path_case": {
                    "color": "land_night",
                    "opacity": 0.2
                },
                "road_path_footway": {
                    "color": "#fff",
                    "dasharray": [
                        10,
                        4
                    ],
                    "width": "path_width"
                },
                "road_path_path": {
                    "color": "#fff",
                    "dasharray": [
                        10,
                        4
                    ],
                    "opacity": 0.8,
                    "width": [
                        "stops",
                        {"z": 14, "val": 0.8},
                        {"z": 15, "val": 0.9},
                        {"z": 16, "val": 1.2}
                    ]
                },
                "road_path_cycleway": {
                    "color": "#94e6ff",
                    "dasharray": [
                        10,
                        4
                    ],
                    "width": "path_width"
                },
                "road_path_mtb": {
                    "color": "#94e6ff",
                    "dasharray": [
                        12,
                        4
                    ],
                    "width": "path_width"
                },
                "road_path_piste": {
                    "color": "#715dae",
                    "dasharray": [
                        8,
                        4
                    ],
                    "width": "path_width"
                },
                "road_path_steps": {
                    "color": "#016684",
                    "dasharray": [
                        10,
                        4
                    ],
                    "opacity": 0.3,
                    "width": 6
                },
                "road_major_rail": {
                    "color": "#c8c4c0",
                    "width": 0.8
                },
                "road_major_rail_hatching": {
                    "color": "#c8c4c0",
                    "dasharray": [
                        2,
                        31
                    ],
                    "width": 5
                },
                "bridge_motorway_casing": {
                    "color": "case_night",
                    "width": "motorway_casing_width",
                    "opacity": [
                        "stops",
                        {"z": 9.5, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "bridge_motorway": {
                    "color": "motorway_night",
                    "width": "motorway_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "bridge_main_casing": {
                    "color": "case_night",
                    "width": "main_casing_width",
                    "opacity": ["stops",
                        {"z": 9, "val": 0},
                        {"z": 10, "val": 1}
                    ]
                },
                "bridge_main": {
                    "color": "main_night",
                    "width": "main_width",
                    "opacity": [
                        "stops",
                        {"z": 6.5, "val": 0},
                        {"z": 7, "val": 1}
                    ]
                },
                "bridge_motorway_link_casing": {
                    "color": "case_night",
                    "width": "motorway_link_casing_width"
                },
                "bridge_motorway_link": {
                    "color": "motorway_night",
                    "width": "motorway_link_width"
                },
                "bridge_street_casing": {
                    "color": "street_case_night",
                    "width": "street_casing_width",
                    "opacity": "street_casing_opacity"
                },
                "bridge_street": {
                    "color": "street_night",
                    "width": "street_width"
                },
                "bridge_service_casing": {
                    "color": "#000",
                    "opacity": 0.04,
                    "width": "service_casing_width"
                },
                "bridge_service": {
                    "color": "street_night",
                    "width": 2
                },
                "bridge_aerialway_casing": {
                    "color": "white",
                    "opacity": 0.5,
                    "width": "aerialway_casing_width"
                },
                "bridge_aerialway": {
                    "color": "#876",
                    "opacity": 0.5,
                    "width": "aerialway_width"
                },
                "country_label": {
                    "color": "text_night",
                    "stroke": "text2_stroke_night",
                    "strokeWidth": 0.4,
                    "strokeBlur": 2,
                    "size": "country_label_size"
                },
                "country_label_line": {
                    "color": "text_night",
                    "width": 0.5,
                    "opacity": 0.5
                },
                "marine_label_line_1": {
                    "color": "water_dark_night",
                    "size": ["stops",
                        {"z": 3, "val": 20},
                        {"z": 4, "val": 25},
                        {"z": 5, "val": 30},
                        {"z": 22, "val": 30}
                    ],
                    "stroke": "water_night"
                },
                "marine_label_line_2": {
                    "color": "water_dark_night",
                    "size": ["stops",
                        {"z": 3, "val": 13},
                        {"z": 4, "val": 14},
                        {"z": 5, "val": 20},
                        {"z": 6, "val": 24},
                        {"z": 22, "val": 24}
                    ],
                    "stroke": "water_night"
                },
                "marine_label_line_3": {
                    "color": "water_dark_night",
                    "size": ["stops",
                        {"z": 3, "val": 12},
                        {"z": 4, "val": 13},
                        {"z": 5, "val": 15},
                        {"z": 6, "val": 18},
                        {"z": 22, "val": 18}
                    ],
                    "stroke": "water_night"
                },
                "marine_label_line_other": {
                    "color": "water_dark_night",
                    "size": ["stops",
                        {"z": 4, "val": 12},
                        {"z": 5, "val": 14},
                        {"z": 6, "val": 16},
                        {"z": 22, "val": 16}
                    ],
                    "stroke": "water_night"
                },
                "marine_label_point_1": {
                    "color": "water_dark_night",
                    "size": ["stops",
                        {"z": 3, "val": 20},
                        {"z": 4, "val": 25},
                        {"z": 5, "val": 30},
                        {"z": 22, "val": 30}
                    ],
                    "stroke": "water_night"
                },
                "marine_label_point_2": {
                    "color": "water_dark_night",
                    "size": ["stops",
                        {"z": 3, "val": 13},
                        {"z": 4, "val": 14},
                        {"z": 5, "val": 20},
                        {"z": 6, "val": 24},
                        {"z": 22, "val": 24}
                    ],
                    "stroke": "water_night"
                },
                "marine_label_point_3": {
                    "color": "water_dark_night",
                    "size": ["stops",
                        {"z": 3, "val": 12},
                        {"z": 4, "val": 13},
                        {"z": 5, "val": 15},
                        {"z": 6, "val": 18},
                        {"z": 22, "val": 18}
                    ],
                    "stroke": "water_night"
                },
                "marine_label_point_other": {
                    "color": "water_dark_night",
                    "size": ["stops",
                        {"z": 4, "val": 12},
                        {"z": 5, "val": 14},
                        {"z": 6, "val": 16},
                        {"z": 22, "val": 16}
                    ],
                    "stroke": "water_night"
                },
                "state_label": {
                    "color": "#fff",
                    "strokeWidth": 0.4,
                    "strokeBlur": 1,
                    "stroke": "land_night",
                    "size": [
                        "stops",
                        {"z": 3.99, "val": 0},
                        {"z": 4, "val": 10},
                        {"z": 9.99, "val": 16},
                        {"z": 10, "val": 0}
                    ]
                },
                "place_label_city": {
                    "color": "#fff",
                    "strokeWidth": 0.4,
                    "stroke": "text2_stroke_night",
                    "size": [
                        "stops",
                        {"z": 3.99, "val": 0},
                        {"z": 4, "val": 10},
                        {"z": 7, "val": 14},
                        {"z": 14.99, "val": 20},
                        {"z": 15, "val": 0}
                    ]
                },
                "place_label_town": {
                    "color": "text_night",
                    "strokeWidth": 0.3,
                    "strokeBlur": 2,
                    "stroke": "text2_stroke_night",
                    "size": [
                        "stops",
                        {"z": 9, "val": 10},
                        {"z": 12, "val": 13},
                        {"z": 14, "val": 17},
                        {"z": 16, "val": 22}
                    ]
                },
                "place_label_village": {
                    "color": "text_night",
                    "strokeWidth": 0.3,
                    "strokeBlur": 2,
                    "stroke": "text2_stroke_night",
                    "size": [
                        "stops",
                        {"z": 9, "val": 8},
                        {"z": 12, "val": 10},
                        {"z": 14, "val": 14},
                        {"z": 16, "val": 16},
                        {"z": 17, "val": 20}
                    ]
                },
                "place_label_other": {
                    "color": "text_night",
                    "stroke": "text2_stroke_night",
                    "strokeWidth": 0.3,
                    "strokeBlur": 2,
                    "size": [
                        "stops",
                        {"z": 13, "val": 11},
                        {"z": 14, "val": 12},
                        {"z": 16, "val": 14},
                        {"z": 18, "val": 18}
                    ]
                },
                "road_label_1": {
                    "color": "text_night",
                    "stroke": "text2_stroke_night",
                    "strokeWidth": 0.5,
                    "strokeBlur": 3,
                    "size": "road_label_1_size"
                },
                "road_label_2": {
                    "color": "text_night",
                    "stroke": "text2_stroke_night",
                    "strokeWidth": 0.5,
                    "strokeBlur": 3,
                    "size": "road_label_2_size"
                },
                "road_label_3": {
                    "color": "text_night",
                    "stroke": "text2_stroke_night",
                    "strokeWidth": 0.5,
                    "strokeBlur": 3,
                    "size": "road_label_3_size"
                },
                "water_label": {
                    "color": "text_water_night",
                    "stroke": "water_night",
                },
                "waterway_label": {
                    "color": "text_water_night",
                    "stroke": "water_night",
                },
                "poi": {
                    "color": "white",
                    "antialias": false
                },
                "poi_3": {
                    "antialias": false,
                    "opacity": [
                        "stops",
                        {"z": 16.5, "val": 0},
                        {"z": 16.75, "val": 1}
                    ]
                },
                "poi_4": {
                    "antialias": false,
                    "opacity": [
                        "stops",
                        {"z": 18.5, "val": 0},
                        {"z": 18.75, "val": 1}
                    ]
                },
                "poi_label_1-2": {
                    "color": "#fff",
                    "size": "poi_label_1-2_size",
                    "stroke": "text2_stroke_night",
                    "strokeWidth": 0.3,
                    "strokeBlur": 1
                },
                "poi_label_3": {
                    "color": "#fff",
                    "size": "poi_label_3_size",
                    "stroke": "text2_stroke_night",
                    "strokeWidth": 0.3,
                    "strokeBlur": 1,
                    "opacity": [
                        "stops",
                        {"z": 16.5, "val": 0},
                        {"z": 16.75, "val": 1}
                    ]
                },
                "poi_label_4": {
                    "color": "#fff",
                    "size": 10,
                    "opacity": [
                        "stops",
                        {"z": 18.5, "val": 0},
                        {"z": 18.75, "val": 1}
                    ],
                    "stroke": "text2_stroke_night",
                    "strokeWidth": 0.3,
                    "strokeBlur": 1
                },
                "poi_aerodrome": {
                    "opacity": ["stops",
                        {"z": 13, "val": 0},
                        {"z": 13.25, "val": 1}
                    ],
                    "antialias": false
                }
            }
        }
    ],
    "sprite": "/img/maki-sprite"
};
