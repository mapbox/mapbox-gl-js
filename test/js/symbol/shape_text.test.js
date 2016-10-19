'use strict';

var test = require('mapbox-gl-js-test').test;
var fs = require('fs');
var path = require('path');
var placeText = require('../../../js/symbol/shape_text');

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

    var shapedText;

    JSON.parse('{}');

    shapedText = placeText('hi' + String.fromCharCode(0), glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'), JSON.stringify(shapedText, null, 2));
    t.deepEqual(shapedText, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'))));

    // Default shaping.
    shapedText = placeText('abcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'), JSON.stringify(shapedText, null, 2));
    t.deepEqual(shapedText, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'))));

    // Letter spacing.
    shapedText = placeText('abcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0.125 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'), JSON.stringify(shapedText, null, 2));
    t.deepEqual(shapedText, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'))));

    // Line break.
    shapedText = placeText('abcde abcde', glyphs, 4 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-linebreak.json'), JSON.stringify(shapedText, null, 2));
    t.deepEqual(shapedText, require('../../expected/text-shaping-linebreak.json'));

    var expectedNewLine = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json')));

    shapedText = placeText('abcde\nabcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0, [0, 0]);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json'), JSON.stringify(shapedText, null, 2));
    t.deepEqual(shapedText, expectedNewLine);

    shapedText = placeText('abcde\r\nabcde', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0, [0, 0]);
    t.deepEqual(shapedText.shapedGlyphs, expectedNewLine.shapedGlyphs);

    // Null shaping.
    shapedText = placeText('', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, shapedText);

    shapedText = placeText(String.fromCharCode(0), glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.equal(false, shapedText);

    // https://github.com/mapbox/mapbox-gl-js/issues/3254
    shapedText = placeText('   foo bar\n', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    var shapedText2 = placeText('foo bar', glyphs, 15 * oneEm, oneEm, 0.5, 0.5, 0.5, 0 * oneEm, [0, 0]);
    t.same(shapedText.shapedGlyphs, shapedText2.shapedGlyphs);

    t.end();
});
