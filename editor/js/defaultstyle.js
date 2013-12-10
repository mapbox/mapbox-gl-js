"use strict";

module.exports = {
    "buckets": {
        "water": {
            "datasource": "streets",
            "layer": "water",
            "type": "fill"
        },
        "road_large": {
            "datasource": "streets",
            "layer": "road", "field": "class", "value": ["motorway", "main"],
            "type": "line", "cap": "round", "join": "bevel"
        },
        "road_regular": {
            "datasource": "streets",
            "layer": "road", "field": "class", "value": "street",
            "type": "line", "cap": "round", "join": "bevel"
        },
        "road_limited": {
            "datasource": "streets",
            "layer": "road", "field": "class", "value": "street_limited",
            "type": "line", "cap": "round", "join": "bevel"
        },
        "park": {
            "datasource": "streets",
            "layer": "landuse", "field": "class", "value": "park",
            "type": "fill"
        },
        "wood": {
            "datasource": "streets",
            "layer": "landuse", "field": "class", "value": "wood",
            "type": "fill"
        },
        "school": {
            "datasource": "streets",
            "layer": "landuse", "field": "class", "value": "school",
            "type": "fill"
        },
        "cemetery": {
            "datasource": "streets",
            "layer": "landuse", "field": "class", "value": "cemetery",
            "type": "fill"
        },
        "industrial": {
            "datasource": "streets",
            "layer": "landuse", "field": "class", "value": "industrial",
            "type": "fill"
        },
        "building": {
            "datasource": "streets",
            "layer": "building",
            "type": "fill"
        },
        "alcohol": {
            "datasource": "streets",
            "layer": "poi_label",
            "field": "type",
            "value": ["Alcohol"],
            "type": "point"
        }
    },
    "sprite": "img/maki-sprite",
    "structure": [
        { "name": "park", "bucket": "park" },
        { "name": "wood", "bucket": "wood" },
        { "name": "water", "bucket": "water" },
        { "name": "road_limited", "bucket": "road_limited" },
        { "name": "road_regular", "bucket": "road_regular" },
        { "name": "road_large", "bucket": "road_large" },
        { "name": "alcohol", "bucket": "alcohol" }
    ],
    "classes": [
        {
            "name": "default",
            "layers": {
                "background": {
                    "color": "#FFFFFF"
                },
                "park": {
                    "color": "#c8df9f",
                    "antialias": true
                },
                "wood": {
                    "color": "#33AA66",
                    "antialias": true
                },
                "water": {
                    "color": "#73b6e6",
                    "antialias": true
                },
                "road_limited": {
                    "color": "#BBBBBB",
                    "width": [
                        "stops",
                        { z: 0, val: 1 },
                        { z: 20, val: 1 }
                    ]
                },
                "road_regular": {
                    "color": "#999999",
                    "width": [
                        "stops",
                        { z: 0, val: 0.5 },
                        { z: 13, val: 0.5 },
                        { z: 16, val: 2 },
                        { z: 20, val: 32 }
                    ],
                },
                "road_large": {
                    "color": "#666666",
                    "width": [
                        "stops",
                        { z: 0, val: 0.5 },
                        { z: 11, val: 0.5 },
                        { z: 13, val: 1 },
                        { z: 16, val: 4 },
                        { z: 20, val: 64 }
                    ],
                },
                "alcohol": {
                    "image": "alcohol-shop"
                }
            }
        }
    ]
};
