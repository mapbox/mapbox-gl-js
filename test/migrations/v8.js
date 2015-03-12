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
