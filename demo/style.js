//'use strict';

var style_json = {
    "buckets": {
        "park": {
            "layer": "landuse", "field": "class", "value": "park",
            "type": "fill"
        },
        "wood": {
            "layer": "landuse", "field": "class", "value": "wood",
            "type": "fill"
        },
        "school": {
            "layer": "landuse", "field": "class", "value": "school",
            "type": "fill"
        },
        "cemetery": {
            "layer": "landuse", "field": "class", "value": "cemetery",
            "type": "fill"
        },
        "industrial": {
            "layer": "landuse", "field": "class", "value": "industrial",
            "type": "fill"
        },
        "water": {
            "layer": "water",
            "type": "fill"
        },
        "waterway": {
            "layer": "waterway",
            "type": "line"
        },
        "tunnel_large": {
            "layer": "tunnel", "field": "class", "value": ["motorway", "main"],
            "type": "line"
        },
        "tunnel_regular": {
            "layer": "tunnel", "field": "class", "value": ["street", "street_limited"],
            "type": "line"
        },
        "tunnel_rail": {
            "layer": "tunnel", "field": "class", "value": ["minor_rail", "major_rail"],
            "type": "line"
        },
        "bridge_large": {
            "layer": "bridge", "field": "class", "value": ["motorway", "main"],
            "type": "line"
        },
        "bridge_regular": {
            "layer": "bridge", "field": "class", "value": ["street", "street_limited"],
            "type": "line"
        },
        "borders": {
            "layer": "admin",
            "type": "line"
        },
        "building": {
            "layer": "building",
            "type": "fill"
        },
        "road_large": {
            "layer": "road", "field": "class", "value": ["motorway", "main"],
            "type": "line", "cap": "round", "join": "bevel"
        },
        "road_regular": {
            "layer": "road", "field": "class", "value": "street",
            "type": "line", "cap": "round", "join": "bevel"
        },
        "road_limited": {
            "layer": "road", "field": "class", "value": "street_limited",
            "type": "line", "cap": "round", "join": "butt", "roundLimit": 0.7
        },
        "rail": {
            "layer": "road", "field": "class", "value": "major_rail",
            "type": "line", "cap": "round", "join": "bevel"
        },
        "path": {
            "layer": "road", "field": "class", "value": "path",
            "type": "line", "cap": "round", "join": "bevel"
        },
        "embassy_poi": {
            "layer": "poi_label", "field": "maki", "value": "embassy",
            "type": "point"
        },
        "park_poi": {
            "layer": "poi_label", "field": "maki", "value": "park",
            "type": "point"
        },
        "restaurant_poi": {
            "layer": "poi_label", "field": "maki", "value": "embassy",
            "type": "point"
        },
        "road_markers": {
            "layer": "road", "field": "oneway", "value": 1,
            "type": "point", "marker": true, "spacing": 200
        },
        "country_label": {
            "layer": "country_label",
            "type": "point",
            "text": true,
            "text_field": "name",
            "path": "horizontal",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 16
        },
        "place_label": {
            "layer": "place_label",
            "type": "point",
            "text": true,
            "text_field": "name",
            "path": "horizontal",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 18
        },
        "road_label": {
            "layer": "road_label",
            "type": "line",
            "text": true,
            "text_field": "name",
            "path": "curve",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 12
        }
    },
    "sprite": "img/maki-sprite",
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
        "satellite_saturation": 1,
        "satellite_spin": 0
    },
    "background": "land",
    "structure": [
    {
        "name": "park",
        "bucket": "park"
    },
    {
        "name": "wood",
        "bucket": "wood",
    },
    {
        "name": "water",
        "bucket": "water",
    },
    {
        "name": "waterway",
        "bucket": "waterway",
    },
    {
        "name": "roads",
        "layers": [
        {
            "name": "tunnel_large_casing",
            "bucket": "tunnel_large",
        },
        {
            "name": "tunnel_regular_casing",
            "bucket": "tunnel_regular",
        },
        {
            "name": "tunnel_large",
            "bucket": "tunnel_large",
        },
        {
            "name": "tunnel_regular",
            "bucket": "tunnel_regular",
        },
        {
            "name": "road_large_casing",
            "bucket": "road_large",
        },
        {
            "name": "road_regular_casing",
            "bucket": "road_regular",
        },
        {
            "name": "road_limited",
            "bucket": "road_limited",
        },
        {
            "name": "road_large",
            "bucket": "road_large",
        },
        {
            "name": "road_regular",
            "bucket": "road_regular",
        },
        {
            "name": "path",
            "bucket": "path",
        },
        {
            "name": "rail",
            "bucket": "rail",
        },
        {
            "name": "bridge_large_casing",
            "bucket": "bridge_large",
        },
        {
            "name": "bridge_large",
            "bucket": "bridge_large",
        },
        {
            "name": "tunnel_rail",
            "bucket": "tunnel_rail",
        }]
    },
    {
        "name": "road_markers",
        "bucket": "road_markers",
    },
    {
        "name": "building",
        "bucket": "building",

    },
    {
        "name": "borders",
        "bucket": "borders",
    },
    {
        "name": "park_poi",
        "bucket": "park_poi",
    },
    {
        "name": "restaurant_poi",
        "bucket": "restaurant_poi",
    },
    {
        "name": "country_label",
        "bucket": "country_label",
    },
    {
        "name": "place_label",
        "bucket": "place_label",
    },
    {
        "name": "road_label",
        "bucket": "road_label",
    }
    ],
    "classes": [
    {
        "name": "default",
        "layers": {
            "background": {
                "color": "land",
                "transition-color": { "duration": 500, "delay": 0 }
            },
            "satellite": {},
            "park": {
                "color": "park",
                "opacity": 1,
                "transition-opacity": { "duration": 500, "delay": 500 },
                "transition-color": { "duration": 500, "delay": 0 },
                "antialias": true
            },
            "wood": {
                "color": "wood",
                "opacity": 0.08,
                "antialias": true
            },
            "water": {
                "color": "water",
                "opacity": 1,
                "transition-opacity": { "duration": 500, "delay": 0 },
                "antialias": true
            },
            "waterway": {
                "color": "water",
                "opacity": 1,
                "transition-opacity": { "duration": 500, "delay": 500 },
                "width": ["linear", 8, 1, 0.5, 0.5]
            },
            "tunnel_large_casing": {
                "color": [0, 0, 0, 0.5],
                "width": 1,
                "offset": ["exponential", 8, -1, 0.2, 1],
                "enabled": ["min", 13]
            },
            "tunnel_regular_casing": {
                "color": [0, 0, 0, 0.5],
                "width": 1,
                "offset": ["exponential", 10, 0.5, 0.2, 1],
                "enabled": ["min", 14.5 ]
            },
            "tunnel_large": {
                "color": [ 1, 1, 1, 0.5],
                "width": ["exponential", 8, -1, 0.2, 1]
            },
            "tunnel_regular": {
                "color": [ 1, 1, 1, 0.5],
                "width": ["exponential", 10, -1, 0.2, 1]
            },
            "roads": {
                "type": "composited",
                "opacity": 1,
                "transition-opacity": { "duration": 500, "delay": 0 },
            },
            "road_large_casing": {
                "color": [0.6, 0.6, 0.6, 1],
                "width": ["exponential", 8, 1.0, 0.21, 4],
                "enabled": ["min", 13],
                "opacity": ["linear", 13, 0, 1, 0, 1],
                "transition-width": { "duration": 500, "delay": 0 },
                //"transition-width": { "duration": 500, "delay": 2000 },
                //"transition-color": { "duration": 2000, "delay": 0 }
            },
            "road_regular_casing": {
                "color": [0.6, 0.6, 0.6, 1],
                "width": ["exponential", 9, 0.5, 0.2, 1],
                "enabled": ["min", 14.5 ],
                "opacity": ["linear", 14.5, 0, 1, 0, 1]
            },
            "road_limited": {
                "dasharray": [10, 2],
                "color": "road",
                "width": ["exponential", 9, -1, 0.2, 1],
            },
            "road_large": {
                "color": "road",
                "width": ["exponential", 8, -1, 0.2, 1],
            },
            "road_regular": {
                "color": "road",
                "width": ["exponential", 9, -1, 0.2, 1],
            },
            "path": {
                "color": [1,1,1,1],
                "dasharray": [2,2],
                "width": 2
            },
            "rail": {
                "color": [0.3,0.3,0.3,0.8],
                "dasharray": [2, 1],
                "width" : 3,
                "linejoin": "round"
            },
            "tunnel_rail": {
                "color": [0.3,0.3,0.3,0.3],
                "dasharray": [2, 1],
                "width" : 3,
                "linejoin": "round"
            },
            "road_markers": {
                "enabled": ["min", 14.5],
                "alignment": "line",
                "image": "bicycle-12",
            },
            "building": {
                "color": "building",
                "stroke": "building_outline",
                "antialias": true,
                "transition-opacity": { "duration": 500, "delay": 500 },
                "opacity": ["linear", 13, 0, 1, 0, 1]

            },
            "borders": {
                "color": [0,0,0,0.3],
                "width": 1
            },
            "bridge_large_casing": {
                "color": [0, 0, 0, 0.4],
                "width": ["exponential", 8, 1.5, 0.2, 1],
                "enabled": ["min", 13]
            },
            "bridge_large": {
                "color": "road",
                "width": ["exponential", 8, -1, 0.2, 1]
            },
            "park_poi": {
                "hidden": true,
                "image": "park",
                "imageSize": 12
            },
            "restaurant_poi": {
                "hidden": true,
                "image": "restaurant",
                "imageSize": 12
            },
            "country_label": {
                "stroke": [1,1,1,0.7],
                "color": "text"
            },
            "place_label": {
                "stroke": [1,1,1,0.7],
                "color": "text"
            },
            "road_label": {
                "color": "text",
                "stroke": [1,1,1,0.7],
                "fade-dist": 0,
                "transition-fade-dist": { "duration": 1000, "delay": 0 },
                "enabled": ["min", 10]
            }
        }
    }, {
        "name": "satellite",
        "layers": {
            "background": {
                "transition-color": { "duration": 500, "delay": 500 },
                "color": [0,0,0,0]
            },
            "roads": {
                "transition-opacity": { "duration": 500, "delay": 500 },
                "opacity": 0.5
            },
            "building": {
                "opacity": 0,
                "transition-opacity": { "duration": 500, "delay": 0 },
            },
            "park": {
                "transition-opacity": { "duration": 500, "delay": 0 },
                "opacity": 0
            },
            "water": {
                "transition-opacity": { "duration": 500, "delay": 500 },
                "opacity": 0
            },
            "waterway": {
                "transition-opacity": { "duration": 500, "delay": 0 },
                "opacity": 0
            },
            "road_large": {
                "transition-width": { "duration": 500, "delay": 1000 },
                "width": ["exponential", 9, -1, 0.2, 1],
            },
            "road_large_casing": {
                "width": ["exponential", 9, 1.0, 0.21, 4],
                "transition-width": { "duration": 500, "delay": 1000 },
            },
            "road_regular_casing": {
                "transition-width": { "duration": 500, "delay": 1000 },
                "width": ["exponential", 10, 0.5, 0.2, 1],
            },
            "road_regular": {
                "transition-width": { "duration": 500, "delay": 1000 },
                "width": ["exponential", 10, -1, 0.2, 1],
            },
            "satellite": {
                "transition-brightness_low": { duration: 500, delay: 0},
                "transition-brightness_high": { duration: 500, delay: 0},
                "transition-saturation": { duration: 500, delay: 0},
                brightness_low: "satellite_brightness_low",
                brightness_high: "satellite_brightness_high",
                saturation: "satellite_saturation",
                spin: "satellite_spin"
            },
            "country_label": {
                "transition-color": { "duration": 500, "delay": 500 },
                "transition-stroke": { "duration": 500, "delay": 500 },
                "stroke": [0,0,0,0.5],
                "color": [1,1,1,1]
            },
            "place_label": {
                "transition-color": { "duration": 500, "delay": 500 },
                "transition-stroke": { "duration": 500, "delay": 500 },
                "stroke": [0,0,0,0.5],
                "color": [1,1,1,1]
            },
            "road_label": {
                "transition-color": { "duration": 500, "delay": 500 },
                "transition-stroke": { "duration": 500, "delay": 500 },
                "color": [1,1,1,1],
                "stroke": [0,0,0,0.5],
                "enabled": ["min", 10]
            }
        }
    }, {
        "name": "darken",
        "layers": {
            "roads": {
                "opacity": 0.25
            },
            "satellite": {
                "transition-brightness_low": { duration: 500, delay: 0},
                "transition-brightness_high": { duration: 500, delay: 0},
                "transition-saturation": { duration: 500, delay: 0},
                brightness_low: 0.2,
                brightness_high: 0,
                saturation: 0.5,
                spin: "satellite_spin"
            },
        }
    }, {
        "name": "dark",
        "layers": {
            "water": { "color": '#033b5c' },
            "waterway": { "color": '#033b5c' },
            "background": {
                "color": '#2e2532',
                "transition-color": { "duration": 500, "delay": 0 },
            },
            "building": { "color": '#555052', "stroke": '#555052' },
            "road_regular_casing": { "color": '#221d1f' },
            "road_large_casing": { "color": '#221d1f' },
            "bridge_regular_casing": { "color": '#221d1f' },
            "bridge_large_casing": { "color": '#221d1f' },
            "tunnel_large_casing": { "color": '#221d1f' },
            "road_regular": { "color": '#221d1f' },
            "road_large": { "color": '#221d1f' },
            "bridge_regular": { "color": '#221d1f' },
            "bridge_large": { "color": '#221d1f' },
            "tunnel_large": { "color": '#221d1f' },
            "road_limited": { "color": '#221d1f' },
            "path": { "color": '#221d1f' },
            "park": { "color": '#2c3d2a' },
            "country_label": {
                "transition-color": { "duration": 500, "delay": 0 },
                "transition-stroke": { "duration": 500, "delay": 0 },
                //"stroke": [0,0,0,0.5],
                "stroke": "#2e2532",
                "color": [1,1,1,1]
            },
            "place_label": {
                "transition-color": { "duration": 500, "delay": 0 },
                "transition-stroke": { "duration": 500, "delay": 0 },
                //"stroke": [0,0,0,0.5],
                "stroke": "#2e2532",
                "color": [1,1,1,1]
            },
            "road_label": {
                "transition-color": { "duration": 500, "delay": 0 },
                "transition-stroke": { "duration": 500, "delay": 0 },
                "color": [1,1,1,1],
                //"stroke": [0,0,0,0.5],
                "stroke": "#2e2532",
                "enabled": ["min", 10]
            }
        }
    }]
};
