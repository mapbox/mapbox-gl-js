'use strict';

const t = require('mapbox-gl-js-test').test,
    format = require('../../../src/style-spec/format');

function roundtrip(style) {
    return JSON.parse(format(style));
}

t('orders top-level keys', (t) => {
    t.deepEqual(Object.keys(roundtrip({
        "layers": [],
        "other": {},
        "sources": {},
        "glyphs": "",
        "sprite": "",
        "version": 6
    })), ['version', 'sources', 'sprite', 'glyphs', 'layers', 'other']);
    t.end();
});

t('orders layer keys', (t) => {
    t.deepEqual(Object.keys(roundtrip({
        "layers": [{
            "paint": {},
            "layout": {},
            "id": "id",
            "type": "type"
        }]
    }).layers[0]), ['id', 'type', 'layout', 'paint']);
    t.end();
});
