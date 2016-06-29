'use strict';

var test = require('tap').test;
var fs = require('fs');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var Point = require('point-geometry');
var Bucket = require('../../../js/data/bucket');
var FillBucket = require('../../../js/data/bucket/fill_bucket');
var path = require('path');
var StyleLayer = require('../../../js/style/style_layer');

// Load a fill feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
var feature = vt.layers.water.feature(0);

function createFeature(points) {
    return {
        loadGeometry: function() {
            return points;
        }
    };
}

test('FillBucket', function(t) {
    // Suppress console.warn output.
    var warn = console.warn;
    console.warn = function() {};

    var layer = new StyleLayer({ id: 'test', type: 'fill', layout: {} });
    var bucket = new FillBucket({
        buffers: {},
        layer: layer,
        childLayers: [layer]
    });
    bucket.createArrays();

    t.equal(bucket.addFeature(createFeature([[
        new Point(0, 0),
        new Point(10, 10)
    ]])), undefined);

    t.equal(bucket.addFeature(createFeature([[
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ]])), undefined);

    t.equal(bucket.addFeature(feature), undefined);

    // Put it back.
    console.warn = warn;

    t.end();
});

test('FillBucket - feature split across array groups', function (t) {
    // temporarily reduce the max array length so we can test features
    // breaking across array groups without tests taking a _long_ time.
    var prevMaxArrayLength = Bucket.MAX_VERTEX_ARRAY_LENGTH;
    Bucket.MAX_VERTEX_ARRAY_LENGTH = 1023;

    var layer = new StyleLayer({
        id: 'test',
        type: 'fill',
        layout: {},
        paint: { 'fill-color': {
            stops: [[0, 'red'], [1, 'blue']],
            property: 'foo'
        } }
    });

    // this, plus the style function, sets things up so that
    // populatePaintArrays iterates through each vertex
    layer.updatePaintTransition('fill-color', [], {});

    var bucket = new FillBucket({
        buffers: {},
        layer: layer,
        childLayers: [layer]
    });
    bucket.createArrays();


    // first add an initial, small feature to make sure the next one starts at
    // a non-zero offset
    bucket.addFeature(createFeature([createPolygon(10)]));

    // add a feature that will break across the group boundary (65536)
    bucket.addFeature(createFeature([
        Bucket.MAX_VERTEX_ARRAY_LENGTH - 20, // the first polygon fits within the bucket
        20 // but the second one breaks across the boundary.
    ].map(createPolygon)));

    var groups = bucket.arrayGroups.fill;

    // check array group lengths
    // FillBucket#addPolygon does NOT allow a single polygon to break across
    // group boundary, so we expect the first group to include the first
    // feature and the first polygon of the second feature, and the second
    // group to include the _entire_ second polygon of the second feature.
    var expectedLengths = [
        10 + (Bucket.MAX_VERTEX_ARRAY_LENGTH - 20),
        20
    ];
    t.equal(groups[0].paint.test.length, expectedLengths[0], 'group 0 length, paint');
    t.equal(groups[0].layout.vertex.length, expectedLengths[0], 'group 0 length, layout');
    t.equal(groups[1].paint.test.length, expectedLengths[1], 'group 1 length, paint');
    t.equal(groups[1].layout.vertex.length, expectedLengths[1], 'group 1 length, layout');

    // check that every vertex's color values match the first vertex
    var expected = [0, 0, 255, 255];
    t.same(getVertexColor(0, 0), expected, 'first vertex');
    t.same(getVertexColor(0, expectedLengths[0] - 1), expected, 'last vertex of first group');
    t.same(getVertexColor(1, 0), expected, 'first vertex of second group');
    t.same(getVertexColor(1, expectedLengths[1] - 1), expected, 'last vertex');

    function getVertexColor(g, i) {
        var vertex = groups[g].paint.test.get(i);
        return [
            vertex['a_color0'],
            vertex['a_color1'],
            vertex['a_color2'],
            vertex['a_color3']
        ];
    }

    // restore
    Bucket.MAX_VERTEX_ARRAY_LENGTH = prevMaxArrayLength;

    t.end();
});

function createPolygon (numPoints) {
    var points = [];
    for (var i = 0; i < numPoints; i++) {
        points.push(new Point(i / numPoints, i / numPoints));
    }
    return points;
}
