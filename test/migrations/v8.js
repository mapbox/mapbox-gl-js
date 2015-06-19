'use strict';

var t = require('tape'),
    migrate = require('../../migrations/v8');

t('split text-font', function (t) {
    var input = {
        "version": 7,
        "sources": {
            "vector": {
                "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": "Helvetica, Arial",
                    "text-field": "{foo}"
                }
            }
        ]
    };

    var output = {
        "version": 8,
        "sources": {
            "vector": {
                "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": ["Helvetica", "Arial"],
                    "text-field": "{foo}"
                }
            }
        ]
    };

    t.deepEqual(migrate(input), output, 'splits text-font');
    t.end();
});

t('rename symbol-min-distance', function (t) {
    var input = {
        "version": 7,
        "sources": {
            "vector": {
                "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "symbol-min-distance": 2
                }
            }
        ]
    };

    var output = {
        "version": 8,
        "sources": {
            "vector": {
                "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "symbol-spacing": 2
                }
            }
        ]
    };

    t.deepEqual(migrate(input), output, 'renames symbol-min-distance');
    t.end();
});

t('renames urls', function (t) {
    var input = {
        "version": 7,
        "sources": {
            "vector": {
                "type": "video", "url": ["foo"],
                coordinates: [[1, 0], [1, 0], [1, 0], [1, 0]]
            }
        }
    };

    var output = {
        "version": 8,
        "sources": {
            "vector": {
                "type": "video", "urls": ["foo"],
                coordinates: [[0, 1], [0, 1], [0, 1], [0, 1]]
            }
        }
    };

    t.deepEqual(migrate(input), output, 'renames url and flips coordinates of of video');
    t.end();
});


t('migrate interpolated scales', function (t) {
    var input = {
        "version": 7,
        "sources": {
            "vector": {
                "type": "vector",
                "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [{
            "id": "scales",
            "type": "symbol",
            "source": "vector",
            "source-layer": "layer",
            "layout": {
                "line-width": {
                    base: 2,
                    stops: [[1, 2], [3, 6]]
                }
            }
        }]
    };

    var output = {
        "version": 8,
        "sources": {
            "vector": {
                "type": "vector",
                "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [{
            "id": "scales",
            "type": "symbol",
            "source": "vector",
            "source-layer": "layer",
            "layout": {
                "line-width": {
                    type: "exponential",
                    base: 2,
                    domain: [1, 3],
                    range: [2, 6]
                }
            }
        }]
    };

    t.deepEqual(migrate(input), output);
    t.end();
});

t('migrate piecewise-constant scales', function (t) {
    var input = {
        "version": 7,
        "sources": {
            "vector": {
                "type": "vector",
                "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [{
            "id": "scales",
            "type": "symbol",
            "source": "vector",
            "source-layer": "layer",
            "layout": {
                "text-transform": {
                    stops: [[1, "uppercase"], [3, "lowercase"]],
                }
            }
        }]
    };

    var output = {
        "version": 8,
        "sources": {
            "vector": {
                "type": "vector",
                "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [{
            "id": "scales",
            "type": "symbol",
            "source": "vector",
            "source-layer": "layer",
            "layout": {
                "text-transform": {
                    type: "interval",
                    domain: [1, 3],
                    range: ["uppercase", "uppercase", "lowercase"],
                }
            }
        }]
    };

    t.deepEqual(migrate(input), output);
    t.end();
});

t('migrate constant function', function (t) {
    var input = {
        "version": 7,
        "constants": {
            "@function": {
                stops: [[1, "uppercase"], [3, "lowercase"]],
            }
        },
        "sources": {
            "vector": {
                "type": "vector",
                "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [{
            "id": "scales",
            "type": "symbol",
            "source": "vector",
            "source-layer": "layer",
            "layout": {
                "text-transform": "@function"
            }
        }]
    };

    var output = {
        "version": 8,
        "constants": {
            "@function": {
                "type": "text-transform-enum",
                "value": {
                    type: "interval",
                    domain: [1, 3],
                    range: ["uppercase", "uppercase", "lowercase"],
                }
            }
        },
        "sources": {
            "vector": {
                "type": "vector",
                "url": "mapbox://mapbox.mapbox-streets-v5"
            }
        },
        "layers": [{
            "id": "scales",
            "type": "symbol",
            "source": "vector",
            "source-layer": "layer",
            "layout": {
                "text-transform": "@function"
            }
        }]
    };

    t.deepEqual(migrate(input), output);
    t.end();
});

t('infer and update opacity constant', function (t) {
    var input = {
        "version": 7,
        "constants": {
            "@foo": 0.5
        },
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "fill",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "fill-opacity": "@foo"
                }
            }
        ]
    };

    var output = {
        "version": 8,
        "constants": {
            "@foo": {"type": "opacity", "value": 0.5}
        },
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "fill",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "fill-opacity": "@foo"
                }
            }
        ]
    };

    t.deepEqual(migrate(input), output, 'infers opacity type');
    t.end();
});

t('infer and update fontstack constant', function (t) {
    var input = {
        "version": 7,
        "constants": {
            "@foo": "Arial Unicode,Foo Bar"
        },
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": "@foo"
                }
            }
        ]
    };

    var output = {
        "version": 8,
        "constants": {
            "@foo": {"type": "font-array", "value": ["Arial Unicode", "Foo Bar"]}
        },
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": "@foo"
                }
            }
        ]
    };

    t.deepEqual(migrate(input), output, 'infers opacity type');
    t.end();
});

t('update fontstack function', function (t) {
    var input = {
        "version": 7,
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": {
                        "base": 1,
                        "stops": [
                            [
                                0,
                                "Open Sans Regular, Arial Unicode MS Regular"
                            ],
                            [
                                6,
                                "Open Sans Semibold, Arial Unicode MS Regular"
                            ]
                        ]
                    }
                }
            }
        ]
    };

    var output = {
        "version": 8,
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": {
                        "type": "interval",
                        "domain": [0, 6],
                        "range": [
                            ["Open Sans Regular", "Arial Unicode MS Regular"],
                            ["Open Sans Regular", "Arial Unicode MS Regular"],
                            ["Open Sans Semibold", "Arial Unicode MS Regular"]
                        ]
                    }
                }
            }
        ]
    };

    t.deepEqual(migrate(input), output);
    t.end();
});

t('update fontstack constant function', function (t) {
    var input = {
        "version": 7,
        "constants": {
            "@function": {
                "base": 1,
                "stops": [
                    [
                        0,
                        "Open Sans Regular, Arial Unicode MS Regular"
                    ],
                    [
                        6,
                        "Open Sans Semibold, Arial Unicode MS Regular"
                    ]
                ]
            }
        },
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": "@function"
                }
            }
        ]
    };

    var output = {
        "version": 8,
        "constants": {
            "@function": {
                "type": "font-array",
                "value": {
                    "type": "interval",
                    "domain": [0, 6],
                    "range": [
                        ["Open Sans Regular", "Arial Unicode MS Regular"],
                        ["Open Sans Regular", "Arial Unicode MS Regular"],
                        ["Open Sans Semibold", "Arial Unicode MS Regular"]
                    ]
                }
            }
        },
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": "@function"
                }
            }
        ]
    };

    t.deepEqual(migrate(input), output);
    t.end();
});

t('update fontstack function constant', function (t) {
    var input = {
        "version": 7,
        "constants": {
            "@font-stack-a": "Open Sans Regular, Arial Unicode MS Regular",
            "@font-stack-b": "Open Sans Semibold, Arial Unicode MS Regular"
        },
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": {
                        "base": 1,
                        "stops": [
                            [0, "@font-stack-a"],
                            [6, "@font-stack-b"]
                        ]
                    }
                }
            }
        ]
    };

    var output = {
        "version": 8,
        "constants": {
            "@font-stack-a": {
                "type": "font-array",
                "value": ["Open Sans Regular", "Arial Unicode MS Regular"]
            },
            "@font-stack-b": {
                "type": "font-array",
                "value": ["Open Sans Semibold", "Arial Unicode MS Regular"]
            }
        },
        "sources": {
            "vector": {"type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5"}
        },
        "layers": [
            {
                "id": "minimum",
                "type": "symbol",
                "source": "vector",
                "source-layer": "layer",
                "layout": {
                    "text-font": {
                        "type": "interval",
                        "domain": [0, 6],
                        "range": [
                            "@font-stack-a",
                            "@font-stack-a",
                            "@font-stack-b"
                        ]
                    }
                }
            }
        ]
    };

    t.deepEqual(migrate(input), output);
    t.end();
});
