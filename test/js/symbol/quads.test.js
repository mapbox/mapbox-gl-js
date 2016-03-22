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
                angle: 0,
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
                angle: 0,
                minScale: 0.5,
                maxScale: Infinity }]);
        t.end();
    });
    t.end();
});
