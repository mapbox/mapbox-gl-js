'use strict';
var test = require('tape').test;

var fs = require('fs');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var PointBucket = require('../js/geometry/pointbucket.js');
var PointVertexBuffer = require('../js/geometry/pointvertexbuffer.js');
var Point = require('../js/geometry/point.js');

// Load a point feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(__dirname + '/fixtures/mbsv5-6-18-23.vector.pbf'))));
var feature = vt.layers.place_label.feature(0);

test('PointBucket', function(t) {
    var info = {};
    var buffers = { pointVertex: new PointVertexBuffer() };
    var bucket = new PointBucket(info, buffers);
    t.ok(bucket);

    var pointWithScale = new Point(0, 0);
    pointWithScale.scale = 10;

    t.equal(bucket.addPoints([
        new Point(0, 0),
        new Point(10, 10),
        pointWithScale
    ]), undefined);

    t.equal(bucket.addPoints([
        new Point(0, 0),
        new Point(10, 10)
    ], {
        zoom: 0,
        scale: 0,
        rotationRange: [0, 0]
    }), undefined);

    t.equal(bucket.addFeature(feature), undefined);

    t.end();
});

