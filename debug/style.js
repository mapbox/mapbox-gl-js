//'use strict';

var style_json = {
    "buckets": {
        "route": {
            "source": "geojson",
            "type": "line"
        },
        "satellite": {
            "source": "satellite"
        },
        "park": {
            "source": "mapbox streets",
            "layer": "landuse", "field": "class", "value": "park",
            "type": "fill"
        },
        "wood": {
            "source": "mapbox streets",
            "layer": "landuse", "field": "class", "value": "wood",
            "type": "fill"
        },
        "school": {
            "source": "mapbox streets",
            "layer": "landuse", "field": "class", "value": "school",
            "type": "fill"
        },
        "cemetery": {
            "source": "mapbox streets",
            "layer": "landuse", "field": "class", "value": "cemetery",
            "type": "fill"
        },
        "industrial": {
            "source": "mapbox streets",
            "layer": "landuse", "field": "class", "value": "industrial",
            "type": "fill"
        },
        "water": {
            "source": "mapbox streets",
            "layer": "water",
            "type": "fill"
        },
        "waterway": {
            "source": "mapbox streets",
            "layer": "waterway",
            "type": "line"
        },
        "tunnel_large": {
            "source": "mapbox streets",
            "layer": "tunnel", "field": "class", "value": ["motorway", "main"],
            "type": "line"
        },
        "tunnel_regular": {
            "source": "mapbox streets",
            "layer": "tunnel", "field": "class", "value": ["street", "street_limited"],
            "type": "line"
        },
        "tunnel_rail": {
            "source": "mapbox streets",
            "layer": "tunnel", "field": "class", "value": ["minor_rail", "major_rail"],
            "type": "line"
        },
        "bridge_large": {
            "source": "mapbox streets",
            "layer": "bridge", "field": "class", "value": ["motorway", "main"],
            "type": "line"
        },
        "bridge_regular": {
            "source": "mapbox streets",
            "layer": "bridge", "field": "class", "value": ["street", "street_limited"],
            "type": "line"
        },
        "borders": {
            "source": "mapbox streets",
            "layer": "admin",
            "type": "line"
        },
        "building": {
            "source": "mapbox streets",
            "layer": "building",
            "type": "fill"
        },
        "road_large": {
            "source": "mapbox streets",
            "layer": "road", "field": "class", "value": ["motorway", "main"],
            "type": "line", "cap": "round", "join": "bevel"
        },
        "road_regular": {
            "source": "mapbox streets",
            "layer": "road", "field": "class", "value": "street",
            "type": "line", "cap": "round", "join": "bevel"
        },
        "road_limited": {
            "source": "mapbox streets",
            "layer": "road", "field": "class", "value": "street_limited",
            "type": "line", "cap": "round", "join": "butt", "roundLimit": 0.7
        },
        "rail": {
            "source": "mapbox streets",
            "layer": "road", "field": "class", "value": "major_rail",
            "type": "line", "cap": "round", "join": "bevel"
        },
        "path": {
            "source": "mapbox streets",
            "layer": "road", "field": "class", "value": "path",
            "type": "line", "cap": "round", "join": "bevel"
        },
        "country_label": {
            "source": "mapbox streets",
            "layer": "country_label",
            "feature_type": "point",
            "type": "text",
            "text_field": "name",
            "path": "horizontal",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 16
        },
        "place_label": {
            "source": "mapbox streets",
            "layer": "place_label",
            "feature_type": "point",
            "type": "text",
            "text_field": "name",
            "path": "horizontal",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 18
        },
        "road_label": {
            "source": "mapbox streets",
            "layer": "road_label",
            "feature_type": "line",
            "type": "text",
            "text_field": "name",
            "path": "curve",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 12
        },
        "embassy_poi": {
            "source": "mapbox streets",
            "layer": "poi_label", "field": "maki", "value": "embassy",
            "type": "point"
        },
        "park_poi": {
            "source": "mapbox streets",
            "layer": "poi_label", "field": "maki", "value": "park",
            "type": "point"
        },
        "restaurant_poi": {
            "source": "mapbox streets",
            "layer": "poi_label", "field": "maki", "value": "restaurant",
            "type": "point"
        },
        "road_markers": {
            "source": "mapbox streets",
            "layer": "road", "field": "oneway", "value": 1,
            "feature_type": "line",
            "type": "point", "spacing": 200
        },
    },
    "sprite": "img/sprite",
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
        "satellite_saturation": 2,
        "satellite_spin": 0
    },
    "structure": [
    {
        "name": "background",
        "bucket": "background"
    },
    {
        "name": "satellite",
        "bucket": "satellite"
    },
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
            "name": "tunnel_rail",
            "bucket": "tunnel_rail",
        }]
    },
    {
        "name": "route",
        "bucket": "route"
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
        "name": "bridge_large_casing",
        "bucket": "bridge_large",
    },
    {
        "name": "bridge_large",
        "bucket": "bridge_large",
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
    },
    ],
    "classes": [
    {
        "name": "default",
        "layers": {
            "route": {
                "color": "#EC8D8D",
                "width": ["exponential", 8, 1.0, 0.21, 4],
            },
            "background": {
                "color": "land",
                "transition-color": { "duration": 500, "delay": 0 }
            },
            "park": {
                "color": "park",
            },
            "wood": {
                "color": "wood",
                "opacity": 0.08,
            },
            "water": {
                "color": "water",
            },
            "waterway": {
                "color": "water",
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
                "color": "green"
            },
            "restaurant_poi": {
                "image": "restaurant-12",
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
                "size": ["exponential", 12, 8, 1, 8, 12]
            }
        }
    }, {
        "name": "satellite",
        "layers": {
            "background": {
                "transition-color": { "duration": 500, "delay": 500 },
                "opacity": 0,
                "color": [1,0,0,0]
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
                "transition-color": { "duration": 500, "delay": 0 },
                "color": [0,0,0,0],
            },
            "water": {
                "opacity": 0
            },
            "place_label": {
                //"color": [1,1,1,1]
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
                brightness_low: "satellite_brightness_low",
                brightness_high: "satellite_brightness_high",
                saturation: "satellite_saturation",
                spin: "satellite_spin"
            }
        }
    }, {
        "name": "test",
        "layers": {
            "road_large_casing": {
                "width": ["exponential", 7, 1.0, 0.21, 4],
                "color": [1,0,0,1],
                "transition-width": { "duration": 500, "delay": 0 },
                "transition-color": { "duration": 2000, "delay": 500 }
            }
        }
    }]
};
