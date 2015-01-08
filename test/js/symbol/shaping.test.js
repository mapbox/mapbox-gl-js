'use strict';

var test = require('tape');
var fs = require('fs');

require('../../bootstrap');

var shaping = require('../../../js/symbol/shaping');

var UPDATE = false;
if (typeof process !== 'undefined' && process.env !== undefined) {
    var UPDATE = !!process.env.UPDATE;
}

test('shaping', function(t) {
    var oneEm = 24;
    var name = 'Test';
    var stacks = {
        'Test': {
            glyphs: JSON.parse(fs.readFileSync(__dirname + '/../../fixtures/fontstack-glyphs.json'))
        }
    };

    var shaped;

    JSON.parse('{}');

    shaped = shaping.shape('hi' + String.fromCharCode(0), name, stacks, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/text-shaping-null.json', JSON.stringify(shaped, null, 2));
    t.deepEqual(JSON.parse(fs.readFileSync(__dirname + '/../../expected/text-shaping-null.json')), shaped);

    // Default shaping.
    shaped = shaping.shape('abcde', name, stacks, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/text-shaping-default.json', JSON.stringify(shaped, null, 2));
    t.deepEqual(JSON.parse(fs.readFileSync(__dirname + '/../../expected/text-shaping-default.json')), shaped);

    // Letter spacing.
    shaped = shaping.shape('abcde', name, stacks, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0.125 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/text-shaping-spacing.json', JSON.stringify(shaped, null, 2));
    t.deepEqual(JSON.parse(fs.readFileSync(__dirname + '/../../expected/text-shaping-spacing.json')), shaped);

    // Line break.
    shaped = shaping.shape('abcde abcde', name, stacks, 4 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(__dirname + '/../../expected/text-shaping-linebreak.json', JSON.stringify(shaped, null, 2));
    t.deepEqual(require('../../expected/text-shaping-linebreak.json'), shaped);

    // Null shaping.
    shaped = shaping.shape('', name, stacks, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, shaped);

    shaped = shaping.shape(String.fromCharCode(0), name, stacks, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, shaped);

    t.end();
});
