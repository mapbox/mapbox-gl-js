'use strict';

var test = require('prova');
var Point = require('point-geometry');
var getAnchors = require('../../../js/symbol/get_anchors');

test('getAnchors', function(t) {
    var points = [];
    for (var i = 0; i < 10; i++) {
        points.push(new Point(0, i));
    }

    var shapedText = { left: -1, right: 1, top: -0.5, bottom: 0.5 };
    var labelLength = shapedText.right - shapedText.left;

    var glyphSize = 0.1;
    var anchors = getAnchors(points, 2, Math.PI, shapedText, glyphSize, 1, 1);

    t.deepEqual(anchors, [ { x: 0,
        y: 1.2,
        angle: 1.5707963267948966,
        segment: 1 },
        { x: 0,
            y: 3.2,
        angle: 1.5707963267948966,
        segment: 3 },
        { x: 0,
            y: 5.2,
        angle: 1.5707963267948966,
        segment: 5 },
        { x: 0,
            y: 7.2,
        angle: 1.5707963267948966,
        segment: 7 } ]);

    t.ok(labelLength / 2 < anchors[0].y && anchors[0].y < labelLength / 2 + 3 * glyphSize,
            'first label is placed as close to the beginning as possible');

    test('overscaled anchors contain all anchors in parent', function(t) {
        var childAnchors = getAnchors(points, 2 / 2, Math.PI, shapedText, glyphSize, 0.5, 2);
        for (var i = 0; i < anchors.length; i++) {
            var anchor = anchors[i];
            var found = false;
            for (var k = 0; k < childAnchors.length; k++) {
                if (anchor.equals(childAnchors[k])) {
                    found = true;
                    break;
                }
            }
            t.ok(found);
        }
        t.pass();
        t.end();
    });

    test('use middle point as a fallback position for short lines', function(t) {
        var line = [new Point(0, 0), new Point(0, 2.1)];
        var anchors = getAnchors(line, 2, Math.PI, shapedText, glyphSize, 1, 1);
        t.deepEqual(anchors, [
            { x: 0,
            y: 1.05,
            angle: 1.5707963267948966,
            segment: 0 }]);
        t.end();
    });
    t.end();
});
