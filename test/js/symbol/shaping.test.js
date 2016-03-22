'use strict';

var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var shaping = require('../../../js/symbol/shaping');

var UPDATE = false;
if (typeof process !== 'undefined' && process.env !== undefined) {
    UPDATE = !!process.env.UPDATE;
}

test('shaping', function(t) {
    var oneEm = 24;
    var name = 'Test';
    var stacks = {
        'Test': JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')))
    };
    var glyphs = stacks[name];

    var shaped;

    JSON.parse('{}');

    shaped = shaping.shapeText('hi' + String.fromCharCode(0), glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'))));

    // Default shaping.
    shaped = shaping.shapeText('abcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'))));

    // Letter spacing.
    shaped = shaping.shapeText('abcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0.125 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'))));

    // Line break.
    shaped = shaping.shapeText('abcde abcde', glyphs, 4 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-linebreak.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, require('../../expected/text-shaping-linebreak.json'));

    // Null shaping.
    shaped = shaping.shapeText('', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, shaped);

    shaped = shaping.shapeText(String.fromCharCode(0), glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, shaped);

    t.end();
});
