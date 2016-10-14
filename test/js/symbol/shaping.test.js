'use strict';

const test = require('mapbox-gl-js-test').test;
const fs = require('fs');
const path = require('path');
const shaping = require('../../../js/symbol/shaping');

let UPDATE = false;
if (typeof process !== 'undefined' && process.env !== undefined) {
    UPDATE = !!process.env.UPDATE;
}

test('shaping', function(t) {
    const oneEm = 24;
    const name = 'Test';
    const stacks = {
        'Test': JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')))
    };
    const glyphs = stacks[name];

    let shaped;

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

    const expectedNewLine = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json')));

    shaped = shaping.shapeText('abcde\nabcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, expectedNewLine);

    shaped = shaping.shapeText('abcde\r\nabcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0, [0, 0]);
    t.deepEqual(shaped.positionedGlyphs, expectedNewLine.positionedGlyphs);

    // Null shaping.
    shaped = shaping.shapeText('', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, shaped);

    shaped = shaping.shapeText(String.fromCharCode(0), glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, shaped);

    // https://github.com/mapbox/mapbox-gl-js/issues/3254
    shaped = shaping.shapeText('   foo bar\n', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    const shaped2 = shaping.shapeText('foo bar', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.same(shaped.positionedGlyphs, shaped2.positionedGlyphs);

    t.end();
});
