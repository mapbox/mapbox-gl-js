'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const Protobuf = require('pbf');
const VectorTile = require('vector-tile').VectorTile;
const loadGeometry = require('../../../src/data/load_geometry.js');

// Load a line feature from fixture tile.
const vt = new VectorTile(new Protobuf(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));

test('loadGeometry', (t) => {
    const feature = vt.layers.road.feature(0);
    const originalGeometry = feature.loadGeometry();
    const scaledGeometry = loadGeometry(feature);
    t.equal(scaledGeometry[0][0].x, originalGeometry[0][0].x * 2, 'scales x coords by 2x');
    t.equal(scaledGeometry[0][0].y, originalGeometry[0][0].y * 2, 'scales y coords by 2x');
    t.end();
});

test('loadGeometry extent error', (t) => {
    const feature = vt.layers.road.feature(0);
    feature.extent = 2048;

    let numWarnings = 0;

    // Use a custom console.warn to count warnings
    const warn = console.warn;
    console.warn = function(warning) {
        if (warning.match(/Geometry exceeds allowed extent, reduce your vector tile buffer size/)) {
            numWarnings++;
        }
    };

    loadGeometry(feature, 15);

    t.equal(numWarnings, 1);

    // Put it back
    console.warn = warn;

    t.end();
});
