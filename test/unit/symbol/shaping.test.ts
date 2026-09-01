// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import * as shaping from '../../../src/symbol/shaping';
import {WritingMode, shapeIcon, fitIconToText} from '../../../src/symbol/shaping_shared';
import Formatted, {FormattedSection} from '../../../src/style-spec/expression/types/formatted';
import ResolvedImage from '../../../src/style-spec/expression/types/resolved_image';
import {ICON_PADDING, ImagePosition} from '../../../src/render/image_atlas';
import fontstackGlyphs from '../../fixtures/fontstack-glyphs.json';

import type {Shaping} from '../../../src/symbol/shaping_shared';

describe('shaping', () => {
    const oneEm = 24;
    const layoutTextSize = 16;
    const layoutTextSizeThisZoom = 16;
    const fontStack = 'Test';
    const glyphMap = {
        'Test': fontstackGlyphs
    };

    const glyphPositions = {'Test': {}};
    const glyphPositonMap = glyphPositions['Test'];
    const glyphData = glyphMap['Test'].glyphs;
    for (const id in glyphData) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        glyphPositonMap[id] = glyphData[id].rect;
    }

    const images = new Map([
        [ResolvedImage.build('square').getPrimary().toString(), new ImagePosition({x: 0, y: 0, w: 16, h: 16}, {pixelRatio: 1, version: 1}, ICON_PADDING)],
        [ResolvedImage.build('tall').getPrimary().toString(), new ImagePosition({x: 0, y: 0, w: 16, h: 32}, {pixelRatio: 1, version: 1}, ICON_PADDING)],
        [ResolvedImage.build('wide').getPrimary().toString(), new ImagePosition({x: 0, y: 0, w: 32, h: 16}, {pixelRatio: 1, version: 1}, ICON_PADDING)],
        [ResolvedImage.build('sdf').getPrimary().toString(), new ImagePosition({x: 0, y: 0, w: 32, h: 16}, {pixelRatio: 1, version: 1, sdf: true}, ICON_PADDING)],
    ]);

    const sectionForImage = (name) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return new FormattedSection('', ResolvedImage.build(name), null, null, null);
    };

    const sectionForText = (name, scale) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return new FormattedSection(name, null, scale, null, null);
    };

    const basePath = '../../fixtures/expected';

    test('Text shaping null', async () => {
        const shaped = shaping.shapeText(Formatted.fromString(`hi${String.fromCharCode(0)}`), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-null.json`);
    });

    // Default shaping.
    test('Default shaping', async () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-default.json`);
    });

    test('Letter spacing', async () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0.125 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-spacing.json`);
    });

    test('Line break', async () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde abcde'), glyphMap, glyphPositions, images, fontStack, 4 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-linebreak.json`);
    });

    test('New line', async () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde\nabcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-newline.json`);
    });

    test('New line with carriage return', async () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde\r\nabcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-newline-carriege.json`);
    });

    test('New lines in the middle', async () => {
        const shaped = shaping.shapeText(Formatted.fromString('abcde\n\nabcde'), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-newlines-in-middle.json`);
    });

    test('Zero width space', async () => {
        const shaped = shaping.shapeText(Formatted.fromString('三三\u200b三三\u200b三三\u200b三三三三三三\u200b三三'), glyphMap, glyphPositions, images, fontStack, 5 * oneEm, oneEm, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-zero-width-space.json`);
    });

    test('Null shaping', () => {
        let shaped: any;

        // Null shaping.
        shaped = shaping.shapeText(Formatted.fromString(''), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(undefined).toEqual(shaped);

        shaped = shaping.shapeText(Formatted.fromString(String.fromCharCode(0)), glyphMap, glyphPositions, images, fontStack, 15 * oneEm, oneEm, 'center', 'center', 0 * oneEm, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);
        expect(undefined).toEqual(shaped);
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

    test('images in horizontal layout', async () => {
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
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-images-horizontal.json`);
    });

    // An SDF image in text-field is dropped before the shaping measures it, so it contributes neither advance
    // nor a break opportunity. Asserted against the same text without the image rather than against numbers,
    // so the cases survive a change to the test font's metrics. Mirrors ShapingSdfImage in
    // gl-native's test/text/shaping.test.cpp.
    const shapeSections = (sections: FormattedSection[], maxWidthInChars = 20) => shaping.shapeText(
        new Formatted(sections), glyphMap, glyphPositions, images, fontStack, maxWidthInChars * oneEm, oneEm,
        'center', 'center', 0, [0, 0], WritingMode.horizontal, false, layoutTextSize, layoutTextSizeThisZoom);

    const expectSameBox = (left: Shaping, right: Shaping) => {
        expect(left).toBeTruthy();
        expect(right).toBeTruthy();
        expect(left.positionedLines.length).toEqual(right.positionedLines.length);
        expect([left.left, left.right, left.top, left.bottom]).toEqual([right.left, right.right, right.top, right.bottom]);
    };

    test('sdf image in text-field is not measured', () => {
        expectSameBox(shapeSections([sectionForText('Foo'), sectionForImage('sdf')]), shapeSections([sectionForText('Foo')]));
        expectSameBox(shapeSections([sectionForImage('sdf'), sectionForText('Foo')]), shapeSections([sectionForText('Foo')]));
    });

    test('trailing space before a dropped sdf image is trimmed', () => {
        // The space is interior while the image is still there, so only dropping the image ahead of the trim
        // gets it stripped -- the half of the fix that a drop at quad generation could not reach.
        expectSameBox(shapeSections([sectionForText('Foo '), sectionForImage('sdf')]), shapeSections([sectionForText('Foo')]));
    });

    test('non-sdf image is still measured', () => {
        // The control: the mechanism is keyed on the image being one nothing draws, not on it being an image.
        const withImage = shapeSections([sectionForText('Foo'), sectionForImage('wide')]);
        const withoutImage = shapeSections([sectionForText('Foo')]);
        expect(withImage.right - withImage.left).toBeGreaterThan(withoutImage.right - withoutImage.left);
    });

    test('text of nothing but an sdf image shapes nothing', () => {
        // Every character is dropped, which the BiDi processing cannot be handed.
        expect(shapeSections([sectionForImage('sdf')])).toEqual(undefined);
    });

    test('a dropped sdf image opens no line break', () => {
        // Text on both sides, because a break opportunity is only taken when something follows it.
        const around = (image: string): FormattedSection[] => [sectionForText('Foo'), sectionForImage(image), sectionForText('Foo')];
        const maxWidthInChars = 3;
        const linesWithoutImage = shapeSections([sectionForText('FooFoo')], maxWidthInChars).positionedLines.length;
        // The control makes the case prove itself: an image of the same size that is measured does break here.
        expect(shapeSections(around('wide'), maxWidthInChars).positionedLines.length).toBeGreaterThan(linesWithoutImage);
        expect(shapeSections(around('sdf'), maxWidthInChars).positionedLines.length).toEqual(linesWithoutImage);
    });

    test('images in vertical layout', async () => {
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
        await expect(JSON.stringify(shaped, null, 2)).toMatchFileSnapshot(`${basePath}/text-shaping-images-vertical.json`);
    });
});

describe('shapeIcon', () => {
    const imagePosition = new ImagePosition({x: 0, y: 0, w: 22, h: 22}, {pixelRatio: 1, version: 1}, ICON_PADDING);
    const imagePrimary = Object.freeze({
        content: undefined,
        stretchX: undefined,
        stretchY: undefined,
        paddedRect: Object.freeze({x: 0, y: 0, w: 22, h: 22}),
        pixelRatio: 1,
        version: 1,
        scale: {
            x: 1,
            y: 1
        },
        padding: ICON_PADDING
    });

    test('text-anchor: center', () => {
        expect(shapeIcon(imagePosition, undefined, [0, 0], 'center')).toEqual({
            top: -10,
            bottom: 10,
            left: -10,
            right: 10,
            imagePrimary,
            imageSecondary: undefined
        });

        expect(shapeIcon(imagePosition, undefined, [4, 7], 'center')).toEqual({
            top: -3,
            bottom: 17,
            left: -6,
            right: 14,
            imagePrimary,
            imageSecondary: undefined
        });
    });

    test('text-anchor: left', () => {
        expect(shapeIcon(imagePosition, undefined, [0, 0], 'left')).toEqual({
            top: -10,
            bottom: 10,
            left: 0,
            right: 20,
            imagePrimary,
            imageSecondary: undefined
        });

        expect(shapeIcon(imagePosition, undefined, [4, 7], 'left')).toEqual({
            top: -3,
            bottom: 17,
            left: 4,
            right: 24,
            imagePrimary,
            imageSecondary: undefined
        });
    });

    test('text-anchor: bottom-right', () => {
        expect(shapeIcon(imagePosition, undefined, [0, 0], 'bottom-right')).toEqual({
            top: -20,
            bottom: 0,
            left: -20,
            right: 0,
            imagePrimary,
            imageSecondary: undefined
        });

        expect(shapeIcon(imagePosition, undefined, [4, 7], 'bottom-right')).toEqual({
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
            displaySize: [20, 20],
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
            fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [0, 0], 24 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [3, 7], 24 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'width', [0, 0, 0, 0], [0, 0], 12 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'width', [5, 10, 5, 10], [0, 0], 12 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [0, 0], 24 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [3, 7], 24 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'height', [0, 0, 0, 0], [0, 0], 12 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'height', [5, 10, 5, 10], [0, 0], 12 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [0, 0], 24 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [3, 7], 24 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'both', [0, 0, 0, 0], [0, 0], 12 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'both', [5, 10, 5, 10], [0, 0], 12 / glyphSize)
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
            fitIconToText(shapedIcon, shapedText, 'both', [0, 5, 10, 15], [0, 0], 12 / glyphSize)
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
