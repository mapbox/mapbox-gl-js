'use strict';

var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var Protobuf = require('pbf');
var VectorTile = require('vector-tile').VectorTile;
var classifyRings = require('../../../js/util/classify_rings');

// Load a fill feature from fixture tile.
var vt = new VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
var feature = vt.layers.water.feature(0);

test('classifyRings', function(assert) {
    var geometry;
    var classified;

    geometry = [
        [
            {x:0, y:0},
            {x:0, y:40},
            {x:40, y:40},
            {x:40, y:0},
            {x:0, y:0}
        ]
    ];
    classified = classifyRings(geometry);
    assert.equal(classified.length, 1, '1 polygon');
    assert.equal(classified[0].length, 1, 'polygon 1 has 1 exterior');

    geometry = [
        [
            {x:0, y:0},
            {x:0, y:40},
            {x:40, y:40},
            {x:40, y:0},
            {x:0, y:0}
        ],
        [
            {x:60, y:0},
            {x:60, y:40},
            {x:100, y:40},
            {x:100, y:0},
            {x:60, y:0}
        ]
    ];
    classified = classifyRings(geometry);
    assert.equal(classified.length, 2, '2 polygons');
    assert.equal(classified[0].length, 1, 'polygon 1 has 1 exterior');
    assert.equal(classified[1].length, 1, 'polygon 2 has 1 exterior');

    geometry = [
        [
            {x:0, y:0},
            {x:0, y:40},
            {x:40, y:40},
            {x:40, y:0},
            {x:0, y:0}
        ],
        [
            {x:10, y:10},
            {x:20, y:10},
            {x:20, y:20},
            {x:10, y:10}
        ]
    ];
    classified = classifyRings(geometry);
    assert.equal(classified.length, 1, '1 polygon');
    assert.equal(classified[0].length, 2, 'polygon 1 has 1 exterior, 1 interior');

    geometry = feature.loadGeometry();
    classified = classifyRings(geometry);
    assert.equal(classified.length, 2, '2 polygons');
    assert.equal(classified[0].length, 1, 'polygon 1 has 1 exterior');
    assert.equal(classified[1].length, 10, 'polygon 2 has 1 exterior, 9 interior');

    assert.end();
});

test('classifyRings + maxRings', function(t) {

    function createGeometry(options) {
        var geometry = [
            // Outer ring, area = 3200
            [ {x:0, y:0}, {x:0, y:40}, {x:40, y:40}, {x:40, y:0}, {x:0, y:0} ],
            // Inner ring, area = 100
            [ {x:30, y:30}, {x:32, y:30}, {x:32, y:32}, {x:30, y:30} ],
            // Inner ring, area = 4
            [ {x:10, y:10}, {x:20, y:10}, {x:20, y:20}, {x:10, y:10} ]
        ];
        if (options && options.reverse) {
            geometry[0].reverse();
            geometry[1].reverse();
            geometry[2].reverse();
        }
        return geometry;
    }


    t.test('maxRings=undefined', function(t) {
        var geometry = sortRings(classifyRings(createGeometry()));
        t.equal(geometry.length, 1);
        t.equal(geometry[0].length, 3);
        t.equal(geometry[0][0].area, 3200);
        t.equal(geometry[0][1].area, 100);
        t.equal(geometry[0][2].area, 4);
        t.end();
    });

    t.test('maxRings=2', function(t) {
        var geometry = sortRings(classifyRings(createGeometry(), 2));
        t.equal(geometry.length, 1);
        t.equal(geometry[0].length, 2);
        t.equal(geometry[0][0].area, 3200);
        t.equal(geometry[0][1].area, 100);
        t.end();
    });

    t.test('maxRings=2, reversed geometry', function(t) {
        var geometry = sortRings(classifyRings(createGeometry({reverse: true}), 2));
        t.equal(geometry.length, 1);
        t.equal(geometry[0].length, 2);
        t.equal(geometry[0][0].area, 3200);
        t.equal(geometry[0][1].area, 100);
        t.end();
    });

    t.test('maxRings=5, geometry from fixture', function(t) {
        var geometry = sortRings(classifyRings(feature.loadGeometry(), 5));
        t.equal(geometry.length, 2);
        t.equal(geometry[0].length, 1);
        t.equal(geometry[1].length, 5);

        var areas = geometry[1].map(function(ring) { return ring.area; });
        t.deepEqual(areas, [2763951, 21600, 8298, 4758, 3411]);
        t.end();
    });

    t.end();
});

function sortRings(geometry) {
    for (var i = 0; i < geometry.length; i++) {
        geometry[i] = geometry[i].sort(compareAreas);
    }
    return geometry;
}

function compareAreas(a, b) {
    return b.area - a.area;
}
