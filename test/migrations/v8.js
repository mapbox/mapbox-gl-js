'use strict';

var t = require('tape'),
    migrate = require('../../migrations/v8');

t('split text-font', function(t) {
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

t('rename symbol-min-distance', function(t) {
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

t('renames urls', function(t) {
    var input = {
      "version": 7,
      "sources": { "vector": { "type": "video", "url": ["foo"],
          coordinates: [[1, 0], [1, 0], [1, 0], [1, 0]]
      }}
    };

    var output = {
      "version": 8,
      "sources": { "vector": { "type": "video", "urls": ["foo"],
          coordinates: [[0, 1], [0, 1], [0, 1], [0, 1]]
      }}
    };

    t.deepEqual(migrate(input), output, 'renames url and flips coordinates of of video');
    t.end();
});

t('infer and update opacity constant', function(t) {
    var input = {
      "version": 7,
      "constants": {
        "@foo": 0.5
      },
      "sources": {
        "vector": { "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5" }
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
        "@foo": { "type": "opacity", "value": 0.5 }
      },
      "sources": {
        "vector": { "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5" }
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

t('infer and update fontstack constant', function(t) {
    var input = {
      "version": 7,
      "constants": {
        "@foo": "Arial Unicode,Foo Bar"
      },
      "sources": {
        "vector": { "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5" }
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
        "@foo": { "type": "font-array", "value": ["Arial Unicode", "Foo Bar"] }
      },
      "sources": {
        "vector": { "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v5" }
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
