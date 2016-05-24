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
            {x:0,y:0}
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
            {x:0,y:0}
        ],
        [
            {x:60, y:0},
            {x:60, y:40},
            {x:100, y:40},
            {x:100, y:0},
            {x:60,y:0}
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

test('classifyRings + maxRings', function(assert) {
    var geometry;
    var classified;

    geometry = [
        [
            {x:0, y:0},
            {x:0, y:40},
            {x:40, y:40},
            {x:40, y:0},
            {x:0, y:0}
        ],
        [
            {x:30, y:30},
            {x:32, y:30},
            {x:32, y:32},
            {x:30, y:30}
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
    assert.equal(classified[0].length, 3, 'polygon 1 has 1 exterior, 2 interior');
    assert.equal(classified[0][0].area, -3200, 'polygon 1 exterior ring has area=-3200');
    assert.equal(classified[0][1].area, 4, 'polygon 1 interior ring1 has area=4');
    assert.equal(classified[0][2].area, 100, 'polygon 1 interior ring2 has area=100');

    classified = classifyRings(geometry, 2);
    assert.equal(classified.length, 1, '1 polygon');
    assert.equal(classified[0].length, 2, 'polygon 1 has 1 exterior, 1 interior');
    assert.equal(classified[0][0].area, -3200, 'polygon 1 exterior ring has area=-3200');
    assert.equal(classified[0][1].area, 100, 'polygon 1 interior ring has area=100');

    geometry = feature.loadGeometry();
    classified = classifyRings(geometry, 5);
    assert.equal(classified.length, 2, '2 polygons');
    assert.equal(classified[0].length, 1, 'polygon 1 has 1 exterior');
    assert.equal(classified[1].length, 5, 'polygon 2 has 1 exterior, 4 interior');

    assert.end();
});

