'use strict';
var test = require('tape').test;
var shaping = require('../js/text/shaping.js');

test('shaping', function(t) {
    var oneEm = 24;
    var name = 'Arial';
    var stacks = { 'Arial': { glyphs: {
        32: { advance:20 },
        97: { advance:20 },
        98: { advance:20 },
        99: { advance:20 },
        100: { advance:20 },
        101: { advance:20 }
    }}};

    // Default shaping.
    t.deepEqual([
        { fontstack: 'Arial', glyph: 97, x: -50, y: 0 },
        { fontstack: 'Arial', glyph: 98, x: -30, y: 0 },
        { fontstack: 'Arial', glyph: 99, x: -10, y: 0 },
        { fontstack: 'Arial', glyph: 100, x: 10, y: 0 },
        { fontstack: 'Arial', glyph: 101, x: 30, y: 0 }
    ], shaping.shape('abcde', name, stacks, 15 * oneEm, oneEm, 0.5, 0 * oneEm)); 

    // Letter spacing.
    t.deepEqual([
        { fontstack: 'Arial', glyph: 97, x: -56, y: 0 },
        { fontstack: 'Arial', glyph: 98, x: -33, y: 0 },
        { fontstack: 'Arial', glyph: 99, x: -10, y: 0 },
        { fontstack: 'Arial', glyph: 100, x: 13, y: 0 },
        { fontstack: 'Arial', glyph: 101, x: 36, y: 0 }
    ], shaping.shape('abcde', name, stacks, 15 * oneEm, oneEm, 0.5, 0.125 * oneEm)); 

    // Line break.
    t.deepEqual([
        { fontstack: 'Arial', glyph: 97, x: -50, y: 0 },
        { fontstack: 'Arial', glyph: 98, x: -30, y: 0 },
        { fontstack: 'Arial', glyph: 99, x: -10, y: 0 },
        { fontstack: 'Arial', glyph: 100, x: 10, y: 0 },
        { fontstack: 'Arial', glyph: 101, x: 30, y: 0 },
        { fontstack: 'Arial', glyph: 32, x: 100, y: 0 },
        { fontstack: 'Arial', glyph: 97, x: -50, y: 24 },
        { fontstack: 'Arial', glyph: 98, x: -30, y: 24 },
        { fontstack: 'Arial', glyph: 99, x: -10, y: 24 },
        { fontstack: 'Arial', glyph: 100, x: 10, y: 24 },
        { fontstack: 'Arial', glyph: 101, x: 30, y: 24 }
    ], shaping.shape('abcde abcde', name, stacks, 4 * oneEm, oneEm, 0.5, 0 * oneEm)); 

    t.end();
});
