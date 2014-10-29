'use strict';

var t = require('tape'),
    format = require('../lib/format');

function roundtrip(style) {
    return JSON.parse(format(style));
}

t('orders top-level keys', function(t) {
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

t('orders layer keys', function(t) {
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
