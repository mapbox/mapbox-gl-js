'use strict';

var t = require('tape'),
    migrate = require('../../migrations/v7');

t('remove prerendered layer', function(t) {
    t.deepEqual(migrate({
        "version": 6,
        "layers": [{
            "type": "raster",
            "layers": [{}]
        }]
    }), {
        "version": 7,
        "layers": []
    });
    t.end();
});
