'use strict';

var style = {
    "mapping": [
        {
            "layer": "water",
            "sort": {
                "water": true
            }
        },
        {
            "layer": "road",
            "field": "class",
            "sort": {
                "road_large": ["motorway", "main"],
                "road_regular": ["street"],
                "road_limited": ["street_limited"]
            }
        },
        {
        "layer": "landuse",
        "field": "class",
        "sort": {
            "landuse_park": "park",
            "landuse_wood": "wood",
            "landuse_school": "school",
            "landuse_cemetery": "cemetery",
            "landuse_industrial": "industrial"
        }
    },
    ],
    "buckets": {
        "water": { "type": "fill" },
        "road_large": { "type": "line", "cap": "round", "join": "bevel" },
        "road_regular": { "type": "line", "cap": "round", "join": "bevel" },
        "road_limited": { "type": "line", "cap": "round", "join": "bevel" },
        "landuse_park": { "type": "fill" },
        "landuse_wood": { "type": "fill" },
        "landuse_school": { "type": "fill" },
        "landuse_cemetery": { "type": "fill" },
        "landuse_industrial": { "type": "fill" }
    },
    "layers": [
        {
            "bucket": "landuse_park",
            "color": "#c8df9f",
            "antialias": true
        },
        {
            "bucket": "landuse_wood",
            "color": "#33AA66",
            "antialias": true
        },
        {
            "bucket": "water",
            "color": "#73b6e6",
            "antialias": true
        },
        {
            "bucket": "road_limited",
            "color": "#BBBBBB",
            "width": [
                "stops",
                { z: 0, val: 1 },
                { z: 20, val: 1 }
            ],
        },
        {
            "bucket": "road_regular",
            "color": "#999999",
            "width": [
                "stops",
                { z: 0, val: 0.5 },
                { z: 13, val: 0.5 },
                { z: 16, val: 2 },
                { z: 20, val: 32 }
            ],
        },
        {
            "bucket": "road_large",
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
    ]
};
