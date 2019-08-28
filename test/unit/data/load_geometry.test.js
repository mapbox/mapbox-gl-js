import {test} from '../../util/test';
import fs from 'fs';
import path from 'path';
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import loadGeometry from '../../../src/data/load_geometry.js';

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

test('loadGeometry warns and clamps when exceeding extent', (t) => {
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

    const lines = loadGeometry(feature);

    t.equal(numWarnings, 1);

    let maxValue = -Infinity;
    for (const line of lines) {
        for (const {x, y} of line) {
            maxValue = Math.max(x, y, maxValue);
        }
    }
    t.equal(maxValue, 16383);

    // Put it back
    console.warn = warn;

    t.end();
});
