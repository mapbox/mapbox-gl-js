'use strict';

const test = require('tap').test;
const fs = require('fs');
const path = require('path');

test('mapbox-gl-plugins', function(t) {
    t.test('is valid JSON', function(t) {
        t.doesNotThrow(function() {
            JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/_data/plugins.json')));
        });
        t.end();
    });
    t.end();
});
