'use strict';

var test = require('tap').test;
var CollisionFeature = require('../../../js/symbol/collision_feature');
var Anchor = require('../../../js/symbol/anchor');
var Point = require('point-geometry');

test('CollisionFeature', function(t) {

    var shapedText = {
        left: -50,
        top: -10,
        right: 50,
        bottom: 10
    };

    var feature = {};
    var layerIDs = [];

    test('point label', function(t) {
        var point = new Point(500, 0);
        var anchor = new Anchor(point.x, point.y, 0, undefined);

        var cf = new CollisionFeature([point], anchor, feature, layerIDs, shapedText, 1, 0, false);
        t.equal(cf.boxes.length, 1);

        var box = cf.boxes[0];
        t.equal(box.x1, -50);
        t.equal(box.x2, 50);
        t.equal(box.y1, -10);
        t.equal(box.y2, 10);
        t.end();
    });

    test('line label', function(t) {
        var line = [new Point(0, 0), new Point(500, 100), new Point(510, 90), new Point(700, 0)];
        var anchor = new Anchor(505, 95, 0, 1);
        var cf = new CollisionFeature(line, anchor, feature, layerIDs, shapedText, 1, 0, true);
        var boxPoints = cf.boxes.map(pluckAnchorPoint);
        t.deepEqual(boxPoints, [
            { x: 467.71052542517856, y: 93.54210508503571 },
            { x: 477.51633218208775, y: 95.50326643641756 },
            { x: 487.32213893899694, y: 97.4644277877994 },
            { x: 497.12794569590613, y: 99.42558913918124 },
            { x: 505, y: 95 },
            { x: 512.6469868459704, y: 88.74616412559295 },
            { x: 521.6843652349058, y: 84.46530067820251 },
            { x: 530.7217436238412, y: 80.18443723081207 },
            { x: 539.7591220127766, y: 75.90357378342162 },
            { x: 548.7965004017119, y: 71.62271033603116 } ]);
        t.end();
    });

    test('vertical line label', function(t) {
        var line = [new Point(0, 0), new Point(0, 100), new Point(0, 111), new Point(0, 112), new Point(0, 200)];
        var anchor = new Anchor(0, 110, 0, 1);
        var cf = new CollisionFeature(line, anchor, feature, layerIDs, shapedText, 1, 0, true);
        var boxPoints = cf.boxes.map(pluckAnchorPoint);
        t.deepEqual(boxPoints, [
            { x: 0, y: 70 },
            { x: 0, y: 80 },
            { x: 0, y: 90 },
            { x: 0, y: 100 },
            { x: 0, y: 110 },
            { x: 0, y: 120 },
            { x: 0, y: 130 },
            { x: 0, y: 140 },
            { x: 0, y: 150 },
            { x: 0, y: 160 } ]);
        t.end();
    });

    test('doesnt create any boxes for features with zero height', function(t) {
        var shapedText = {
            left: -50,
            top: -10,
            right: 50,
            bottom: -10
        };

        var line = [new Point(0, 0), new Point(500, 100), new Point(510, 90), new Point(700, 0)];
        var anchor = new Anchor(505, 95, 0, 1);
        var cf = new CollisionFeature(line, anchor, feature, layerIDs, shapedText, 1, 0, true);
        t.equal(cf.boxes.length, 0);
        t.end();
    });

    test('doesnt create any boxes for features with negative height', function(t) {
        var shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: -10
        };

        var line = [new Point(0, 0), new Point(500, 100), new Point(510, 90), new Point(700, 0)];
        var anchor = new Anchor(505, 95, 0, 1);
        var cf = new CollisionFeature(line, anchor, feature, layerIDs, shapedText, 1, 0, true);
        t.equal(cf.boxes.length, 0);
        t.end();
    });

    test('doesnt create way too many tiny boxes for features with really low height', function(t) {
        var shapedText = {
            left: -50,
            top: 10,
            right: 50,
            bottom: 10.00001
        };

        var line = [new Point(0, 0), new Point(500, 100), new Point(510, 90), new Point(700, 0)];
        var anchor = new Anchor(505, 95, 0, 1);
        var cf = new CollisionFeature(line, anchor, feature, layerIDs, shapedText, 1, 0, true);
        t.ok(cf.boxes.length < 30);
        t.end();
    });

    test('height is big enough that first box can be placed *after* anchor', function(t) {
        var line = [new Point(3103, 4068), new Point(3225.6206896551726, 4096)];
        var anchor = new Anchor(3144.5959947505007, 4077.498298013894, 0.22449735614507618, 0);
        var shaping = { right: 256, left: 0, bottom: 256, top: 0 };
        var cf = new CollisionFeature(line, anchor, feature, layerIDs, shaping, 1, 0, true);
        t.equal(cf.boxes.length, 1);
        t.end();
    });

    t.end();
});

function pluckAnchorPoint(b) {
    return { x: b.anchorPoint.x, y: b.anchorPoint.y };
}
