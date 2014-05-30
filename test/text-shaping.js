'use strict';
var test = require('tape').test;
var shaping = require('../js/text/shaping.js');
var fs = require('fs');
var UPDATE = process && process.env.UPDATE;

test('shaping', function(t) {
    var oneEm = 24;
    var name = 'Test';
    var stacks = {
        'Test': {
            glyphs: require('./fixtures/fontstack-glyphs.json')
        }
    };

    var shaped;

    // Default shaping.
    shaped = shaping.shape('abcde', name, stacks, 15 * oneEm, oneEm, 0.5, 0 * oneEm);
    if (UPDATE) fs.writeFileSync(__dirname + '/expected/text-shaping-default.json', JSON.stringify(shaped, null, 2));
    t.deepEqual(require('./expected/text-shaping-default.json'), shaped);

    // Letter spacing.
    shaped = shaping.shape('abcde', name, stacks, 15 * oneEm, oneEm, 0.5, 0.125 * oneEm);
    if (UPDATE) fs.writeFileSync(__dirname + '/expected/text-shaping-spacing.json', JSON.stringify(shaped, null, 2));
    t.deepEqual(require('./expected/text-shaping-spacing.json'), shaped);

    // Line break.
    shaped = shaping.shape('abcde abcde', name, stacks, 4 * oneEm, oneEm, 0.5, 0 * oneEm);
    if (UPDATE) fs.writeFileSync(__dirname + '/expected/text-shaping-linebreak.json', JSON.stringify(shaped, null, 2));
    t.deepEqual(require('./expected/text-shaping-linebreak.json'), shaped);

    t.end();
});
