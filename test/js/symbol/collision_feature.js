'use strict';

var test = require('tape');
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

    test('point label', function(t) {
        var point = new Point(500, 0);
        var anchor = new Anchor(point.x, point.y, 0, 0.5, undefined);

        var cf = new CollisionFeature([point], anchor, shapedText, 1, 0, false);
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
        var anchor = new Anchor(505, 95, 0, 0.5, 1);
        var cf = new CollisionFeature(line, anchor, shapedText, 1, 0, true);
        var boxPoints = cf.boxes.map(pluckAnchorPoint);
        t.deepEqual(boxPoints, [
            { x: 467.71052542517856, y: 93.54210508503571 },
            { x: 477.51633218208775, y: 95.50326643641756 },
            { x: 487.32213893899694, y: 97.4644277877994 },
            { x: 497.12794569590613, y: 99.42558913918124 },
            { x: 505, y: 95 },
            { x: 512.6469868459703, y: 88.74616412559298 },
            { x: 521.6843652349057, y: 84.46530067820254 },
            { x: 530.7217436238411, y: 80.1844372308121 },
            { x: 539.7591220127765, y: 75.90357378342165 },
            { x: 548.7965004017119, y: 71.62271033603119 } ]);
        t.end();
    });

    test('vertical line label', function(t) {
        var line = [new Point(0, 0), new Point(0, 100), new Point(0, 111), new Point(0, 112), new Point(0, 200)];
        var anchor = new Anchor(0, 110, 0, 0.5, 1);
        var cf = new CollisionFeature(line, anchor, shapedText, 1, 0, true);
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

    t.end();
});

function pluckAnchorPoint(b) {
    return { x: b.anchor.x, y: b.anchor.y };
}
