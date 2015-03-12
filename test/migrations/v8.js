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
      "sources": { "vector": { "type": "video", "url": ["foo"] } }
    };

    var output = {
      "version": 8,
      "sources": { "vector": { "type": "video", "urls": ["foo"] } }
    };

    t.deepEqual(migrate(input), output, 'renames url of video');
    t.end();
});
