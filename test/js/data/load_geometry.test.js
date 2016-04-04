'use strict';

var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var loadGeometry = require('../../../js/data/load_geometry.js');

// Load a line feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));

test('loadGeometry', function(t) {
    var feature = vt.layers.road.feature(0);
    var originalGeometry = feature.loadGeometry();
    var scaledGeometry = loadGeometry(feature);
    t.equal(scaledGeometry[0][0].x, originalGeometry[0][0].x * 2, 'scales x coords by 2x');
    t.equal(scaledGeometry[0][0].y, originalGeometry[0][0].y * 2, 'scales y coords by 2x');
    t.end();
});

test('loadGeometry extent error', function(t) {
    var feature = vt.layers.road.feature(0);
    feature.extent = 2048;

    var numWarnings = 0;

    // Use a custom console.warn to count warnings
    var warn = console.warn;
    console.warn = function(warning) {
        if (warning.match(/Geometry exceeds allowed extent, reduce your vector tile buffer size/)) {
            numWarnings++;
        }
    };

    loadGeometry(feature);

    t.equal(numWarnings, 1);

    // Put it back
    console.warn = warn;

    t.end();
});

