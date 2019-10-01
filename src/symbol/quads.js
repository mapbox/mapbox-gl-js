// @flow

import Point from '@mapbox/point-geometry';

import {GLYPH_PBF_BORDER} from '../style/parse_glyph_pbf';

import type Anchor from './anchor';
import type {PositionedIcon, Shaping} from './shaping';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type {Feature} from '../style-spec/expression';
import type {GlyphPosition} from '../render/glyph_atlas';
import ONE_EM from './one_em';

/**
 * A textured quad for rendering a single icon or glyph.
 *
 * The zoom range the glyph can be shown is defined by minScale and maxScale.
 *
 * @param tl The offset of the top left corner from the anchor.
 * @param tr The offset of the top right corner from the anchor.
 * @param bl The offset of the bottom left corner from the anchor.
 * @param br The offset of the bottom right corner from the anchor.
 * @param tex The texture coordinates.
 *
 * @private
 */
export type SymbolQuad = {
    tl: Point,
    tr: Point,
    bl: Point,
    br: Point,
    tex: {
        x: number,
        y: number,
        w: number,
        h: number
    },
    writingMode: any | void,
    glyphOffset: [number, number],
    sectionIndex: number
};

/**
 * Create the quads used for rendering an icon.
 * @private
 */
export function getIconQuads(
                      shapedIcon: PositionedIcon,
                      iconRotate: number): Array<SymbolQuad> {
    const image = shapedIcon.image;

    // If you have a 10px icon that isn't perfectly aligned to the pixel grid it will cover 11 actual
    // pixels. The quad needs to be padded to account for this, otherwise they'll look slightly clipped
    // on one edge in some cases.
    const border = 1;

    // Expand the box to respect the 1 pixel border in the atlas image. We're using `image.paddedRect - border`
    // instead of image.displaySize because we only pad with one pixel for retina images as well, and the
    // displaySize uses the logical dimensions, not the physical pixel dimensions.
    const iconWidth = shapedIcon.right - shapedIcon.left;
    const expandX = (iconWidth * image.paddedRect.w / (image.paddedRect.w - 2 * border) - iconWidth) / 2;
    const left = shapedIcon.left - expandX;
    const right = shapedIcon.right + expandX;

    const iconHeight = shapedIcon.bottom - shapedIcon.top;
    const expandY = (iconHeight * image.paddedRect.h / (image.paddedRect.h - 2 * border) - iconHeight) / 2;
    const top = shapedIcon.top - expandY;
    const bottom = shapedIcon.bottom + expandY;

    const tl = new Point(left, top);
    const tr = new Point(right, top);
    const br = new Point(right, bottom);
    const bl = new Point(left, bottom);

    const angle = iconRotate * Math.PI / 180;

    if (angle) {
        const sin = Math.sin(angle),
            cos = Math.cos(angle),
            matrix = [cos, -sin, sin, cos];

        tl._matMult(matrix);
        tr._matMult(matrix);
        bl._matMult(matrix);
        br._matMult(matrix);
    }

    // Icon quad is padded, so texture coordinates also need to be padded.
    return [{tl, tr, bl, br, tex: image.paddedRect, writingMode: undefined, glyphOffset: [0, 0], sectionIndex: 0}];
}

/**
 * Create the quads used for rendering a text label.
 * @private
 */
export function getGlyphQuads(anchor: Anchor,
                       shaping: Shaping,
                       textOffset: [number, number],
                       layer: SymbolStyleLayer,
                       alongLine: boolean,
                       feature: Feature,
                       positions: {[string]: {[number]: GlyphPosition}},
                       allowVerticalPlacement: boolean): Array<SymbolQuad> {

    const textRotate = layer.layout.get('text-rotate').evaluate(feature, {}) * Math.PI / 180;

    const positionedGlyphs = shaping.positionedGlyphs;
    const quads = [];

    for (let k = 0; k < positionedGlyphs.length; k++) {
        const positionedGlyph = positionedGlyphs[k];
        const glyphPositions = positions[positionedGlyph.fontStack];
        const glyph = glyphPositions && glyphPositions[positionedGlyph.glyph];
        if (!glyph) continue;

        const rect = glyph.rect;
        if (!rect) continue;

        // The rects have an addditional buffer that is not included in their size.
        const glyphPadding = 1.0;
        const rectBuffer = GLYPH_PBF_BORDER + glyphPadding;

        const halfAdvance = glyph.metrics.advance * positionedGlyph.scale / 2;

        const glyphOffset = alongLine ?
            [positionedGlyph.x + halfAdvance, positionedGlyph.y] :
            [0, 0];

        let builtInOffset = alongLine ?
            [0, 0] :
            [positionedGlyph.x + halfAdvance + textOffset[0], positionedGlyph.y + textOffset[1]];

        const rotateVerticalGlyph = (alongLine || allowVerticalPlacement) && positionedGlyph.vertical;

        let verticalizedLabelOffset = [0, 0];
        if (rotateVerticalGlyph) {
            // Vertical POI labels that are rotated 90deg CW and whose glyphs must preserve upright orientation
            // need to be rotated 90deg CCW. After a quad is rotated, it is translated to the original built-in offset.
            verticalizedLabelOffset = builtInOffset;
            builtInOffset = [0, 0];
        }

        const x1 = (glyph.metrics.left - rectBuffer) * positionedGlyph.scale - halfAdvance + builtInOffset[0];
        const y1 = (-glyph.metrics.top - rectBuffer) * positionedGlyph.scale + builtInOffset[1];
        const x2 = x1 + rect.w * positionedGlyph.scale;
        const y2 = y1 + rect.h * positionedGlyph.scale;

        const tl = new Point(x1, y1);
        const tr = new Point(x2, y1);
        const bl = new Point(x1, y2);
        const br = new Point(x2, y2);

        if (rotateVerticalGlyph) {
            // Vertical-supporting glyphs are laid out in 24x24 point boxes (1 square em)
            // In horizontal orientation, the y values for glyphs are below the midline
            // and we use a "yOffset" of -17 to pull them up to the middle.
            // By rotating counter-clockwise around the point at the center of the left
            // edge of a 24x24 layout box centered below the midline, we align the center
            // of the glyphs with the horizontal midline, so the yOffset is no longer
            // necessary, but we also pull the glyph to the left along the x axis.
            // The y coordinate includes baseline yOffset, thus needs to be accounted
            // for when glyph is rotated and translated.
            const center = new Point(-halfAdvance, halfAdvance - shaping.yOffset);
            const verticalRotation = -Math.PI / 2;

            // xHalfWidhtOffsetcorrection is a difference between full-width and half-width
            // advance, should be 0 for full-width glyphs and will pull up half-width glyphs.
            const xHalfWidhtOffsetcorrection = ONE_EM / 2 - halfAdvance;
            const xOffsetCorrection = new Point(5 - shaping.yOffset - xHalfWidhtOffsetcorrection, 0);
            const verticalOffsetCorrection = new Point(...verticalizedLabelOffset);
            tl._rotateAround(verticalRotation, center)._add(xOffsetCorrection)._add(verticalOffsetCorrection);
            tr._rotateAround(verticalRotation, center)._add(xOffsetCorrection)._add(verticalOffsetCorrection);
            bl._rotateAround(verticalRotation, center)._add(xOffsetCorrection)._add(verticalOffsetCorrection);
            br._rotateAround(verticalRotation, center)._add(xOffsetCorrection)._add(verticalOffsetCorrection);
        }

        if (textRotate) {
            const sin = Math.sin(textRotate),
                cos = Math.cos(textRotate),
                matrix = [cos, -sin, sin, cos];

            tl._matMult(matrix);
            tr._matMult(matrix);
            bl._matMult(matrix);
            br._matMult(matrix);
        }

        quads.push({tl, tr, bl, br, tex: rect, writingMode: shaping.writingMode, glyphOffset, sectionIndex: positionedGlyph.sectionIndex});
    }

    return quads;
}
