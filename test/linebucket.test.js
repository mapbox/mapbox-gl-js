'use strict';
var test = require('tape').test;

var fs = require('fs');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var LineBucket = require('../js/geometry/linebucket.js');
var LineVertexBuffer = require('../js/geometry/linevertexbuffer.js');
var LineElementBuffer = require('../js/geometry/lineelementbuffer.js');
var Point = require('point-geometry');

// Load a line feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(__dirname + '/fixtures/mbsv5-6-18-23.vector.pbf'))));
var feature = vt.layers.road.feature(0);

test('LineBucket', function(t) {
    var info = {};
    var buffers = {
        lineVertex: new LineVertexBuffer(),
        lineElement: new LineElementBuffer()
    };
    var bucket = new LineBucket(info, buffers);
    t.ok(bucket);

    var pointWithScale = new Point(0, 0);
    pointWithScale.scale = 10;

    // should throw in the future?
    t.equal(bucket.addLine([
        new Point(0, 0)
    ]), undefined);

    // should also throw in the future?
    // this is a closed single-segment line
    t.equal(bucket.addLine([
        new Point(0, 0),
        new Point(0, 0)
    ]), undefined);

    t.equal(bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ]), undefined);

    t.equal(bucket.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20),
        new Point(0, 0)
    ]), undefined);

    t.equal(bucket.addFeature(feature.loadGeometry()), undefined);

    t.end();
});

