'use strict';

var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var Point = require('point-geometry');
var LineBucket = require('../../../js/data/bucket/line_bucket');
var StyleLayer = require('../../../js/style/style_layer');

// Load a line feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
var feature = vt.layers.road.feature(0);

test('LineBucket', function(t) {
    var layer = new StyleLayer({ id: 'test', type: 'line', layout: {} });
    var bucket = new LineBucket({
        buffers: {},
        layer: layer,
        childLayers: [layer]
    });
    bucket.createArrays();

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

    t.equal(bucket.addFeature(feature), undefined);

    t.end();
});
