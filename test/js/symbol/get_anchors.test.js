'use strict';

var test = require('tap').test;
var Point = require('point-geometry');
var getAnchors = require('../../../js/symbol/get_anchors');

var TILE_EXTENT = 4096;

test('getAnchors', function(t) {
    var nonContinuedLine = [];
    for (var i = 1; i < 11; i++) {
        nonContinuedLine.push(new Point(1, i));
    }

    var continuedLine = [];
    for (var j = 0; j < 10; j++) {
        continuedLine.push(new Point(1, j));
    }

    var smallSpacing = 2;
    var bigSpacing = 3;

    var shapedText = { left: -1, right: 1, top: -0.5, bottom: 0.5 };
    var shapedIcon = { left: -0.5, right: 0.5, top: -0.25, bottom: 0.25 };
    var labelLength = Math.max(
        shapedText ? shapedText.right - shapedText.left : 0,
        shapedIcon ? shapedIcon.right - shapedIcon.left : 0);

    var glyphSize = 0.1;

    test('non-continued line with short labels', function(t) {
        var anchors = getAnchors(nonContinuedLine, bigSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);

        t.deepEqual(anchors, [ { x: 1,
            y: 2,
            angle: 1.5707963267948966,
            segment: 1 },
            { x: 1,
                y: 5,
            angle: 1.5707963267948966,
            segment: 4 },
            { x: 1,
                y: 8,
            angle: 1.5707963267948966,
            segment: 7 } ]);

        t.ok(labelLength / 2 + 1 <= anchors[0].y && anchors[0].y < labelLength / 2 + 3 * glyphSize + 1,
                'first label is placed as close to the beginning as possible');

        t.end();
    });

    test('non-continued line with long labels', function(t) {
        var anchors = getAnchors(nonContinuedLine, smallSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);

        t.deepEqual(anchors, [ { x: 1,
            y: 2,
            angle: 1.5707963267948966,
            segment: 1 },
            { x: 1,
                y: 5,
            angle: 1.5707963267948966,
            segment: 3 },
            { x: 1,
                y: 7,
            angle: 1.5707963267948966,
            segment: 6 } ]);

        t.end();
    });

    test('continued line with short labels', function(t) {
        var anchors = getAnchors(continuedLine, bigSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);

        t.deepEqual(anchors, [ { x: 1,
            y: 2,
            angle: 1.5707963267948966,
            segment: 1 },
            { x: 1,
                y: 5,
            angle: 1.5707963267948966,
            segment: 4 },
            { x: 1,
                y: 8,
            angle: 1.5707963267948966,
            segment: 7 } ]);

        t.end();
    });

    test('continued line with long labels', function(t) {
        var anchors = getAnchors(continuedLine, smallSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);

        t.deepEqual(anchors, [ { x: 1,
            y: 1,
            angle: 1.5707963267948966,
            segment: 1 },
            { x: 1,
                y: 4,
            angle: 1.5707963267948966,
            segment: 3 },
            { x: 1,
                y: 6,
            angle: 1.5707963267948966,
            segment: 6 } ]);

        t.end();
    });

    test('overscaled anchors contain all anchors in parent', function(t) {
        var anchors = getAnchors(nonContinuedLine, bigSpacing, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);
        var childAnchors = getAnchors(nonContinuedLine, bigSpacing / 2, Math.PI, shapedText, shapedIcon, glyphSize, 0.5, 2, TILE_EXTENT);
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

    test('use middle point as a fallback position for short non-continued lines', function(t) {
        var line = [new Point(1, 1), new Point(1, 3.1)];
        var anchors = getAnchors(line, 2, Math.PI, shapedText, shapedIcon, glyphSize, 1, 1, TILE_EXTENT);
        t.deepEqual(anchors, [
            { x: 1,
            y: 2,
            angle: 1.5707963267948966,
            segment: 0 }]);
        t.end();
    });
    t.end();
});
