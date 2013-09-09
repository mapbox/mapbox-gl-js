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
            "layer": "tunnel",
            "field": "class",
            "sort": {
                "tunnel_large": ["motorway", "main"],
                "tunnel_regular": ["street", "street_limited"]
            }
        },
        {
            "layer": "road",
            "field": "class",
            "sort": {
                "road_large": ["motorway", "main"],
                "road_regular": ["street", "street_limited"]
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
            "label": "name_en",
            "sort": {
                "country_label": true
            }
        }
    ],
    "constants": {
        "land": "#e8e0d8",
        "water": "#73b6e6",
        "park": "#c8df9f",
        "road": "#fefefe",
        "border": "#6d90ab",
        "wood": "#33AA66",
        "building": "#d9ccbe"
    },
    "layers": [
        // {
        //     "data": "#background",
        //     "type": "fill",
        //     "color": "water"
        // },
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
            "enabled": ["min", 13]
        },
        {
            "data": "road_regular",
            "type": "line",
            "color": [0, 0, 0, 1],
            "width": ["exponential", 10, 0.5, 0.2, 1],
            "enabled": ["min", 14.5 ]
        },
        {
            "data": "road_large",
            "type": "line",
            "color": "road",
            "width": ["exponential", 8, -1, 0.2, 1]
        },
        {
            "data": "road_regular",
            "type": "line",
            "color": "road",
            "width": ["exponential", 10, -1, 0.2, 1]
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
            "color": [0, 0, 0, 1],
            "width": ["exponential", 8, 1.5, 0.2, 1],
            "enabled": ["min", 13]
        },
        {
            "data": "bridge_large",
            "type": "line",
            "color": "road",
            "width": ["exponential", 8, -1, 0.2, 1]
        },
       //  {
       //     "data": "country_label",
       //     "type": "text",
       //     "color": "#000000",
       //     "width": 2
       // },
        {
            "data": "building",
            "type": "point",
            "url": "city-24.png"
        },
        {
           "data": "country_label",
           "type": "text",
           "color": "#000000",
           "width": 2
       }
    ]
};
