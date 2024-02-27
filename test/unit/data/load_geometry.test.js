import {test, expect} from "../../util/vitest.js";
import Protobuf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';
import loadGeometry from '../../../src/data/load_geometry.js';
// eslint-disable-next-line import/no-unresolved
import tileStub from '../../fixtures/mbsv5-6-18-23.vector.pbf?arraybuffer';

// Load a line feature from fixture tile.
const vt = new VectorTile(new Protobuf(tileStub));

test('loadGeometry', () => {
    const feature = vt.layers.road.feature(0);
    const originalGeometry = feature.loadGeometry();
    const scaledGeometry = loadGeometry(feature);
    expect(scaledGeometry[0][0].x).toEqual(originalGeometry[0][0].x * 2);
    expect(scaledGeometry[0][0].y).toEqual(originalGeometry[0][0].y * 2);
});

test('loadGeometry warns and clamps when exceeding extent', () => {
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

    expect(numWarnings).toEqual(1);

    let maxValue = -Infinity;
    for (const line of lines) {
        for (const {x, y} of line) {
            maxValue = Math.max(x, y, maxValue);
        }
    }
    expect(maxValue).toEqual(16383);

    // Put it back
    console.warn = warn;
});
