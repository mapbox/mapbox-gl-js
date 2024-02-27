import {describe, test, expect} from "../../util/vitest.js";
import * as shaping from '../../../src/symbol/shaping.js';
import Formatted, {FormattedSection} from '../../../src/style-spec/expression/types/formatted.js';
import ResolvedImage from '../../../src/style-spec/expression/types/resolved_image.js';
import {ImagePosition} from '../../../src/render/image_atlas.js';
import fontstackGlyphs from '../../fixtures/fontstack-glyphs.json';

const WritingMode = shaping.WritingMode;

describe('shaping', () => {
    const oneEm = 24;
    const layoutTextSize = 16;
    const layoutTextSizeThisZoom = 16;
    const fontStack = 'Test';
    const glyphMap = {
        'Test': fontstackGlyphs
    };

    const glyphPositions = {'Test' : {}};
    const glyphPositonMap = glyphPositions['Test'];
    const glyphData = glyphMap['Test'].glyphs;
    for (const id in glyphData) {
        glyphPositonMap[id] = glyphData[id].rect;
    }

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

    const basePath = '../../fixtures/expected';

    test('Text shaping null', () => {
        const shaped = shaping.shapeText(Formatted.fromString(`hi${String.fromCharCode(0)}`), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-null.json`);
    });

    // Default shaping.
    test('Default shaping', () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-default.json`);
    });

    test('Letter spacing', () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0.125 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-spacing.json`);
    });

    test('Line break', () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde abcde'), glyphMap, glyphPositions, images, fontStack, 4 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-linebreak.json`);
    });

    test('New line', () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde\nabcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-newline.json`);
    });

    test('New line with carriage return', () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde\r\nabcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-newline-carriege.json`);
    });

    test('New lines in the middle', () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde\n\nabcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-newlines-in-middle.json`);
    });

    test('Zero width space', () => {
        const shaped = shaping.shapeText(Formatted.fromString('三三\u200b三三\u200b三三\u200b三三三三三三\u200b三三'), glyphMap, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-zero-width-space.json`);
    });

    test('Null shaping', () => {
        let shaped;

        // Null shaping.
        shaped = shaping.shapeText(Formatted.fromString(''), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(false).toEqual(shaped);

        shaped = shaping.shapeText(Formatted.fromString(String.fromCharCode(0)), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(false).toEqual(shaped);
    });

    test('mapbox-gl-js#3254', () => {
        const shaped = shaping.shapeText(Formatted.fromString('   foo bar\n'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        const shaped2 = shaping.shapeText(Formatted.fromString('foo bar'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(shaped.positionedLines).toStrictEqual(shaped2.positionedLines);
    });

    test('basic image shaping', () => {
        const shaped = shaping.shapeText(new Formatted([sectionForImage('square')]), glyphMap, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(shaped.top).toBe(-12);    // 1em line height
        expect(shaped.left).toBe(-10.5); // 16 - 2px border * 1.5 scale factor
    });

    test('images in horizontal layout', () => {
        const horizontalFormatted = new Formatted([
            sectionForText('Foo'),
            sectionForImage('square'),
            sectionForImage('wide'),
            sectionForText('\n'),
            sectionForImage('tall'),
            sectionForImage('square'),
            sectionForText(' bar'),
        ]);
        const shaped = shaping.shapeText(horizontalFormatted, glyphMap, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-images-horizontal.json`);
    });

    test('images in vertical layout', () => {
        const horizontalFormatted = new Formatted([
            sectionForText('三'),
            sectionForImage('square'),
            sectionForImage('wide'),
            sectionForText('\u200b'),
            sectionForImage('tall'),
            sectionForImage('square'),
            sectionForText('三'),
        ]);
        const shaped = shaping.shapeText(horizontalFormatted, glyphMap, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.vertical, true, layoutTextSize, layoutTextSizeThisZoom);
        expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-images-vertical.json`);
    });
});

describe('shapeIcon', () => {
    const imagePosition = new ImagePosition({x: 0, y: 0, w: 22, h: 22}, {pixelRatio: 1, version: 1});
    const imagePrimary = Object.freeze({
        content: undefined,
        stretchX: undefined,
        stretchY: undefined,
        paddedRect: Object.freeze({x: 0, y: 0, w: 22, h: 22}),
        pixelRatio: 1,
        version: 1
    });

    test('text-anchor: center', () => {
        expect(shaping.shapeIcon(imagePosition, undefined, [ 0, 0 ], 'center')).toEqual({
            top: -10,
            bottom: 10,
            left: -10,
            right: 10,
            imagePrimary,
            imageSecondary: undefined
        });

        expect(shaping.shapeIcon(imagePosition, undefined, [ 4, 7 ], 'center')).toEqual({
            top: -3,
            bottom: 17,
            left: -6,
            right: 14,
            imagePrimary,
            imageSecondary: undefined
        });
    });

    test('text-anchor: left', () => {
        expect(shaping.shapeIcon(imagePosition, undefined, [ 0, 0 ], 'left')).toEqual({
            top: -10,
            bottom: 10,
            left: 0,
            right: 20,
            imagePrimary,
            imageSecondary: undefined
        });

        expect(shaping.shapeIcon(imagePosition, undefined, [ 4, 7 ], 'left')).toEqual({
            top: -3,
            bottom: 17,
            left: 4,
            right: 24,
            imagePrimary,
            imageSecondary: undefined
        });
    });

    test('text-anchor: bottom-right', () => {
        expect(shaping.shapeIcon(imagePosition, undefined, [ 0, 0 ], 'bottom-right')).toEqual({
            top: -20,
            bottom: 0,
            left: -20,
            right: 0,
            imagePrimary,
            imageSecondary: undefined
        });

        expect(shaping.shapeIcon(imagePosition, undefined, [ 4, 7 ], 'bottom-right')).toEqual({
            top: -13,
            bottom: 7,
            left: -16,
            right: 4,
            imagePrimary,
            imageSecondary: undefined
        });
    });
});

describe('fitIconToText', () => {
    const glyphSize = 24;
    const shapedIcon = Object.freeze({
        top: -10,
        bottom: 10,
        left: -10,
        right: 10,
        collisionPadding: undefined,
        imagePrimary: Object.freeze({
            pixelRatio: 1,
            displaySize: [ 20, 20 ],
            paddedRect: Object.freeze({x: 0, y: 0, w: 22, h: 22})
        }),
        imageSecondary: undefined
    });

    const shapedText = Object.freeze({
        top: -10,
        bottom: 30,
        left: -60,
        right: 20
    });

    test('icon-text-fit: width', () => {
        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [0, 0], 24 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: 0,
            right: 20,
            bottom: 20,
            left: -60
        });

        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [3, 7], 24 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: 7,
            right: 23,
            bottom: 27,
            left: -57
        });

        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [0, 0], 12 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -5,
            right: 10,
            bottom: 15,
            left: -30
        });

        // Ignores padding for top/bottom, since the icon is only stretched to the text's width but not height
        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'width', [ 5, 10, 5, 10 ], [0, 0], 12 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -5,
            right: 20,
            bottom: 15,
            left: -40
        });
    });

    test('icon-text-fit: height', () => {
        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [0, 0], 24 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -10,
            right: -10,
            bottom: 30,
            left: -30
        });

        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [3, 7], 24 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -3,
            right: -7,
            bottom: 37,
            left: -27
        });

        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [0, 0], 12 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -5,
            right: 0,
            bottom: 15,
            left: -20
        });

        // Ignores padding for left/right, since the icon is only stretched to the text's height but not width
        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'height', [ 5, 10, 5, 10 ], [0, 0], 12 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -10,
            right: 0,
            bottom: 20,
            left: -20
        });
    });

    test('icon-text-fit: both', () => {
        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [0, 0], 24 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -10,
            right: 20,
            bottom: 30,
            left: -60
        });

        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [3, 7], 24 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -3,
            right: 23,
            bottom: 37,
            left: -57
        });

        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [0, 0], 12 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -5,
            right: 10,
            bottom: 15,
            left: -30
        });

        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'both', [ 5, 10, 5, 10 ], [0, 0], 12 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -10,
            right: 20,
            bottom: 20,
            left: -40
        });

        expect(
            shaping.fitIconToText(shapedIcon, shapedText, 'both', [ 0, 5, 10, 15 ], [0, 0], 12 / glyphSize)
        ).toEqual({
            imagePrimary: shapedIcon.imagePrimary,
            imageSecondary: undefined,
            collisionPadding: undefined,
            top: -5,
            right: 15,
            bottom: 25,
            left: -45
        });
    });
});
