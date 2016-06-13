'use strict';

var test = require('tap').test;

var getIconQuads = require('../../../js/symbol/quads').getIconQuads;
var Anchor = require('../../../js/symbol/anchor');
var Point = require('point-geometry');

test('getIconQuads', function(t) {
    var layout = { 'icon-rotate': 0 };
    var fakeShapedIcon = {
        top: -5,
        bottom: 6,
        left: -7,
        right: 8,
        image: {
            pixelRatio: 1,
            rect: { w: 15, h: 11}
        }
    };

    t.test('point', function(t) {
        var anchor = new Anchor(2, 3, 0, undefined);
        t.deepEqual(getIconQuads(anchor, fakeShapedIcon, 2, [], layout, false), [
            {
                anchorPoint: { x: 2, y: 3 },
                tl: { x: -8, y: -6 },
                tr: { x: 7, y: -6 },
                bl: { x: -8, y: 5 },
                br: { x: 7, y: 5 },
                tex: { w: 15, h: 11 },
                anchorAngle: 0,
                glyphAngle: 0,
                minScale: 0.5,
                maxScale: Infinity } ]);
        t.end();
    });

    t.test('line', function(t) {
        var anchor = new Anchor(2, 3, 0, 0);
        t.deepEqual(getIconQuads(anchor, fakeShapedIcon, 2, [new Point(0, 0), new Point(8, 9)], layout, false), [
            {
                anchorPoint: { x: 2, y: 3},
                tl: { x: -8, y: -6 },
                tr: { x: 7, y: -6 },
                bl: { x: -8, y: 5 },
                br: { x: 7, y: 5 },
                tex: { w: 15, h: 11 },
                anchorAngle: 0,
                glyphAngle: 0,
                minScale: 0.5,
                maxScale: Infinity }]);
        t.end();
    });
    t.end();
});

test('getIconQuads text-fit', function(t) {
    var anchor = new Anchor(0, 0, 0, undefined);
    var fakeShapedIcon = {
        top: -10,
        bottom: 10,
        left: -10,
        right: 10,
        image: {
            pixelRatio: 1,
            rect: { w: 20, h: 20 }
        }
    };
    var fakeShapedText = {
        top: -10,
        bottom: 30,
        left: -60,
        right: 20
    };

    t.test('icon-text-fit: none', function(t) {
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'icon-text-fit': 'none'
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -11, y: -11 });
        t.deepEqual(quads[0].tr, { x: 9, y: -11 });
        t.deepEqual(quads[0].bl, { x: -11, y: 9 });
        t.deepEqual(quads[0].br, { x: 9, y: 9 });
        t.deepEqual(quads, getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'icon-text-fit': 'none',
            'icon-text-fit-padding': [10, 10]
        }, false, fakeShapedText), 'ignores padding');
        t.end();
    });

    t.test('icon-text-fit: width', function(t) {
        // - Uses text width
        // - Preserves icon height, centers vertically
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 24,
            'icon-text-fit': 'width',
            'icon-text-fit-padding': [ 0, 0, 0, 0 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -60, y: 0 });
        t.deepEqual(quads[0].tr, { x: 20, y: 0 });
        t.deepEqual(quads[0].bl, { x: -60, y: 20 });
        t.deepEqual(quads[0].br, { x: 20, y: 20 });
        t.end();
    });

    t.test('icon-text-fit: width, x textSize', function(t) {
        // - Uses text width (adjusted for textSize)
        // - Preserves icon height, centers vertically
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 12,
            'icon-text-fit': 'width',
            'icon-text-fit-padding': [ 0, 0, 0, 0 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -30, y: -5 });
        t.deepEqual(quads[0].tr, { x: 10, y: -5 });
        t.deepEqual(quads[0].bl, { x: -30, y: 15 });
        t.deepEqual(quads[0].br, { x: 10, y: 15 });
        t.end();
    });

    t.test('icon-text-fit: width, x textSize, + padding', function(t) {
        // - Uses text width (adjusted for textSize)
        // - Preserves icon height, centers vertically
        // - Applies padding x, padding y
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 12,
            'icon-text-fit': 'width',
            'icon-text-fit-padding': [ 5, 10, 5, 10 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -40, y: -10 });
        t.deepEqual(quads[0].tr, { x: 20, y: -10 });
        t.deepEqual(quads[0].bl, { x: -40, y: 20 });
        t.deepEqual(quads[0].br, { x: 20, y: 20 });
        t.end();
    });

    t.test('icon-text-fit: height', function(t) {
        // - Uses text height
        // - Preserves icon width, centers horizontally
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 24,
            'icon-text-fit': 'height',
            'icon-text-fit-padding': [ 0, 0, 0, 0 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -30, y: -10 });
        t.deepEqual(quads[0].tr, { x: -10, y: -10 });
        t.deepEqual(quads[0].bl, { x: -30, y: 30 });
        t.deepEqual(quads[0].br, { x: -10, y: 30 });
        t.end();
    });

    t.test('icon-text-fit: height, x textSize', function(t) {
        // - Uses text height (adjusted for textSize)
        // - Preserves icon width, centers horizontally
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 12,
            'icon-text-fit': 'height',
            'icon-text-fit-padding': [ 0, 0, 0, 0 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -20, y: -5 });
        t.deepEqual(quads[0].tr, { x: 0, y: -5 });
        t.deepEqual(quads[0].bl, { x: -20, y: 15 });
        t.deepEqual(quads[0].br, { x: 0, y: 15 });
        t.end();
    });

    t.test('icon-text-fit: height, x textSize, + padding', function(t) {
        // - Uses text height (adjusted for textSize)
        // - Preserves icon width, centers horizontally
        // - Applies padding x, padding y
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 12,
            'icon-text-fit': 'height',
            'icon-text-fit-padding': [ 5, 10, 5, 10 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -30, y: -10 });
        t.deepEqual(quads[0].tr, { x: 10, y: -10 });
        t.deepEqual(quads[0].bl, { x: -30, y: 20 });
        t.deepEqual(quads[0].br, { x: 10, y: 20 });
        t.end();
    });

    t.test('icon-text-fit: both', function(t) {
        // - Uses text width + height
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 24,
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [ 0, 0, 0, 0 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -60, y: -10 });
        t.deepEqual(quads[0].tr, { x: 20, y: -10 });
        t.deepEqual(quads[0].bl, { x: -60, y: 30 });
        t.deepEqual(quads[0].br, { x: 20, y: 30 });
        t.end();
    });

    t.test('icon-text-fit: both, x textSize', function(t) {
        // - Uses text width + height (adjusted for textSize)
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 12,
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [ 0, 0, 0, 0 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -30, y: -5 });
        t.deepEqual(quads[0].tr, { x: 10, y: -5 });
        t.deepEqual(quads[0].bl, { x: -30, y: 15 });
        t.deepEqual(quads[0].br, { x: 10, y: 15 });
        t.end();
    });

    t.test('icon-text-fit: both, x textSize, + padding', function(t) {
        // - Uses text width + height (adjusted for textSize)
        // - Applies padding x, padding y
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 12,
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [ 5, 10, 5, 10 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -40, y: -10 });
        t.deepEqual(quads[0].tr, { x: 20, y: -10 });
        t.deepEqual(quads[0].bl, { x: -40, y: 20 });
        t.deepEqual(quads[0].br, { x: 20, y: 20 });
        t.end();
    });

    t.test('icon-text-fit: both, padding t/r/b/l', function(t) {
        // - Uses text width + height (adjusted for textSize)
        // - Applies padding t/r/b/l
        var quads = getIconQuads(anchor, fakeShapedIcon, 2, [], {
            'text-size': 12,
            'icon-text-fit': 'both',
            'icon-text-fit-padding': [ 0, 5, 10, 15 ]
        }, false, fakeShapedText);
        t.deepEqual(quads[0].tl, { x: -45, y: -5 });
        t.deepEqual(quads[0].tr, { x: 15, y: -5 });
        t.deepEqual(quads[0].bl, { x: -45, y: 25 });
        t.deepEqual(quads[0].br, { x: 15, y: 25 });
        t.end();
    });

    t.end();
});

