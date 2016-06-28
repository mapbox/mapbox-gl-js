'use strict';

var test = require('tap').test;
var fs = require('fs');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var Point = require('point-geometry');
var FillBucket = require('../../../js/data/bucket/fill_bucket');
var path = require('path');
var StyleLayer = require('../../../js/style/style_layer');

// Load a fill feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
var feature = vt.layers.water.feature(0);

function createFeature(points) {
    return {
        loadGeometry: function() {
            return [points];
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

    t.equal(bucket.addFeature(createFeature([
        new Point(0, 0),
        new Point(10, 10)
    ])), undefined);

    t.equal(bucket.addFeature(createFeature([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ])), undefined);

    t.equal(bucket.addFeature(feature), undefined);

    // Put it back.
    console.warn = warn;

    t.end();
});

test('FillBucket - feature split across array groups', function (t) {
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

    // add an initial feature
    bucket.addFeature(createBigFeature(32768));
    // now add a feature that will break across the group boundary
    bucket.addFeature(createBigFeature(32768 + 1));

    // check that every vertex's color values match the first vertex
    var groups = bucket.arrayGroups.fill;
    var expected = groups[0].paint.test.get(0);
    expected = [
        expected['a_color0'],
        expected['a_color1'],
        expected['a_color2'],
        expected['a_color3']
    ];

    for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        for (var i = 0; i < group.paint.test.length; i++) {
            var vertex = group.paint.test.get(i);
            var color = [
                vertex['a_color0'],
                vertex['a_color1'],
                vertex['a_color2'],
                vertex['a_color3']
            ];

            // do this instead of t.deepEqual so as not to pollute test output
            // with > 65536 assertions
            if (expected.join(',') !== color.join(',')) {
                t.fail('Vertex ' + i + ' does not match first vertex; found ' + color + ', but expected ' + expected);
                t.end();
                return;
            }
        }
    }

    t.end();


});

function createBigFeature (numPoints) {
    var points = [];
    for (var i = 0; i < numPoints; i++) {
        points.push(new Point(10 * Math.sin(i / numPoints), 10 * Math.cos(i / numPoints)));
    }
    return createFeature(points);
}
