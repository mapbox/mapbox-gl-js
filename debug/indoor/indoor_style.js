function isSelectedFloor() {
    // True if the current level is selected
    return ["is-active-floor", ["get", "floor_id"]]
}

function isSelectedFloorBase() {
    // True if the current level is selected
    return ["is-active-floor", ["get", "id"]]
}

const indoorLayers = [{
        "type": "clip",
        "id": "clip-area",
        "source": "indoor-source",
        "source-layer": "indoor_structure_metadata",
        "minzoom": 15.0,
        "filter": [
            "all",
            ["==", ["get", "type"], "building"],
            [">", ["step", ["zoom"], 0, 16, 1], 0]
        ],
        "layout": {
            "clip-layer-types": ["model", "symbol"]
        }
    },
    {
      "type": "fill",
      "id": "building-footprint",
      "source": "indoor-source",
      "source-layer": "indoor_structure",
      "minzoom": 15,
      "slot": "middle",
      "paint": {
          "fill-color": "hsl(0, 0.00%, 100.00%)",
          "fill-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15.9,
              0,
              16,
              0.4,
              17,
              1
          ]
      }
    },
    {
        "type": "fill-extrusion",
        "id": "floor-current",
        "source": "indoor-source",
        "source-layer": "indoor_floor",
        "minzoom": 15,
        "slot": "middle",
        "filter": isSelectedFloorBase(),
        "paint": {
            "fill-extrusion-color": "hsl(0, 0.00%, 100.00%)",
            "fill-extrusion-height": 3,
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                15.9,
                0,
                16,
                0,
                17,
                1
            ]
        }
    },
    {
        "id": "floor-current-walls",
        "type": "fill-extrusion",
        "source": "indoor-source",
        "source-layer": "indoor_floor",
        "minzoom": 16,
        "slot": "middle",
        "filter": [
            "all",
            isSelectedFloorBase()
        ],
        "paint": {
            "fill-extrusion-line-width": ["interpolate", ["linear"],
                ["zoom"], 17, 0.4, 19, 0.1
            ],
            "fill-extrusion-color": "hsl(217, 25%, 85%)",
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
            ]
        }
    },
    {
        "id": "floorplan-doors",
        "type": "fill-extrusion",
        "source": "indoor-source",
        "source-layer": "indoor_door",
        "minzoom": 16,
        "slot": "middle",
        "filter": [
            "all",
            isSelectedFloor(),
            ["match", ["get", "class"],
                ["external_door", "inter_building_door"], true, false
            ]
        ],
        "paint": {
            "fill-extrusion-line-width": 0.4,
            "fill-extrusion-color": [
                "case",
                ["match", ["get", "class"],
                    ["inter_building_door"], true, false
                ],
                "hsl(220, 16%, 95%)",
                "hsl(220, 25%, 90%)"
            ],

            "fill-extrusion-height": 5.2,
            "fill-extrusion-base": 3,
            "fill-extrusion-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                16,
                0,
                17,
                1
            ]
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
            ["match", ["get", "shape_type"],
                ["occupant", "room", "amenity", "carousel"], true, false
            ],
            [
                "match",
                ["get", "type"],
                ["parking", "corridor"],
                false,
                true
            ],
            ["match", ["get", "name"],
                ["Baggage Claim Area"], false, true
            ]
        ],
        "paint": {
            "fill-extrusion-height": [
                "case",
                [
                    "match",
                    ["get", "type"],
                    ["ticketing"],
                    true,
                    false
                ],
                4,
                [
                    "match",
                    ["get", "shape_type"],
                    ["carousel"],
                    true,
                    false
                ],
                3.4,
                6
            ],
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
                ["match", ["get", "shape_type"],
                    ["carousel"], true, false
                ],
                "hsl(250, 75%, 90%)",
                ["match", ["get", "class"],
                    ["retail"], true, false
                ],
                "hsl(220, 78%, 85%)",
                ["match", ["get", "class"],
                    ["restaurants"], true, false
                ],
                "hsl(20, 75%, 85%)",
                ["match", ["get", "class"],
                    ["travel"], true, false
                ],
                "hsl(8, 70%, 85%)",
                ["match", ["get", "type"],
                    ["inaccessible"], true, false
                ],
                "hsl(217, 25%, 82%)",
                "hsl(220, 25%, 90%)"
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
            ["match", ["get", "shape_type"],
                ["occupant", "room", "amenity", "carousel"], true, false
            ],
            [
                "match",
                ["get", "type"],
                ["parking", "corridor"],
                false,
                true
            ],
            ["match", ["get", "name"],
                ["Baggage Claim Area"], false, true
            ]
        ],
        "layout": {
            "line-elevation-reference": "ground",
            "line-z-offset": [
                "case",
                [
                    "match",
                    ["get", "type"],
                    ["ticketing"],
                    true,
                    false
                ],
                4,
                [
                    "match",
                    ["get", "shape_type"],
                    ["carousel"],
                    true,
                    false
                ],
                3.4,
                6
            ]
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
            "line-color": "hsl(240, 33%, 73%)"
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
            ["match", ["get", "shape_type"],
                ["area"], true, false
            ],
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
                0.6
            ],
            "fill-extrusion-color": "#f8cf7e",
            "fill-extrusion-pattern": [
                "image",
                "area-security",
                {
                    "params": {
                        "color-1": "#f8cf7e"
                    }
                }
            ]
        }
    },
    {
        "id": "floorplan-area-security-perimeter",
        "type": "line",
        "source": "indoor-source",
        "source-layer": "indoor_floorplan",
        "minzoom": 16,
        "slot": "middle",
        "filter": [
            "all",
            isSelectedFloor(),
            [
                "==",
                [
                    "get",
                    "shape_type"
                ],
                "area"
            ],
            [
                "==",
                [
                    "get",
                    "type"
                ],
                "post_security"
            ]
        ],
        "layout": {
            "line-elevation-reference": "ground",
            "line-z-offset": 3.05,
            "line-cap": "round",
            "line-join": "round"
        },
        "paint": {
            "line-color": [
                "interpolate",
                ["linear"],
                ["zoom"],
                16,
                "rgba(162, 175, 189, 0)",
                16.2,
                "rgba(162, 175, 189, 1)"
            ],
            "line-dasharray": [
                3,
                2,
                1
            ]
        }
    },
    {
        "id": "floorplan-services-label",
        "type": "symbol",
        "source": "indoor-source",
        "source-layer": "indoor_label",
        "minzoom": 17.5,
        "filter": [
            "all",
            isSelectedFloor(),
            [
                "match",
                ["get", "class"],
                ["venue_services", "connector"],
                true,
                false
            ]
        ],
        "layout": {
            "icon-image": [
                "case",
                ["match", ["get", "type"],
                    ["elevator"], true, false
                ],
                "elevator",
                ["match", ["get", "type"],
                    ["escalator"], true, false
                ],
                "escalator",
                ["match", ["get", "type"],
                    ["stairs"], true, false
                ],
                "stairs",
                ["match", ["get", "type"],
                    ["atm"], true, false
                ],
                "atm",
                ["match", ["get", "name"],
                    ["Information"], true, false
                ],
                "information",
                ["match", ["get", "name"],
                    ["Men's Restroom"], true, false
                ],
                "toilet-male",
                [
                    "match",
                    ["get", "name"],
                    ["Women's Restroom"],
                    true,
                    false
                ],
                "toilet-female",
                ["match", ["get", "name"],
                    ["Restroom"], true, false
                ],
                "toilet",
                ""
            ],
            "icon-size": 1.1,
            "symbol-z-elevate": false
        }
    },
    {
        "type": "symbol",
        "id": "floorplan-doors-label",
        "source": "indoor-source",
        "source-layer": "indoor_door",
        "minzoom": 17.5,
        "filter": [
            "all",
            isSelectedFloor(),
            ["match", ["get", "class"],
                ["external_door", "inter_building_door"], true, false
            ]
        ],
        "layout": {
            "text-size": 13,
            "icon-image": ["get", "class"],
            "icon-rotation-alignment": "viewport",
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-offset": [0, 1],
            "icon-size": 1.1,
            "text-anchor": "top",
            "text-pitch-alignment": "viewport",
            // TODO data issue: "name" property might not yet be present in the tileset?
            "text-field": ["to-string", ["get", "name"]],
            "text-letter-spacing": 0.04,
            "icon-padding": 12
        },
        "paint": {
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.3,
            "text-color": "#556268",
            "symbol-z-offset": 6
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
            ["match", ["get", "shape_type"],
                ["occupant", "carousel", "amenity"], true, false
            ],
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
            "text-offset": [
                "case",
                ["match", ["get", "class"],
                    ["retail", "restaurants"], true, false
                ],
                ["literal", [0, 1]],
                ["match", ["get", "shape_type"],
                    ["carousel"], true, false
                ],
                ["literal", [0, 0.8]],
                ["literal", [0, 0.5]]
            ],
            "symbol-z-elevate": false,
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
                ["match", ["get", "shape_type"],
                    ["carousel"], true, false
                ],
                "suitcase",
                [
                    "image",
                    "dot-11",
                    {
                        "params": {
                            "color-1": "hsl(210, 20%, 43%)"
                        }
                    }
                ]
            ],
            "icon-padding": 12,
        },
        "paint": {
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.3,
            "text-color": [
                "case",
                ["match", ["get", "class"],
                    ["retail"], true, false
                ],
                "hsl(210, 75%, 53%)",
                ["match", ["get", "class"],
                    ["restaurants"], true, false
                ],
                "hsl(30, 100%, 48%)",
                ["match", ["get", "shape_type"],
                    ["carousel"], true, false
                ],
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
            ["match", ["get", "shape_type"],
                ["gate"], true, false
            ]
        ],
        "layout": {
            "icon-image": [
                "image",
                "gate-label",
                {
                    "params": {
                        "color-1": "hsl(39, 90%, 66%)"
                    }
                }
            ],
            "icon-size": 0.9,
            "icon-text-fit": "width",
            "icon-text-fit-padding": [0, 8, 0, 8],
            "icon-padding": 20,
            "text-size": 12,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "symbol-z-elevate": false,
            "text-offset": [0, 0],
            "text-field": [
                "case",
                ["has", "name"],
                [
                    "let",
                    "gate_name",
                    ["get", "name"],
                    [
                        "case",
                        [
                            "==",
                            [
                                "slice",
                                [
                                    "var",
                                    "gate_name"
                                ],
                                0,
                                5
                            ],
                            "Gate "
                        ],
                        [
                            "slice",
                            ["var", "gate_name"],
                            5
                        ],
                        ["var", "gate_name"]
                    ]
                ],
                ""
            ],
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
            "icon-image": "security",
            "icon-size": 1.1,
            "text-size": 13,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "symbol-z-elevate": false,
            "text-offset": [0, 0.8],
            "text-anchor": "top",
            "text-field": [
                "case",
                ["==", ["get", "name"], "SecurityZoneExit"],
                "Security Zone Exit",
                ["to-string", ["get", "name"]]
            ],
            "text-letter-spacing": 0.04
        },
        "paint": {
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.3,
            "text-color": "hsl(0, 0%, 0%)"
        }
    },
    {
        "type": "symbol",
        "id": "floorplan-building-label",
        "source": "indoor-source",
        "source-layer": "indoor_label",
        "minzoom": 14.0,
        "maxzoom": 18.0,
        "filter": [
            "all",
            [
                "match",
                [
                    "get",
                    "shape_type"
                ],
                [
                    "building"
                ],
                true,
                false
            ]
        ],
        "layout": {
            "text-size": 14,
            "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "symbol-z-elevate": false,
            "text-anchor": "top",
            "text-field": ["to-string", ["get", "name"]],
            "text-letter-spacing": 0.04,
            "text-max-width": 9
        },
        "paint": {
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.3,
            "text-color": [
                "interpolate",
                ["linear"],
                [
                    "measure-light",
                    "brightness"
                ],
                0.25,
                "hsl(225, 60%, 60%)",
                0.3,
                "hsl(225, 60%, 50%)"
            ],
            "emissive-strength": 1.5
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
            indoor: {
              "airports": {
                "sourceId": "indoor-source",
                "sourceLayers": ["indoor_structure_metadata", "indoor_floor_metadata"]
              }
            },
            sources: {
                "indoor-source": {
                    "type": "vector",
                    "url": "mapbox://mapbox-geodata.indoor-v3-0-1/"
                },
            },
            layers: indoorLayers,
            glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
            sprite: "mapbox://sprites/mapbox-map-design/cmd4iv83e00is01qn62mc008z/0r1fy1wvosyt47i0zdh0ytjvd"
        }
    }],
    sources: {},
    layers: []
};
