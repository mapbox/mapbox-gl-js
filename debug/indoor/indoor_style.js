function isSelectedFloor() {
    // True if the current level is selected
    return ["in", ["get", "floor_id"], ["config", "mbx-indoor-level-selected"]]
}

function isSelectedFloorBase() {
    // True if the current level is selected
    return ["in", ["get", "id"], ["config", "mbx-indoor-level-selected"]]
}

const indoorLayers = [
    {
        "type": "clip",
        "id": "clip-area",
        "source": "indoor-source",
        "source-layer": "indoor_structure",
        "minzoom": 16.0,
        "filter": [
            "all",
            ["==", ["get", "shape_type"], "building"],
        ],
        "layout": {
            "clip-layer-types": ["model", "symbol"]
        }
    },
    {
        "type": "fill-extrusion",
        "id": "building",
        "source": "indoor-source",
        "source-layer": "indoor_structure",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            ["==", ["geometry-type"], "Polygon"],
            ["in", ["get", "shape_type"], ["literal", ["building"]]],
        ],
        "paint": {
            // Note: We should keep opacity above zero to enable queries of the footprint
            "fill-extrusion-color": "#fbfbfb",
            "fill-extrusion-opacity": 0.6,
            "fill-extrusion-height": 1
        }
    },
    // NOTE: In reality we mustn't rely on *_metadata layers, but in current example we need to use them due to internal implementation of indoor with QRF, this will be changed 
    {
        "type": "fill",
        "id": "building-outline",
        "source": "indoor-source",
        "source-layer": "indoor_structure_metadata",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            ["==", ["geometry-type"], "Polygon"],
            ["in", ["get", "type"], ["literal", ["building"]]],
        ],
        "paint": {
            // Note: We should keep opacity above zero to enable queries of the footprint,
            // Keep 0.01 do be not visible, 0.1 useful to debug and see metadata geometries
            "fill-opacity": 0.1,
            "fill-color": "#e8a5b8"
        }
    },
    // NOTE: In reality we mustn't rely on *_metadata layers, but in current example we need to use them due to internal implementation of indoor with QRF, this will be changed 
    {
        "type": "fill",
        "id": "floor-outline",
        "source": "indoor-source",
        "source-layer": "indoor_floor_metadata",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            ["in", ["get", "type"], ["literal", ["floor"]]],
        ],
        "paint": {
            // Note: We should keep opacity above zero to enable queries of the footprint
            "fill-opacity": 0.01,
            "fill-color": "#803080"
        }
    },
    {
        "type": "fill-extrusion",
        "id": "floor-current",
        "source": "indoor-source",
        "source-layer": "indoor_floor",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": isSelectedFloorBase(),
        "paint": {
            "fill-extrusion-height": 3,
            "fill-extrusion-base": 1,
            "fill-extrusion-color": "hsl(220, 16%, 95%)"
        }
    },
    {
        "type": "fill-extrusion",
        "id": "floor-current-walls",
        "source": "indoor-source",
        "source-layer": "indoor_floor",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": isSelectedFloorBase(),
        "paint": {
            "fill-extrusion-line-width": 0.3,
            "fill-extrusion-height": 6,
            "fill-extrusion-base": 3,
            "fill-extrusion-color": "blue"
        }
    },
    {
        "type": "fill-extrusion",
        "id": "floorplan-rooms",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            isSelectedFloor(),
            ["match", ["get", "shape_type"], ["occupant", "room", "amenity"], true, false],
            [
                "match",
                ["get", "type"],
                ["parking", "corridor"],
                false,
                true
            ],
            ["match", ["get", "name"], ["Baggage Claim Area"], false, true]
        ],
        "layout": {"fill-extrusion-edge-radius": 0.1},
        "paint": {
            "fill-extrusion-height": 6,
            "fill-extrusion-base": 3,
            "fill-extrusion-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                16,
                0,
                17,
                1
            ],
            "fill-extrusion-color": [
                "case",
                ["match", ["get", "class"], ["retail"], true, false],
                "hsl(220, 78%, 85%)",
                ["match", ["get", "class"], ["restaurants"], true, false],
                "hsl(20, 75%, 85%)",
                ["match", ["get", "class"], ["travel"], true, false],
                "hsl(8, 70%, 85%)",
                ["match", ["get", "type"], ["inaccessible"], true, false],
                "hsl(217, 22%, 80%)",
                "hsl(220, 25%, 85%)"
            ],
        }
    },
    {
        "type": "line",
        "id": "floorplan-rooms-case",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            isSelectedFloor(),
            ["match", ["get", "shape_type"], ["occupant", "room", "amenity"], true, false],
            [
                "match",
                ["get", "type"],
                ["parking", "corridor"],
                false,
                true
            ],
            ["match", ["get", "name"], ["Baggage Claim Area"], false, true]
        ],
        "layout": {
            "line-elevation-reference": "ground",
            "line-z-offset": 6
        },
        "paint": {
            "line-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                16,
                0,
                17,
                0.4
            ],
            "line-color": "#a3a3d1"
        }
    },
    {
        "type": "fill-extrusion",
        "id": "floorplan-baggage-claim",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            isSelectedFloor(),
            ["match", ["get", "shape_type"], ["carousel"], true, false]
        ],
        "paint": {
            "fill-extrusion-height": 3.1,
            "fill-extrusion-base": 3,
            "fill-extrusion-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                16,
                0,
                17,
                1
            ],
            "fill-extrusion-color": "hsl(250, 75%, 90%)",
        }
    },
    {
        "type": "fill-extrusion",
        "id": "floorplan-area-security",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            isSelectedFloor(),
            ["match", ["get", "shape_type"], ["area"], true, false],
            [
                "match",
                ["get", "type"],
                ["security", "securityzoneexit"],
                true,
                false
            ]
        ],
        "paint": {
            "fill-extrusion-height": 3.05,
            "fill-extrusion-base": 3,
            "fill-extrusion-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                16,
                0,
                17,
                0.2
            ],
            "fill-extrusion-color": "#f8cf7e",
        }
    },
    {
        "type": "symbol",
        "id": "floorplan-rooms-label",
        "source": "indoor-source",
        "source-layer": "indoor_label",
        "minzoom": 16.0,
        "filter": [
            "all",
            isSelectedFloor(),
            ["match", ["get", "shape_type"], ["occupant", "carousel", "amenity"], true, false],
            [
                "match",
                ["get", "type"],
                ["vacant", "corridor", "inaccessible", "restrooms"],
                false,
                true
            ]
        ],
        "layout": {
            "text-size": 13,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-padding": 12,
            "text-offset": [0, 0.5],
            "symbol-z-elevate": true,
            "text-anchor": "top",
            "text-field": ["to-string", ["get", "name"]],
            "text-letter-spacing": 0.04,
            "text-max-width": 8,
            "icon-image": [
                "case",
                ["==", ["get", "class"], "retail"],
                "shop",
                ["==", ["get", "type"], "coffee"],
                "cafe",
                ["==", ["get", "class"], "restaurants"],
                "restaurant",
                ["match", ["get", "shape_type"], ["carousel"], true, false],
                "suitcase",
                [
                    "image",
                    "dot-11",
                    {"params": {"color-1": "hsl(210, 20%, 43%)"}}
                ]
            ],
            "icon-padding": 12,
        },
        "paint": {
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.3,
            "text-color": [
                "case",
                ["match", ["get", "class"], ["retail"], true, false],
                "hsl(210, 75%, 53%)",
                ["match", ["get", "class"], ["restaurants"], true, false],
                "hsl(30, 100%, 48%)",
                ["match", ["get", "shape_type"], ["carousel"], true, false],
                "hsl(250, 75%, 65%)",
                "hsl(210, 20%, 43%)"
            ]
        }
    },
    {
        "id": "floorplan-gates-label",
        "type": "symbol",
        "source": "indoor-source",
        "source-layer": "indoor_label",
        "minzoom": 16,
        "filter": [
            "all",
            isSelectedFloor(),
            ["match", ["get", "shape_type"], ["gate"], true, false]
        ],
        "layout": {
            "text-size": 12,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "symbol-z-elevate": true,
            "text-offset": [0, 0],
            "text-field": ["to-string", ["get", "name"]],
            "text-letter-spacing": 0.04,
        },
        "paint": {
            "text-color": "hsl(0, 0%, 0%)",
            "text-translate": [0, 0]
        }
    },
    {
        "type": "symbol",
        "id": "floorplan-security-label",
        "source": "indoor-source",
        "source-layer": "indoor_label",
        "minzoom": 16.0,
        "filter": [
            "all",
            isSelectedFloor(),
            [
                    "match",
                    ["get", "type"],
                    ["security", "securityzoneexit"],
                    true,
                    false
            ]
        ],
        "layout": {
            "text-size": 13,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "symbol-z-elevate": true,
            "text-offset": [0, 0.8],
            "text-anchor": "top",
            "text-field": ["to-string", ["get", "name"]],
            "text-letter-spacing": 0.04
        },
        "paint": {
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.3,
            "text-color": "hsl(0, 0%, 0%)"
        }
    },
];


const style = {
    version: 8,
    imports: [{
        id: 'standard',
        url: 'mapbox://styles/mapbox/standard'
    }, {
        id: 'indoor',
        url: '',
        data: {
            version: 8,
            featuresets: {
                "building-outline": {
                    "selectors": [
                        {
                            "layer": "building-outline",
                            "properties": {
                                "id": ["get", "id"],
                                "type": ["get", "type"],
                                "name": ["get", "name"],
                            }
                        }
                    ]
                },
                "floor-outline": {
                    "selectors": [
                        {
                            "layer": "floor-outline",
                            "properties": {
                                "id": ["get", "id"],
                                "is_default": ["get", "is_default"],
                                "building_ids": ["get", "building_ids"],
                                "type": ["get", "type"],
                                "name": ["get", "name"],
                                "z_index": ["get", "z_index"],
                                "connected_floor_ids": ["get", "connected_floor_ids"],
                                "conflicted_floor_ids": ["get", "conflicted_floor_ids"]
                            }
                        }
                    ]
                },
            },
            sources: {
                "indoor-source": {
                    "type": "vector",
                    "url": "mapbox://mapbox-geodata.indoor-v2-next"
                }
            },
            indoor: {
                floorplanFeaturesetId: "floorplan-detection",
                buildingFeaturesetId: "building-entry"
            },
            layers: indoorLayers,
            glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf"
        }
    }],
    sources: {},
    layers: []
};