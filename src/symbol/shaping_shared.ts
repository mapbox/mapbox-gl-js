import assert from '../style-spec/util/assert';

import type {GlyphMetrics} from '../style/style_glyph';
import type {ImagePosition} from '../render/image_atlas';
import type {GlyphRect} from '../render/glyph_atlas';
import type {ImageVariant} from '../style-spec/expression/types/image_variant';

const WritingMode = {
    horizontal: 1,
    vertical: 2,
    horizontalOnly: 3
} as const;

/**
 * Represents the writing mode orientation.
 */
export type Orientation = typeof WritingMode[keyof typeof WritingMode];

export {shapeIcon, fitIconToText, getAnchorAlignment, WritingMode};

// The position of a glyph relative to the text's anchor point.
export type PositionedGlyph = {
    glyph: number;
    image: ImageVariant | null;
    x: number;
    y: number;
    vertical: boolean;
    scale: number;
    fontStack: string;
    sectionIndex: number;
    metrics: GlyphMetrics;
    rect: GlyphRect | null;
    localGlyph?: boolean;
};

export type PositionedLine = {
    positionedGlyphs: Array<PositionedGlyph>;
    lineOffset: number;
};

// A collection of positioned glyphs and some metadata
export type Shaping = {
    positionedLines: Array<PositionedLine>;
    top: number;
    bottom: number;
    left: number;
    right: number;
    writingMode: Orientation;
    text: string;
    iconsInText: boolean;
    verticalizable: boolean;
    hasBaseline: boolean;
};

export type AnchorAlignment = {
    horizontalAlign: number;
    verticalAlign: number;
};

export type SymbolAnchor = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type TextJustify = 'left' | 'center' | 'right';

function getAnchorAlignment(anchor: SymbolAnchor): AnchorAlignment {
    let horizontalAlign = 0.5, verticalAlign = 0.5;

    switch (anchor) {
    case 'right':
    case 'top-right':
    case 'bottom-right':
        horizontalAlign = 1;
        break;
    case 'left':
    case 'top-left':
    case 'bottom-left':
        horizontalAlign = 0;
        break;
    }

    switch (anchor) {
    case 'bottom':
    case 'bottom-right':
    case 'bottom-left':
        verticalAlign = 1;
        break;
    case 'top':
    case 'top-right':
    case 'top-left':
        verticalAlign = 0;
        break;
    }

    return {horizontalAlign, verticalAlign};
}

export type PositionedIcon = {
    imagePrimary: ImagePosition;
    imageSecondary: ImagePosition | null | undefined;
    top: number;
    bottom: number;
    left: number;
    right: number;
    collisionPadding?: [number, number, number, number];
};

function shapeIcon(
    imagePrimary: ImagePosition,
    imageSecondary: ImagePosition | null | undefined,
    iconOffset: [number, number],
    iconAnchor: SymbolAnchor,
): PositionedIcon {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(iconAnchor);
    const dx = iconOffset[0];
    const dy = iconOffset[1];
    const x1 = dx - imagePrimary.displaySize[0] * horizontalAlign;
    const x2 = x1 + imagePrimary.displaySize[0];
    const y1 = dy - imagePrimary.displaySize[1] * verticalAlign;
    const y2 = y1 + imagePrimary.displaySize[1];
    return {imagePrimary, imageSecondary, top: y1, bottom: y2, left: x1, right: x2};
}

function fitIconToText(
    shapedIcon: PositionedIcon,
    shapedText: Shaping,
    textFit: string,
    padding: [number, number, number, number],
    iconOffset: [number, number],
    fontScale: number,
): PositionedIcon {
    assert(textFit !== 'none');
    assert(Array.isArray(padding) && padding.length === 4);
    assert(Array.isArray(iconOffset) && iconOffset.length === 2);

    const image = shapedIcon.imagePrimary;

    let collisionPadding: [number, number, number, number] | undefined;
    if (image.content) {
        const content = image.content;
        const pixelRatio = image.pixelRatio || 1;
        collisionPadding = [
            content[0] / pixelRatio,
            content[1] / pixelRatio,
            image.displaySize[0] - content[2] / pixelRatio,
            image.displaySize[1] - content[3] / pixelRatio
        ];
    }

    // We don't respect the icon-anchor, because icon-text-fit is set. Instead,
    // the icon will be centered on the text, then stretched in the given
    // dimensions.

    const textLeft = shapedText.left * fontScale;
    const textRight = shapedText.right * fontScale;

    let top: number;
    let right: number;
    let bottom: number;
    let left: number;
    if (textFit === 'width' || textFit === 'both') {
        // Stretched horizontally to the text width
        left = iconOffset[0] + textLeft - padding[3];
        right = iconOffset[0] + textRight + padding[1];
    } else {
        // Centered on the text
        left = iconOffset[0] + (textLeft + textRight - image.displaySize[0]) / 2;
        right = left + image.displaySize[0];
    }

    const textTop = shapedText.top * fontScale;
    const textBottom = shapedText.bottom * fontScale;
    if (textFit === 'height' || textFit === 'both') {
        // Stretched vertically to the text height
        top = iconOffset[1] + textTop - padding[0];
        bottom = iconOffset[1] + textBottom + padding[2];
    } else {
        // Centered on the text
        top = iconOffset[1] + (textTop + textBottom - image.displaySize[1]) / 2;
        bottom = top + image.displaySize[1];
    }

    return {imagePrimary: image, imageSecondary: undefined, top, right, bottom, left, collisionPadding};
}
