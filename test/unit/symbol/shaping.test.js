import {test} from '../../util/test';
import fs from 'fs';
import path from 'path';
import * as shaping from '../../../src/symbol/shaping';
import Formatted from '../../../src/style-spec/expression/types/formatted';
const WritingMode = shaping.WritingMode;

let UPDATE = false;
if (typeof process !== 'undefined' && process.env !== undefined) {
    UPDATE = !!process.env.UPDATE;
}

test('shaping', (t) => {
    const oneEm = 24;
    const fontStack = 'Test';
    const glyphs = {
        'Test': JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')))
    };

    let shaped;

    JSON.parse('{}');

    shaped = shaping.shapeText(Formatted.fromString(`hi${String.fromCharCode(0)}`), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'))));

    // Default shaping.
    shaped = shaping.shapeText(Formatted.fromString('abcde'), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'))));

    // Letter spacing.
    shaped = shaping.shapeText(Formatted.fromString('abcde'), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0.125 * oneEm, [0, 0], WritingMode.horizontal);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'))));

    // Line break.
    shaped = shaping.shapeText(Formatted.fromString('abcde abcde'), glyphs, fontStack, 4 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-linebreak.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, require('../../expected/text-shaping-linebreak.json'));

    const expectedNewLine = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json')));

    shaped = shaping.shapeText(Formatted.fromString('abcde\nabcde'), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, expectedNewLine);

    shaped = shaping.shapeText(Formatted.fromString('abcde\r\nabcde'), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal);
    t.deepEqual(shaped.positionedGlyphs, expectedNewLine.positionedGlyphs);

    const expectedNewLinesInMiddle = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-newlines-in-middle.json')));

    shaped = shaping.shapeText(Formatted.fromString('abcde\n\nabcde'), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-newlines-in-middle.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, expectedNewLinesInMiddle);

    // Prefer zero width spaces when breaking lines. Zero width spaces are used by Mapbox data sources as a hint that
    // a position is ideal for breaking.
    const expectedZeroWidthSpaceBreak = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-zero-width-space.json')));

    shaped = shaping.shapeText(Formatted.fromString('三三\u200b三三\u200b三三\u200b三三三三三三\u200b三三'), glyphs, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-zero-width-space.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, expectedZeroWidthSpaceBreak);

    // Null shaping.
    shaped = shaping.shapeText(Formatted.fromString(''), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal);
    t.equal(false, shaped);

    shaped = shaping.shapeText(Formatted.fromString(String.fromCharCode(0)), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal);
    t.equal(false, shaped);

    // https://github.com/mapbox/mapbox-gl-js/issues/3254
    shaped = shaping.shapeText(Formatted.fromString('   foo bar\n'), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal);
    const shaped2 = shaping.shapeText(Formatted.fromString('foo bar'), glyphs, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal);
    t.same(shaped.positionedGlyphs, shaped2.positionedGlyphs);

    t.end();
});
