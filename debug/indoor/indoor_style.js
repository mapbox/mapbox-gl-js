function isSelectedFloor() {
    // True if the current level is selected
    return ["in", ["get", "floor_id"], ["config", "mbx-indoor-level-selected"]]
}

function isSelectedFloorVisible() {
    // True if the current level is selected
    return ["!=", ["length", ["config", "mbx-indoor-level-selected"]], 0]
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
            isSelectedFloorVisible()
        ],
        "layout": {
            "clip-layer-types": ["model", "symbol"]
        }
    },
    {
        "type": "fill",
        "id": "building-outline-non-transparent",
        "source": "indoor-source",
        "source-layer": "indoor_structure",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            ["==", ["geometry-type"], "Polygon"],
            ["in", ["get", "shape_type"], ["literal", ["building"]]],
            isSelectedFloorVisible()
        ],
        "paint": {
            // Note: We should keep opacity above zero to enable queries of the footprint
            "fill-opacity": 1,
            "fill-color": "#e8a5b8"
        }
    },
    {
        "type": "fill",
        "id": "building-outline",
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
            "fill-opacity": 0.01,
            "fill-color": "#e8a5b8"
        }
    },
    {
        "type": "fill",
        "id": "floor-outline",
        "source": "indoor-source",
        "source-layer": "indoor_floor",
        "minzoom": 16.0,
        "slot": "middle",
        "filter": [
            "all",
            ["in", ["get", "shape_type"], ["literal", ["floor"]]],
        ],
        "paint": {
            // Note: We should keep opacity above zero to enable queries of the footprint
            "fill-opacity": 0.01,
            "fill-color": "#803080"
        }
    },
    {
        "type": "fill",
        "id": "rooms-accessible",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16.0,
        "filter": [
            "all",
            isSelectedFloor(),
            ["==", ["get", "shape_type"], "room"],
            ["!=", ["get", "type"], "inaccessible"]
        ],
        "paint": {
            "fill-opacity": 1,
            "fill-color": [
                "case",
                isSelectedFloor(),
                "#367dc9",
                ["rgba", 0, 0, 0, 0]
            ],
        }
    },
    {
        "type": "fill",
        "id": "rooms-misc",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16.0,
        "filter": [
            "all",
            isSelectedFloor(),
            ["==", ["get", "shape_type"], "room"],
            ["in", ["get", "type"], ["literal", ["fast_casual", "casual_dining", "experiences", "cards_gifts_and_books", "health_and_beauty", "uncategorized"]]]
        ],
        "paint": {
            "fill-opacity": 1,
            "fill-color": [
                "case",
                isSelectedFloor(),
                "#267510",
                ["rgba", 0, 0, 0, 0]
            ],
        }
    },
    {
        "type": "fill",
        "id": "rooms-inaccessible",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16.0,
        "filter": [
            "all",
            isSelectedFloor(),
            ["==", ["get", "shape_type"], "room"],
            ["==", ["get", "type"], "inaccessible"]
        ],
        "paint": {
            "fill-opacity": 1,
            "fill-color": [
                "case",
                isSelectedFloor(),
                "#bf303e",
                ["rgba", 0, 0, 0, 0]
            ],
        }
    },
    {
        "type": "fill",
        "id": "occupants",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16.0,
        "filter": [
            "all",
            isSelectedFloor(),
            ["==", ["get", "shape_type"], "occupant"],
        ],
        "paint": {
            "fill-opacity": 1,
            "fill-color": [
                "case",
                isSelectedFloor(),
                "#3bd9c6",
                ["rgba", 0, 0, 0, 0]
            ],
        }
    },
    {
        "id": "gates",
        "type": "symbol",
        "source": "indoor-source",
        "source-layer": "indoor_label",
        "minzoom": 16,
        "filter": [
            "all",
            isSelectedFloor(),
            ["in", ["get", "shape_type"], ["literal", ["gate", "Gate"]]]
        ],
        "layout": {
            "text-size": 16,
            "icon-text-fit": "width",
            "icon-image": "gate-label",
            "icon-text-fit-padding": [0, 5, 0, 5],
            "text-font": [ "Arial Unicode MS Bold"],
            "text-color": "#000000",
            "text-offset": [0, 0],
            "icon-size": 0.9,
            "text-field": [
                "case",
                ["has", "name"],
                [
                    "let",
                    "gateName",
                    ["get", "name"],
                    [
                        "case",
                        [
                            "==",
                            ["slice", ["var", "gateName"], 0, 5],
                            "Gate "
                        ],
                        ["slice", ["var", "gateName"], 5],
                        ["var", "gateName"]
                    ]
                ],
                ""
            ],
            "text-letter-spacing": 0.04,
            "icon-padding": 12
        },
        "paint": {
            "text-halo-color": "#ffffff",
            "text-color": "#000000",
            "text-translate": [0, 1]
        }
    },
    {
        "type": "line",
        "id": "walls",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16.0,
        "filter": [
            "all",
            isSelectedFloor(),
            [
                "any",
                ["==", ["get", "shape_type"], "room"],
                ["==", ["get", "shape_type"], "area"]
            ]            
        ],
        "paint": {
            "line-width": ["interpolate", ["linear"], ["zoom"], 17, 0.5, 19, 0.3],
            "line-color": [
                "case",
                isSelectedFloor(),
                'hsl(40, 43%, 93%)',
                ["rgba", 0, 0, 0, 0]
            ],
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
                                "building_id": ["get", "building_id"],
                                "shape_type": ["get", "shape_type"],
                                "name": ["get", "name"],
                                "numeric_name": ["get", "numeric_name"],
                                "floor_level": ["get", "floor_level"]
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
                                "building_id": ["get", "building_id"],
                                "shape_type": ["get", "shape_type"],
                                "name": ["get", "name"],
                                "numeric_name": ["get", "numeric_name"],
                                "floor_level": ["get", "floor_level"]
                            }
                        }
                    ]
                },
            },
            sources: {
                "indoor-source": {
                    "type": "vector",
                    "url": "mapbox://mapbox.indoor-v2"
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