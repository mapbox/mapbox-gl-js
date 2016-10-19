'use strict';

var test = require('mapbox-gl-js-test').test;
var fs = require('fs');
var path = require('path');
var placeText = require('../../../js/symbol/place_text');

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

    var placedText;

    JSON.parse('{}');

    placedText = placeText('hi' + String.fromCharCode(0), glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'), JSON.stringify(placedText, null, 2));
    t.deepEqual(placedText, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'))));

    // Default shaping.
    placedText = placeText('abcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'), JSON.stringify(placedText, null, 2));
    t.deepEqual(placedText, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'))));

    // Letter spacing.
    placedText = placeText('abcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0.125 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'), JSON.stringify(placedText, null, 2));
    t.deepEqual(placedText, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'))));

    // Line break.
    placedText = placeText('abcde abcde', glyphs, 4 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-linebreak.json'), JSON.stringify(placedText, null, 2));
    t.deepEqual(placedText, require('../../expected/text-shaping-linebreak.json'));

    var expectedNewLine = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json')));

    placedText = placeText('abcde\nabcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json'), JSON.stringify(placedText, null, 2));
    t.deepEqual(placedText, expectedNewLine);

    placedText = placeText('abcde\r\nabcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0, [0, 0]);
    t.deepEqual(placedText.placedGlyphs, expectedNewLine.placedGlyphs);

    // Null shaping.
    placedText = placeText('', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, placedText);

    placedText = placeText(String.fromCharCode(0), glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, placedText);

    // https://github.com/mapbox/mapbox-gl-js/issues/3254
    placedText = placeText('   foo bar\n', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    var placedText2 = placeText('foo bar', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.same(placedText.placedGlyphs, placedText2.placedGlyphs);

    t.end();
});
