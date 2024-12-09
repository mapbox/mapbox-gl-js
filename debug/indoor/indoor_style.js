function getLevelHeight() {
    // Returns the top height of the feature's level
    return ["get", ["get", "level"], ["config", "mbx-indoor-level-height"]]
}

function getLevelBase() {
    // Returns the base height of the feature's level
    return ["get", ["get", "level"], ["config", "mbx-indoor-level-base"]]
}

function getLevelSelected() {
    // True if the current level is selected
    return ["==", ["get", ["get", "level"], ["config", "mbx-indoor-level-selected"]], "true"]
}

function getFloorplanSelected() {
    // True if the current level is selected
    return ["in", ["get", "floorplan"], ["config", "mbx-indoor-active-floorplans"]]
}

function getLevelOverlapped() {
    // True if the level is below the current selected one
    return ["==", ["get", ["get", "level"], ["config", "mbx-indoor-level-overlapped"]], "true"]
}

const indoorLayers = [
    {
        "type": "clip",
        "id": "clip-area",
        "source": "indoor-data",
        "minzoom": 16.0,
        "filter": [
            "all",
            ["==", ["geometry-type"], "Polygon"],
            ["==", ["get", "indoor"], "floorplan"],
            ["!=", 0, ["length", ["array", ["config", "mbx-indoor-loaded-levels"]]]]
        ],
        "layout": {
            "clip-layer-types": ["model", "symbol"]
        }
    },
    {
        "type": "fill",
        "id": "query-area",
        "source": "indoor-data",
        "slot": "middle",
        "filter": [
            "all",
            ["==", ["geometry-type"], "Polygon"],
            ["==", ["get", "indoor"], "floorplan"]
        ],
        "paint": {
            // Note: We should keep opacity above zero to enable queries of the footprint
            "fill-opacity": 0.03,
            "fill-color": "#800080"
        }
    },
    {
        "type": "background",
        "id": "dimming-bg",
        "minzoom": 16,
        "paint": {
            "background-pitch-alignment": "viewport",
            "background-opacity": [
                'interpolate',
                ['linear'],
                ['zoom'],
                16.5,
                0.0,
                17.0,
                [
                    "case",
                    ["config", "mbx-indoor-underground"],
                    0.4,
                    0.0
                ]
            ],
            "background-color": ["hsla", 0, 0, 0, 0.5]
        }
    },
    {
        "type": "fill-extrusion",
        "id": "areas",
        "source": "indoor-data",
        "minzoom": 16.0,
        "filter": [
            "all",
            ["in", ["get", "level"], ["config", "mbx-indoor-loaded-levels"]],
            ["!=", ["geometry-type"], "Point"],
            ["==", ["get", "indoor"], "area"]
        ],
        "paint": {
            "fill-extrusion-opacity": 1,
            "fill-extrusion-cast-shadows": false,
            "fill-extrusion-color": [
                "case",
                getLevelSelected(),
                "#f2ede2",
                ["rgba", 0, 0, 0, 0]
            ],
            "fill-extrusion-height": getLevelBase(),
            "fill-extrusion-base": getLevelBase()
        }
    },
    {
        "type": "fill-extrusion",
        "id": "walls",
        "source": "indoor-data",
        "minzoom": 16.0,
        "filter": [
            "all",
            ["in", ["get", "level"], ["config", "mbx-indoor-loaded-levels"]],
            ["!=", ["geometry-type"], "Point"],
            [
                "any",
                ["==", ["get", "indoor"], "room"],
                ["==", ["get", "indoor"], "area"]
            ]            
        ],
        "paint": {
            "fill-extrusion-line-width": ["interpolate", ["linear"], ["zoom"], 17, 0.3, 19, 0.1],
            "fill-extrusion-color": [
                "case",
                getLevelSelected(),
                'hsl(40, 43%, 93%)',
                ["rgba", 0, 0, 0, 0]
            ],
            "fill-extrusion-height": getLevelHeight(),
            "fill-extrusion-base": getLevelBase(),
        }
    },
    {
        "type": "fill-extrusion",
        "id": "rooms",
        "source": "indoor-data",
        "minzoom": 16.0,
        "filter": [
            "all",
            ["in", ["get", "level"], ["config", "mbx-indoor-loaded-levels"]],
            ["==", ["geometry-type"], "Polygon"],
            ["==", ["get", "indoor"], "room"]
        ],
        "paint": {
            "fill-extrusion-opacity": 1,
            "fill-extrusion-cast-shadows": false,
            "fill-extrusion-color": [
                "case",
                getLevelSelected(),
                "#d8caca",
                ["rgba", 0, 0, 0, 0]
            ],
            "fill-extrusion-height": getLevelHeight(),
            "fill-extrusion-base": getLevelBase()
        }
    },
    {
        "type": "symbol",
        "id": "indoor-symbols",
        "source": "indoor-data",
        "filter": [
            "all",
            ["in", ["get", "level"], ["config", "mbx-indoor-loaded-levels"]],
            ["==", ["get", "indoor"], "room"]
        ],
        "layout": {
            "text-field": ["get", "name"],
            "text-size": 14,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"]
        },
        "paint": {
            "text-color": "black",
            "text-opacity": [
                "case",
                getLevelSelected(),
                1.0,
                0.0
            ],
            "symbol-z-offset": getLevelHeight(),
            "text-halo-color": "white",
            "text-halo-width": 2
        }
    },
    {
        "type": "symbol",
        "id": "indoor-building-entry-symbol",
        "source": "indoor-data",
        "maxzoom": 17,
        "filter": [
            "all",
            ["==", ["get", "class"], "building"],
            ["has", "floorplan"]
        ],
        "layout": {
            "text-anchor": "top",
            "text-field": ["concat", ["get", "name"], "\nLook Inside"],
            "text-max-width": 8,    
            "text-size": 14,
            "text-padding": 36,
            "text-font": [
                "case",
                getFloorplanSelected(),
                ["DIN Pro Bold", "Arial Unicode MS Bold"],
                ["DIN Pro Medium", "Arial Unicode MS Regular"]
            ]
        },
        "paint": {
            "text-color": [
                "case",
                getFloorplanSelected(),
                [
                    "interpolate",
                    ["linear"],
                    ["measure-light", "brightness"],
                    0.25,
                    "red",
                    0.3,
                    "hsl(225, 90%, 50%)"
                ],
                [
                    "interpolate",
                    ["linear"],
                    ["measure-light", "brightness"],
                    0.25,
                    "hsl(225, 60%, 60%)",
                    0.3,
                    "hsl(225, 60%, 50%)"
                ]
            ],
            "text-halo-color": "white",
            "text-halo-width": 2
        }
    }
];