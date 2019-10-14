import {test} from '../../util/test';
import fs from 'fs';
import path from 'path';
import * as shaping from '../../../src/symbol/shaping';
import Formatted, {FormattedSection} from '../../../src/style-spec/expression/types/formatted';
import ResolvedImage from '../../../src/style-spec/expression/types/resolved_image';
import {ImagePosition} from '../../../src/render/image_atlas';
const WritingMode = shaping.WritingMode;

let UPDATE = false;
if (typeof process !== 'undefined' && process.env !== undefined) {
    UPDATE = !!process.env.UPDATE;
}

test('shaping', (t) => {
    const oneEm = 24;
    const layoutTextSize = 16;
    const layoutTextSizeThisZoom = 16;
    const fontStack = 'Test';
    const glyphs = {
        'Test': JSON.parse(fs.readFileSync(path.join(__dirname, '/../../fixtures/fontstack-glyphs.json')))
    };
    const glyphPositions = glyphs;

    const images = {
        'square': new ImagePosition({x: 0, y: 0, w: 16, h: 16}, {pixelRatio: 1, version: 1}),
        'tall': new ImagePosition({x: 0, y: 0, w: 16, h: 32}, {pixelRatio: 1, version: 1}),
        'wide': new ImagePosition({x: 0, y: 0, w: 32, h: 16}, {pixelRatio: 1, version: 1}),
    };

    const sectionForImage = (name) => {
        return new FormattedSection('', ResolvedImage.fromString(name), null, null, null);
    };

    const sectionForText = (name, scale) => {
        return new FormattedSection(name, null, scale, null, null);
    };

    let shaped;

    JSON.parse('{}');

    shaped = shaping.shapeText(Formatted.fromString(`hi${String.fromCharCode(0)}`), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-null.json'))));

    // Default shaping.
    shaped = shaping.shapeText(Formatted.fromString('abcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-default.json'))));

    // Letter spacing.
    shaped = shaping.shapeText(Formatted.fromString('abcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0.125 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-spacing.json'))));

    // Line break.
    shaped = shaping.shapeText(Formatted.fromString('abcde abcde'), glyphs, glyphPositions, images, fontStack, 4 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-linebreak.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, require('../../expected/text-shaping-linebreak.json'));

    const expectedNewLine = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json')));

    shaped = shaping.shapeText(Formatted.fromString('abcde\nabcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-newline.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, expectedNewLine);

    shaped = shaping.shapeText(Formatted.fromString('abcde\r\nabcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    t.deepEqual(shaped.positionedLines, expectedNewLine.positionedLines);

    const expectedNewLinesInMiddle = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-newlines-in-middle.json')));

    shaped = shaping.shapeText(Formatted.fromString('abcde\n\nabcde'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-newlines-in-middle.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, expectedNewLinesInMiddle);

    // Prefer zero width spaces when breaking lines. Zero width spaces are used by Mapbox data sources as a hint that
    // a position is ideal for breaking.
    const expectedZeroWidthSpaceBreak = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-zero-width-space.json')));

    shaped = shaping.shapeText(Formatted.fromString('三三\u200b三三\u200b三三\u200b三三三三三三\u200b三三'), glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-zero-width-space.json'), JSON.stringify(shaped, null, 2));
    t.deepEqual(shaped, expectedZeroWidthSpaceBreak);

    // Null shaping.
    shaped = shaping.shapeText(Formatted.fromString(''), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    t.equal(false, shaped);

    shaped = shaping.shapeText(Formatted.fromString(String.fromCharCode(0)), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    t.equal(false, shaped);

    // https://github.com/mapbox/mapbox-gl-js/issues/3254
    shaped = shaping.shapeText(Formatted.fromString('   foo bar\n'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    const shaped2 = shaping.shapeText(Formatted.fromString('foo bar'), glyphs, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
    t.same(shaped.positionedLines, shaped2.positionedLines);

    t.test('basic image shaping', (t) => {
        const shaped = shaping.shapeText(new Formatted([sectionForImage('square')]), glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
        t.same(shaped.top, -12);    // 1em line height
        t.same(shaped.left, -10.5); // 16 - 2px border * 1.5 scale factor
        t.end();
    });

    t.test('images in horizontal layout', (t) => {
        const expectedImagesHorizontal = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-images-horizontal.json')));
        const horizontalFormatted = new Formatted([
            sectionForText('Foo'),
            sectionForImage('square'),
            sectionForImage('wide'),
            sectionForText('\n'),
            sectionForImage('tall'),
            sectionForImage('square'),
            sectionForText(' bar'),
        ]);
        const shaped = shaping.shapeText(horizontalFormatted, glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, 'point', layoutTextSize, layoutTextSizeThisZoom);
        if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-images-horizontal.json'), JSON.stringify(shaped, null, 2));
        t.deepEqual(shaped, expectedImagesHorizontal);
        t.end();
    });

    t.test('images in vertical layout', (t) => {
        const expectedImagesVertical = JSON.parse(fs.readFileSync(path.join(__dirname, '/../../expected/text-shaping-images-vertical.json')));
        const horizontalFormatted = new Formatted([
            sectionForText('三'),
            sectionForImage('square'),
            sectionForImage('wide'),
            sectionForText('\u200b'),
            sectionForImage('tall'),
            sectionForImage('square'),
            sectionForText('三'),
        ]);
        const shaped = shaping.shapeText(horizontalFormatted, glyphs, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.vertical, true, 'point', layoutTextSize, layoutTextSizeThisZoom);
        if (UPDATE) fs.writeFileSync(path.join(__dirname, '/../../expected/text-shaping-images-vertical.json'), JSON.stringify(shaped, null, 2));
        t.deepEqual(shaped, expectedImagesVertical);
        t.end();
    });

    t.end();
});

test('shapeIcon', (t) => {
    const imagePosition = new ImagePosition({x: 0, y: 0, w: 22, h: 22}, {pixelRatio: 1, version: 1});
    const image = Object.freeze({
        paddedRect: Object.freeze({x: 0, y: 0, w: 22, h: 22}),
        pixelRatio: 1,
        version: 1
    });

    t.test('text-anchor: center', (t) => {
        t.deepEqual(shaping.shapeIcon(imagePosition, [ 0, 0 ], 'center'), {
            top: -10,
            bottom: 10,
            left: -10,
            right: 10,
            image
        }, 'no offset');

        t.deepEqual(shaping.shapeIcon(imagePosition, [ 4, 7 ], 'center'), {
            top: -3,
            bottom: 17,
            left: -6,
            right: 14,
            image
        }, 'with offset');
        t.end();
    });

    t.test('text-anchor: left', (t) => {
        t.deepEqual(shaping.shapeIcon(imagePosition, [ 0, 0 ], 'left'), {
            top: -10,
            bottom: 10,
            left: 0,
            right: 20,
            image
        }, 'no offset');

        t.deepEqual(shaping.shapeIcon(imagePosition, [ 4, 7 ], 'left'), {
            top: -3,
            bottom: 17,
            left: 4,
            right: 24,
            image
        }, 'with offset');
        t.end();
    });

    t.test('text-anchor: bottom-right', (t) => {
        t.deepEqual(shaping.shapeIcon(imagePosition, [ 0, 0 ], 'bottom-right'), {
            top: -20,
            bottom: 0,
            left: -20,
            right: 0,
            image
        }, 'no offset');

        t.deepEqual(shaping.shapeIcon(imagePosition, [ 4, 7 ], 'bottom-right'), {
            top: -13,
            bottom: 7,
            left: -16,
            right: 4,
            image
        }, 'with offset');
        t.end();
    });

    t.end();
});

test('fitIconToText', (t) => {
    const glyphSize = 24;
    const shapedIcon = Object.freeze({
        top: -10,
        bottom: 10,
        left: -10,
        right: 10,
        image: Object.freeze({
            pixelRatio: 1,
            displaySize: [ 20, 20 ],
            paddedRect: Object.freeze({x: 0, y: 0, w: 22, h: 22})
        })
    });

    const shapedText = Object.freeze({
        top: -10,
        bottom: 30,
        left: -60,
        right: 20
    });

    t.test('icon-text-fit: width', (t) => {
        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [0, 0], 24 / glyphSize), {
            image: shapedIcon.image,
            top: 0,
            right: 20,
            bottom: 20,
            left: -60
        }, 'preserves icon height, centers vertically');

        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [3, 7], 24 / glyphSize), {
            image: shapedIcon.image,
            top: 7,
            right: 23,
            bottom: 27,
            left: -57
        }, 'preserves icon height, centers vertically, applies offset');

        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [0, 0], 12 / glyphSize), {
            image: shapedIcon.image,
            top: -5,
            right: 10,
            bottom: 15,
            left: -30
        }, 'preserves icon height, centers vertically, adjusts for textSize');

        // Ignores padding for top/bottom, since the icon is only stretched to the text's width but not height
        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'width', [ 5, 10, 5, 10 ], [0, 0], 12 / glyphSize), {
            image: shapedIcon.image,
            top: -5,
            right: 20,
            bottom: 15,
            left: -40
        }, 'preserves icon height, centers vertically, adjusts for textSize, includes padding');

        t.end();
    });

    t.test('icon-text-fit: height', (t) => {
        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [0, 0], 24 / glyphSize), {
            image: shapedIcon.image,
            top: -10,
            right: -10,
            bottom: 30,
            left: -30
        }, 'preserves icon width, centers horizontally');

        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [3, 7], 24 / glyphSize), {
            image: shapedIcon.image,
            top: -3,
            right: -7,
            bottom: 37,
            left: -27
        }, 'preserves icon width, centers horizontally, applies offset');

        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [0, 0], 12 / glyphSize), {
            image: shapedIcon.image,
            top: -5,
            right: 0,
            bottom: 15,
            left: -20
        }, 'preserves icon width, centers horizontally, adjusts for textSize');

        // Ignores padding for left/right, since the icon is only stretched to the text's height but not width
        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'height', [ 5, 10, 5, 10 ], [0, 0], 12 / glyphSize), {
            image: shapedIcon.image,
            top: -10,
            right: 0,
            bottom: 20,
            left: -20
        }, 'preserves icon width, centers horizontally, adjusts for textSize, includes padding');

        t.end();
    });

    t.test('icon-text-fit: both', (t) => {
        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [0, 0], 24 / glyphSize), {
            image: shapedIcon.image,
            top: -10,
            right: 20,
            bottom: 30,
            left: -60
        }, 'stretches icon to text width and height');

        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [3, 7], 24 / glyphSize), {
            image: shapedIcon.image,
            top: -3,
            right: 23,
            bottom: 37,
            left: -57
        }, 'stretches icon to text width and height, applies offset');

        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [0, 0], 12 / glyphSize), {
            image: shapedIcon.image,
            top: -5,
            right: 10,
            bottom: 15,
            left: -30
        }, 'stretches icon to text width and height, adjusts for textSize');

        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'both', [ 5, 10, 5, 10 ], [0, 0], 12 / glyphSize), {
            image: shapedIcon.image,
            top: -10,
            right: 20,
            bottom: 20,
            left: -40
        }, 'stretches icon to text width and height, adjusts for textSize, includes padding');

        t.deepEqual(shaping.fitIconToText(shapedIcon, shapedText, 'both', [ 0, 5, 10, 15 ], [0, 0], 12 / glyphSize), {
            image: shapedIcon.image,
            top: -5,
            right: 15,
            bottom: 25,
            left: -45
        }, 'stretches icon to text width and height, adjusts for textSize, includes padding t/r/b/l');

        t.end();
    });

    t.end();
});
