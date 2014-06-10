var style = {
    "version": "1",
    "layers": [
        {
            "id": "background"
        },
        {
            "id": "satellite",
            "filter": {
                "source": "satellite"
            }
        },
        {
            "id": "park",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "landuse",
                "class": "park"
            }
        },
        {
            "id": "wood",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "landuse",
                "class": "wood"
            }
        },
        {
            "id": "water",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "water"
            }
        },
        {
            "id": "waterway",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "waterway"
            }
        },
        {
            "id": "roads",
            "layers": [
                {
                    "id": "tunnel_large_casing",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "tunnel",
                        "class": [
                            "motorway",
                            "main"
                        ]
                    }
                },
                {
                    "id": "tunnel_regular_casing",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "tunnel",
                        "class": [
                            "street",
                            "street_limited"
                        ]
                    }
                },
                {
                    "id": "tunnel_large",
                    "copy": "tunnel_large_casing",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "tunnel",
                        "class": [
                            "motorway",
                            "main"
                        ]
                    }
                },
                {
                    "id": "tunnel_regular",
                    "copy": "tunnel_regular_casing",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "tunnel",
                        "class": [
                            "street",
                            "street_limited"
                        ]
                    }
                },
                {
                    "id": "road_large_casing",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "road",
                        "class": [
                            "motorway",
                            "main"
                        ]
                    }
                },
                {
                    "id": "road_regular_casing",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "road",
                        "class": "street"
                    }
                },
                {
                    "id": "road_limited",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "road",
                        "class": "street_limited"
                    }
                },
                {
                    "id": "road_large",
                    "copy": "road_large_casing",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "road",
                        "class": [
                            "motorway",
                            "main"
                        ]
                    }
                },
                {
                    "id": "road_regular",
                    "copy": "road_regular_casing",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "road",
                        "class": "street"
                    }
                },
                {
                    "id": "path",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "road",
                        "class": "path"
                    }
                },
                {
                    "id": "rail",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "road",
                        "class": "major_rail"
                    }
                },
                {
                    "id": "tunnel_rail",
                    "filter": {
                        "source": "mapbox.mapbox-streets-v5",
                        "layer": "tunnel",
                        "class": [
                            "minor_rail",
                            "major_rail"
                        ]
                    }
                }
            ]
        },
        {
            "id": "route",
            "filter": {
                "source": "geojson"
            }
        },
        {
            "id": "road_markers",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "road",
                "oneway": 1,
                "feature_type": "line"
            }
        },
        {
            "id": "building",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "building"
            }
        },
        {
            "id": "borders",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "admin"
            }
        },
        {
            "id": "bridge_large_casing",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "bridge",
                "class": [
                    "motorway",
                    "main"
                ]
            }
        },
        {
            "id": "bridge_large",
            "copy": "bridge_large_casing",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "bridge",
                "class": [
                    "motorway",
                    "main"
                ]
            }
        },
        {
            "id": "park_poi",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "poi_label",
                "maki": "park"
            }
        },
        {
            "id": "poi",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "poi_label"
            }
        },
        {
            "id": "country_label",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "country_label",
                "feature_type": "point"
            }
        },
        {
            "id": "place_label",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "place_label",
                "feature_type": "point"
            }
        },
        {
            "id": "road_label",
            "filter": {
                "source": "mapbox.mapbox-streets-v5",
                "layer": "road_label",
                "feature_type": "line"
            }
        }
    ],
    "constants": {
        "land": "#eee",
        "water": "#999",
        "park": "#bda",
        "road": "#fefefe",
        "border": "#6d90ab",
        "wood": "#33AA66",
        "building": "#ddd",
        "building_outline": "#ccc",
        "text": "#000000",
        "satellite_brightness_low": 0,
        "satellite_brightness_high": 1,
        "satellite_saturation": 0,
        "satellite_spin": 0,
        "satellite_contrast": 0,
        "road_blur": 1,
        "stroke_width": 0.25
    },
    "styles": {
        "default": {
            "route": {
                "line-color": "#EC8D8D",
                "line-width": {
                    "fn": "exponential",
                    "z": 9,
                    "val": 1,
                    "slope": 0.21,
                    "min": 4
                }
            },
            "background": {
                "fill-color": "land",
                "transition-fill-color": {
                    "duration": 500,
                    "delay": 0
                }
            },
            "park": {
                "fill-color": "park",
                "line-color": "#9b8",
                "line-width": 5
            },
            "wood": {
                "fill-color": "wood",
                "fill-opacity": 0.08
            },
            "water": {
                "fill-color": "water"
            },
            "waterway": {
                "line-color": "water",
                "line-width": {
                    "fn": "linear",
                    "z": 9,
                    "val": 1,
                    "slope": 0.5,
                    "min": 0.5
                }
            },
            "tunnel_large_casing": {
                "line-color": [
                    0,
                    0,
                    0,
                    0.5
                ],
                "line-width": 1,
                "line-offset": {
                    "fn": "exponential",
                    "z": 9,
                    "val": -1,
                    "slope": 0.2,
                    "min": 1
                },
                "min-zoom": 14
            },
            "tunnel_regular_casing": {
                "line-color": [
                    0,
                    0,
                    0,
                    0.5
                ],
                "line-width": 1,
                "line-offset": {
                    "fn": "exponential",
                    "z": 11,
                    "val": 0.5,
                    "slope": 0.2,
                    "min": 1
                },
                "min-zoom": 15.5
            },
            "tunnel_large": {
                "line-color": [
                    1,
                    1,
                    1,
                    0.5
                ],
                "line-width": {
                    "fn": "exponential",
                    "z": 9,
                    "val": -1,
                    "slope": 0.2,
                    "min": 1
                }
            },
            "tunnel_regular": {
                "line-color": [
                    1,
                    1,
                    1,
                    0.5
                ],
                "line-width": {
                    "fn": "exponential",
                    "z": 11,
                    "val": -1,
                    "slope": 0.2,
                    "min": 1
                }
            },
            "roads": {
                "opacity": 1,
                "transition-opacity": {
                    "duration": 500,
                    "delay": 0
                }
            },
            "road_large_casing": {
                "line-color": [
                    0.6,
                    0.6,
                    0.6,
                    1
                ],
                "line-width": {
                    "fn": "exponential",
                    "z": 9,
                    "val": 1,
                    "slope": 0.21,
                    "min": 4
                },
                "line-opacity": {
                    "fn": "linear",
                    "z": 14,
                    "val": 0,
                    "slope": 1,
                    "min": 0,
                    "max": 1
                },
                "transition-line-width": {
                    "duration": 500,
                    "delay": 0
                },
                "line-blur": "road_blur",
                "min-zoom": 13,
                "line-cap": "round",
                "line-join": "bevel"
            },
            "road_regular_casing": {
                "line-color": [
                    0.6,
                    0.6,
                    0.6,
                    1
                ],
                "line-width": {
                    "fn": "exponential",
                    "z": 10,
                    "val": 0.5,
                    "slope": 0.2,
                    "min": 1
                },
                "line-opacity": {
                    "fn": "linear",
                    "z": 15.5,
                    "val": 0,
                    "slope": 1,
                    "min": 0,
                    "max": 1
                },
                "line-blur": "road_blur",
                "min-zoom": 15.5,
                "line-cap": "round",
                "line-join": "bevel"
            },
            "road_limited": {
                "line-dasharray": [
                    10,
                    2
                ],
                "line-color": "road",
                "line-blur": "road_blur",
                "line-width": {
                    "fn": "exponential",
                    "z": 10,
                    "val": -1,
                    "slope": 0.2,
                    "min": 1
                },
                "line-cap": "round",
                "line-join": "butt",
                "line-round-limit": 0.7
            },
            "road_large": {
                "line-color": "road",
                "line-blur": "road_blur",
                "line-width": {
                    "fn": "exponential",
                    "z": 9,
                    "val": -1,
                    "slope": 0.2,
                    "min": 1
                }
            },
            "road_regular": {
                "line-color": "road",
                "line-blur": "road_blur",
                "line-width": {
                    "fn": "exponential",
                    "z": 10,
                    "val": -1,
                    "slope": 0.2,
                    "min": 1
                }
            },
            "path": {
                "line-color": [
                    1,
                    1,
                    1,
                    1
                ],
                "line-dasharray": [
                    2,
                    2
                ],
                "line-width": 2,
                "line-cap": "round",
                "line-join": "bevel"
            },
            "rail": {
                "line-color": [
                    0.3,
                    0.3,
                    0.3,
                    0.8
                ],
                "line-dasharray": [
                    2,
                    1
                ],
                "line-width": 3,
                "line-cap": "round",
                "line-join": "bevel"
            },
            "tunnel_rail": {
                "line-color": [
                    0.3,
                    0.3,
                    0.3,
                    0.3
                ],
                "line-dasharray": [
                    2,
                    1
                ],
                "line-width": 3
            },
            "road_markers": {
                "point-alignment": "line",
                "min-zoom": 15.5,
                "point-image": "bicycle-12",
                "point-spacing": 200
            },
            "building": {
                "fill-color": "building",
                "transition-fill-opacity": {
                    "duration": 500,
                    "delay": 500
                },
                "fill-opacity": {
                    "fn": "linear",
                    "z": 14,
                    "val": 0,
                    "slope": 1,
                    "min": 0,
                    "max": 1
                },
                "stroke-color": "building_outline"
            },
            "borders": {
                "line-color": [
                    0,
                    0,
                    0,
                    0.3
                ],
                "line-width": 1
            },
            "bridge_large_casing": {
                "line-color": [
                    0,
                    0,
                    0,
                    0.4
                ],
                "line-width": {
                    "fn": "exponential",
                    "z": 9,
                    "val": 1.5,
                    "slope": 0.2,
                    "min": 1
                },
                "min-zoom": 14
            },
            "bridge_large": {
                "line-color": "road",
                "line-width": {
                    "fn": "exponential",
                    "z": 9,
                    "val": -1,
                    "slope": 0.2,
                    "min": 1
                }
            },
            "park_poi": {
                "point-color": "green"
            },
            "poi": {
                "point-alignment": "screen",
                "point-size": [
                    12,
                    12
                ],
                "point-image": "{{maki}}-12"
            },
            "country_label": {
                "text-halo-color": [
                    1,
                    1,
                    1,
                    0.7
                ],
                "text-halo-width": "stroke_width",
                "text-color": "text",
                "text": true,
                "text-field": "{{name}}",
                "text-font": "Open Sans Regular, Arial Unicode MS Regular",
                "text-max-size": 16,
                "text-path": "horizontal",
                "text-padding": 10
            },
            "place_label": {
                "text-halo-color": [
                    1,
                    1,
                    1,
                    0.7
                ],
                "text-halo-width": "stroke_width",
                "text-color": "text",
                "text": true,
                "text-field": "{{name}}",
                "text-font": "Open Sans Semibold, Arial Unicode MS Regular",
                "text-max-size": 18,
                "text-path": "horizontal",
                "text-max-width": 2,
                "text-line-height": 1.2,
                "text-always-visible": true
            },
            "road_label": {
                "text-color": "text",
                "text-halo-color": [
                    1,
                    1,
                    1,
                    0.7
                ],
                "text-halo-width": "stroke_width",
                "text-size": {
                    "fn": "exponential",
                    "z": 14,
                    "val": 8,
                    "slope": 1,
                    "min": 8,
                    "max": 12
                },
                "text": true,
                "text-field": "{{name}}",
                "text-font": "Open Sans Regular, Arial Unicode MS Regular",
                "text-max-size": 12,
                "text-path": "curve",
                "text-min-dist": 250,
                "text-max-angle": 1.04
            },
            "satellite": {}
        },
        "satellite": {
            "background": {
                "transition-fill-color": {
                    "duration": 500,
                    "delay": 500
                },
                "fill-opacity": 0,
                "fill-color": [
                    1,
                    0,
                    0,
                    0
                ]
            },
            "roads": {
                "transition-opacity": {
                    "duration": 500,
                    "delay": 500
                },
                "opacity": 0.5
            },
            "building": {
                "fill-opacity": 0,
                "transition-fill-opacity": {
                    "duration": 500,
                    "delay": 0
                }
            },
            "park": {
                "transition-fill-color": {
                    "duration": 500,
                    "delay": 0
                },
                "fill-color": [
                    0,
                    0,
                    0,
                    0
                ]
            },
            "water": {
                "fill-opacity": 0
            },
            "road_large": {
                "transition-line-width": {
                    "duration": 500,
                    "delay": 1000
                },
                "line-width": {
                    "fn": "exponential",
                    "z": 10,
                    "val": -1,
                    "slope": 0.2,
                    "min": 1
                }
            },
            "road_large_casing": {
                "line-width": {
                    "fn": "exponential",
                    "z": 10,
                    "val": 1,
                    "slope": 0.21,
                    "min": 4
                },
                "transition-line-width": {
                    "duration": 500,
                    "delay": 1000
                }
            },
            "road_regular_casing": {
                "transition-line-width": {
                    "duration": 500,
                    "delay": 1000
                },
                "line-width": {
                    "fn": "exponential",
                    "z": 11,
                    "val": 0.5,
                    "slope": 0.2,
                    "min": 1
                }
            },
            "road_regular": {
                "transition-line-width": {
                    "duration": 500,
                    "delay": 1000
                },
                "line-width": {
                    "fn": "exponential",
                    "z": 11,
                    "val": -1,
                    "slope": 0.2,
                    "min": 1
                }
            },
            "satellite": {
                "raster-brightness-low": "satellite_brightness_low",
                "raster-brightness-high": "satellite_brightness_high",
                "raster-saturation": "satellite_saturation",
                "raster-spin": "satellite_spin",
                "raster-contrast": "satellite_contrast"
            }
        },
        "test": {
            "road_large_casing": {
                "line-width": {
                    "fn": "exponential",
                    "z": 8,
                    "val": 1,
                    "slope": 0.21,
                    "min": 4
                },
                "line-color": [
                    1,
                    0,
                    0,
                    1
                ],
                "transition-line-width": {
                    "duration": 500,
                    "delay": 0
                },
                "transition-line-color": {
                    "duration": 2000,
                    "delay": 500
                }
            }
        }
    },
    "sprite": "img/sprite"
};
