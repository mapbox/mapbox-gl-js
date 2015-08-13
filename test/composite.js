'use strict';

var test = require('tape');
var composite = require('../lib/composite');

test('composites Mapbox vector sources', function (t) {
    var result = composite({
        "version": 7,
        "sources": {
            "mapbox-a": {
                "type": "vector",
                "url": "mapbox://a"
            },
            "mapbox-b": {
                "type": "vector",
                "url": "mapbox://b"
            }
        },
        "layers": [{
            "id": "a",
            "type": "line",
            "source": "mapbox-a"
        }, {
            "id": "b",
            "type": "line",
            "source": "mapbox-b"
        }]
    });

    t.deepEqual(result.sources, {
        "a,b": {
            "type": "vector",
            "url": "mapbox://a,b"
        }
    });

    t.equal(result.layers[0].source, "a,b");
    t.equal(result.layers[1].source, "a,b");
    t.end();
});

test('does not composite vector + raster', function (t) {
    var result = composite({
        "version": 7,
        "sources": {
            "a": {
                "type": "vector",
                "url": "mapbox://a"
            },
            "b": {
                "type": "raster",
                "url": "mapbox://b"
            }
        },
        "layers": []
    });

    t.deepEqual(Object.keys(result.sources), ["a", "b"]);
    t.end();
});
