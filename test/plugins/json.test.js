'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');

test('mapbox-gl-plugins', (t) => {
    t.test('is valid JSON', (t) => {
        t.doesNotThrow(() => {
            JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/_data/plugins.json')));
        });
        t.end();
    });
    t.end();
});
