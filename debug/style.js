'use strict';

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
            "type": "text",
            "text_field": "name",
            "path": "horizontal",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 16
        },
        "place_label": {
            "layer": "place_label",
            "type": "text",
            "text_field": "name",
            "path": "horizontal",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 18
        },
        "road_label": {
            "layer": "road_label",
            "type": "text",
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
    "layers": [
        {
            "bucket": "park",
            "color": "park",
            "antialias": true
        },
        {
            "bucket": "wood",
            "color": "wood",
            "opacity": 0.08,
            "antialias": true
        },
        {
            "bucket": "water",
            "color": "water",
            "antialias": true
        },
        {
            "bucket": "waterway",
            "color": "water",
            "width": ["linear", 8, 1, 0.5, 0.5]
        },
        {
            "bucket": "tunnel_large",
            "color": [0, 0, 0, 0.5],
            "width": 1,
            "offset": ["exponential", 8, -1, 0.2, 1],
            "enabled": ["min", 13]
        },
        {
            "bucket": "tunnel_regular",
            "color": [0, 0, 0, 0.5],
            "width": 1,
            "offset": ["exponential", 10, 0.5, 0.2, 1],
            "enabled": ["min", 14.5 ]
        },
        {
            "bucket": "tunnel_large",
            "color": [ 1, 1, 1, 0.5],
            "width": ["exponential", 8, -1, 0.2, 1]
        },
        {
            "bucket": "tunnel_regular",
            "color": [ 1, 1, 1, 0.5],
            "width": ["exponential", 10, -1, 0.2, 1]
        },
        {
            "type": "composited",
            "opacity": 1,
            "layers": [
            {
                "bucket": "road_large",
                "color": [0.6, 0.6, 0.6, 1],
                "width": ["exponential", 8, 1.0, 0.21, 4],
                "enabled": ["min", 13],
                "opacity": ["linear", 13, 0, 1, 0, 1]
            },
            {
                "bucket": "road_regular",
                "color": [0.6, 0.6, 0.6, 1],
                "width": ["exponential", 10, 0.5, 0.2, 1],
                "enabled": ["min", 14.5 ],
                "opacity": ["linear", 14.5, 0, 1, 0, 1]
            },
            {
                "bucket": "road_limited",
                "dasharray": [10, 2],
                "color": "road",
                "width": ["exponential", 9, -1, 0.2, 1],
            },
            {
                "bucket": "road_large",
                "color": "road",
                "width": ["exponential", 8, -1, 0.2, 1],
            },
            {
                "bucket": "road_regular",
                "color": "road",
                "width": ["exponential", 10, -1, 0.2, 1],
            },
            {
                "bucket": "path",
                "color": [1,1,1,1],
                "dasharray": [2,2],
                "width": 2
            },
            {
                "bucket": "rail",
                "color": [0.3,0.3,0.3,0.8],
                "dasharray": [2, 1],
                "width" : 3,
                "linejoin": "round"
            },
            {
                "bucket": "tunnel_rail",
                "color": [0.3,0.3,0.3,0.3],
                "dasharray": [2, 1],
                "width" : 3,
                "linejoin": "round"
            }]
        },
        {
            "bucket": "road_markers",
            "enabled": ["min", 14.5],
            "alignment": "line",
            "image": "bicycle-12",
        },
        {
            "bucket": "building",
            "color": "building",
            "stroke": "building_outline",
            "antialias": true,
            "opacity": ["linear", 13, 0, 1, 0, 1]

        },
        {
            "bucket": "borders",
            "color": [0,0,0,0.3],
            "width": 1
        },
        {
            "bucket": "bridge_large",
            "color": [0, 0, 0, 0.4],
            "width": ["exponential", 8, 1.5, 0.2, 1],
            "enabled": ["min", 13]
        },
        {
            "bucket": "bridge_large",
            "color": "road",
            "width": ["exponential", 8, -1, 0.2, 1]
        },
        {
            "bucket": "restaurant_poi",
            "image": "restaurant",
            "imageSize": 12
        },
        {
            "bucket": "embassy_poi",
            "image": "embassy",
            "imageSize": 12
        },
        {
            "bucket": "park_poi",
            "image": "park",
            "imageSize": 12
        },
        {
            "bucket": "country_label",
            "color": "text"
        },
        {
            "bucket": "place_label",
            "color": "text"
        },
        {
            "bucket": "road_label",
            "color": "text",
            "enabled": ["min", 10]
        }
    ]
};

var style_json2 = JSON.parse(JSON.stringify(style_json));

style_json2.constants.land = '#413932';
style_json2.constants.road = '#896161';
style_json2.constants.water = '#a7c9e1';
style_json2.constants.park = '#559376';
style_json2.constants.building = '#7f4343';
