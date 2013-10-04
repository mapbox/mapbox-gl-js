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
            "point": true,
            "sort": {
                "embassy": "embassy"
            }
        },
        {
            "layer": "poi_label",
            "field": "maki",
            "point": true,
            "sort": {
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
            "field": "class",
            "sort": {
                "road_large": ["motorway", "main"],
                "road_regular": ["street"],
                "road_limited": ["street_limited"],
                "rail": ["major_rail"],
                "path": ["path"]
            },
            "linecap": "round"
        },
        {
            "layer": "bridge",
            "field": "class",
            "sort": {
                "bridge_large": ["motorway", "main"],
                "bridge_regular": ["street", "street_limited"]
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
        "satellite_spin": 0
    },
    "background": "land",
    "layers": [
        // {
        //     "data": "#background",
        //     "type": "fill",
        //     "color": "water"
        // },
        //
        {
            "data": "landuse_park",
            "type": "fill",
            "color": "park",
            "antialias": true
        },
        {
            "data": "landuse_wood",
            "type": "fill",
            "color": "wood",
            "opacity": 0.08,
            "antialias": true
        },
        {
            "data": "water",
            "type": "fill",
            "color": "water",
            "antialias": true
        },
        {
            "data": "waterway",
            "type": "line",
            "color": "water",
            "width": ["linear", 8, 1, 0.5, 0.5]
        },
        {
            "data": "tunnel_large",
            "type": "line",
            "color": [0, 0, 0, 0.5],
            "width": 1,
            "offset": ["exponential", 8, -1, 0.2, 1],
            "enabled": ["min", 13]
        },
        {
            "data": "tunnel_regular",
            "type": "line",
            "color": [0, 0, 0, 0.5],
            "width": 1,
            "offset": ["exponential", 10, 0.5, 0.2, 1],
            "enabled": ["min", 14.5 ]
        },
        {
            "data": "tunnel_large",
            "type": "line",
            "color": [ 1, 1, 1, 0.5],
            "width": ["exponential", 8, -1, 0.2, 1]
        },
        {
            "data": "tunnel_regular",
            "type": "line",
            "color": [ 1, 1, 1, 0.5],
            "width": ["exponential", 10, -1, 0.2, 1]
        },
        {
            "data": "building",
            "type": "fill",
            "color": "building",
            "antialias": true
        },
        {
            "data": "road_large",
            "type": "line",
            "color": [0.6, 0.6, 0.6, 1],
            "width": ["exponential", 8, 1.0, 0.2, 1],
            "enabled": ["min", 13],
            "linecap": "round"
        },
        {
            "data": "road_regular",
            "type": "line",
            "color": [0, 0, 0, 1],
            "width": ["exponential", 10, 0.5, 0.2, 1],
            "enabled": ["min", 14.5 ],
            "linecap": "round"
        },
        {
            "data": "road_limited",
            "type": "line",
            "dasharray": [10, 2],
            "color": "road",
            "width": ["exponential", 9, -1, 0.2, 1],
            "linecap": "round"
        },
        {
            "data": "road_large",
            "type": "line",
            "color": "road",
            "width": ["exponential", 8, -1, 0.2, 1],
            "linecap": "round"
        },
        {
            "data": "road_regular",
            "type": "line",
            "color": "road",
            "width": ["exponential", 10, -1, 0.2, 1],
            "linecap": "round"
        },
        {
            "data": "path",
            "type": "line",
            "color": [1,1,1,1],
            "dasharray": [2,2],
            "width": 2
        },
        {
            "data": "rail",
            "type": "line",
            "color": [0.3,0.3,0.3,0.8],
            "dasharray": [2, 1],
            "width" : 3,
            "linecap": "round"
        },
        {
            "data": "tunnel_rail",
            "type": "line",
            "color": [0.3,0.3,0.3,0.3],
            "dasharray": [2, 1],
            "width" : 3,
            "linecap": "round"
        },
        {
            "data": "borders",
            "type": "line",
            "color": [0,0,0,0.3],
            "width": 1
        },
        {
            "data": "bridge_large",
            "type": "line",
            "color": [0, 0, 0, 0.4],
            "width": ["exponential", 8, 1.5, 0.2, 1],
            "enabled": ["min", 13]
        },
        {
            "data": "bridge_large",
            "type": "line",
            "color": "road",
            "width": ["exponential", 8, -1, 0.2, 1]
        },
        {
            "data": "restaurant",
            "type": "point",
            "image": "restaurant-12",
        },
        {
            "data": "embassy",
            "type": "point",
            "image": "embassy-12",
        },
        {
            "data": "park",
            "type": "point",
            "image": "park-12",
        }
    ]
};

var style_json2 = {
    mapping: style_json.mapping.map(_.clone),
    layers: style_json.layers.map(_.clone),
    background: _.clone(style_json.background),
    sprite: _.clone(style_json.sprite),
    constants: _.clone(style_json.constants)
};

style_json2.mapping[1].linecap = "round";
style_json2.layers[13].width = 10;
style_json2.constants.land = '#413932';
style_json2.constants.road = '#896161';
style_json2.constants.water = '#a7c9e1';
style_json2.constants.park = '#559376';
