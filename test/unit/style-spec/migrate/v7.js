'use strict';

const t = require('mapbox-gl-js-test').test,
    migrate = require('../../../../src/style-spec/migrate/v7');

t('remove prerendered layer', (t) => {
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
