var style_json = {
    "mapping": [
        {
            "layer": "water",
            "sort": {
                "water": true
            }
        },
        {
            "layer": "admin",
            "sort": {
                "borders": true
            }
        },
        {
            "layer": "waterway",
            "field": "class",
            "sort": {
                "waterway": true
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
        {
            "layer": "building",
            "sort": {
                "building": true
            }
        },
        {
            "layer": "poi_label",
            "field": "maki",
            "sort": {
                "embassy": "embassy",
                "park": "park",
                "restaurant": "restaurant"
            }
        },
        {
            "layer": "tunnel",
            "field": "class",
            "sort": {
                "tunnel_large": ["motorway", "main"],
                "tunnel_regular": ["street", "street_limited"],
                "tunnel_rail": ["minor_rail", "major_rail"],
            }
        },
        {
            "layer": "road",
            "field": "oneway",
            "sort": {
                "road_markers": [1],
            }
        },
        {
            "layer": "road",
            "field": "class",
            "sort": {
                "road_large": ["motorway", "main"],
                "road_regular": ["street"],
                "road_limited": ["street_limited"],
                "rail": ["major_rail"],
                "path": ["path"]
            }
        },
        {
            "layer": "bridge",
            "field": "class",
            "sort": {
                "bridge_large": ["motorway", "main"],
                "bridge_regular": ["street", "street_limited"]
            }
        },
        {
            "layer": "country_label",
            "sort": {
                "country_label": true
            }
        },
        {
            "layer": "place_label",
            "sort": {
                "place_label": true
            }
        },
        {
            "layer": "road_label",
            "sort": {
                "road_label": true
            }
        }
    ],
    "sprite": {
        "image": "img/maki-sprite.png",
        "retina": "img/maki-sprite@2x.png",
        "positions": "img/maki-sprite.json",
    },
    "constants": {
        "land": "#e8e0d8",
        "water": "#73b6e6",
        "park": "#c8df9f",
        "road": "#fefefe",
        "border": "#6d90ab",
        "wood": "#33AA66",
        "building": "#d9ccbe",
        "text": "#000000",
        "satellite_brightness_low": 0,
        "satellite_brightness_high": 1,
        "satellite_saturation": 1,
        "satellite_spin": 0
    },
    "background": "land",
    "buckets": {
        "landuse_park": { "type": "fill" },
        "landuse_wood": { "type": "fill" },
        "landuse_school": { "type": "fill" },
        "landuse_cemetery": { "type": "fill" },
        "landuse_industrial": { "type": "fill" },
        "water": { "type": "fill" },
        "waterway": { "type": "line" },
        "tunnel_large": { "type": "line" },
        "tunnel_regular": { "type": "line" },
        "tunnel_rail": { "type": "line" },
        "bridge_large": { "type": "line" },
        "bridge_regular": { "type": "line" },
        "borders": { "type": "line" },
        "building": { "type": "fill" },
        "road_large": { "type": "line", "cap": "round", "join": "bevel" },
        "road_regular": { "type": "line", "cap": "round", "join": "bevel" },
        "road_limited": { "type": "line", "cap": "round", "join": "butt", "roundLimit": 0.7 },
        "rail": { "type": "line", "cap": "round", "join": "bevel" },
        "path": { "type": "line", "cap": "round", "join": "bevel" },
        "embassy": { "type": "point" },
        "park": { "type": "point" },
        "restaurant": { "type": "point" },
        "road_markers": { "type": "point", "marker": true, "spacing": 200 },
        "country_label": {
            "type": "text",
            "field": "name",
            "path": "curve",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 16
        },
        "place_label": {
            "type": "text",
            "field": "name",
            "path": "curve",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 18
        },
        "road_label": {
            "type": "text",
            "field": "name",
            "path": "curve",
            "font": "Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS",
            "fontSize": 12
        }
    },
    "layers": [
        {
            "bucket": "landuse_park",
            "color": "park",
            "antialias": true
        },
        {
            "bucket": "landuse_wood",
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
            "antialias": true
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
            "bucket": "restaurant",
            "image": "restaurant-12",
        },
        {
            "bucket": "embassy",
            "image": "embassy-12",
        },
        {
            "bucket": "park",
            "image": "park-12",
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
