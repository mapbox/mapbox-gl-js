'use strict';

var test = require('prova');
var fs = require('fs');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var Point = require('point-geometry');
var FillBucket = require('../../../js/data/bucket/fill_bucket');
var path = require('path');

// Load a fill feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
var feature = vt.layers.water.feature(0);

test('FillBucket', function(t) {
    // Suppress console.warn output.
    var warn = console.warn;
    console.warn = function() {};

    var bucket = new FillBucket({
        buffers: {},
        layer: { id: 'test', type: 'fill', layout: {} }
    });
    bucket.createBuffers();

    t.equal(bucket.addFill([
        new Point(0, 0),
        new Point(10, 10)
    ]), undefined);

    t.equal(bucket.addFill([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ]), undefined);

    t.equal(bucket.addFeature(feature), undefined);

    // Put it back.
    console.warn = warn;

    t.end();
});
