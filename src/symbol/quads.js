// @flow

import Point from '@mapbox/point-geometry';

import { GLYPH_PBF_BORDER } from '../style/parse_glyph_pbf';

import type Anchor from './anchor';
import type {PositionedIcon, Shaping} from './shaping';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type {Feature} from '../style-spec/expression';
import type {GlyphPosition} from '../render/glyph_atlas';

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
    glyphOffset: [number, number]
};

/**
 * Create the quads used for rendering an icon.
 * @private
 */
export function getIconQuads(anchor: Anchor,
                      shapedIcon: PositionedIcon,
                      layer: SymbolStyleLayer,
                      alongLine: boolean,
                      shapedText: Shaping,
                      feature: Feature): Array<SymbolQuad> {
    const image = shapedIcon.image;
    const layout = layer.layout;

    // If you have a 10px icon that isn't perfectly aligned to the pixel grid it will cover 11 actual
    // pixels. The quad needs to be padded to account for this, otherwise they'll look slightly clipped
    // on one edge in some cases.
    const borderPadding = 1.0 / image.pixelRatio;
    const top = shapedIcon.top - borderPadding;
    const left = shapedIcon.left - borderPadding;
    const bottom = shapedIcon.bottom + borderPadding;
    const right = shapedIcon.right + borderPadding;
    let tl, tr, br, bl;

    // text-fit mode
    if (layout.get('icon-text-fit') !== 'none' && shapedText) {
        const iconWidth = right - left;
        const iconHeight = bottom - top;
        const size = layout.get('text-size').evaluate(feature, {}) / 24;
        const textLeft = shapedText.left * size;
        const textRight = shapedText.right * size;
        const textTop = shapedText.top * size;
        const textBottom = shapedText.bottom * size;
        const textWidth = textRight - textLeft;
        const textHeight = textBottom - textTop;
        const [padT, padR, padB, padL] = layout.get('icon-text-fit-padding');
        const fit = layout.get('icon-text-fit');
        const offsetY = fit === 'width' ? (textHeight - iconHeight) / 2 : 0;
        const offsetX = fit === 'height' ? (textWidth - iconWidth) / 2 : 0;
        const width = fit === 'width' || fit === 'both' ? textWidth : iconWidth;
        const height = fit === 'height' || fit === 'both' ? textHeight : iconHeight;

        tl = new Point(textLeft + offsetX - padL,         textTop + offsetY - padT);
        tr = new Point(textLeft + offsetX + padR + width, textTop + offsetY - padT);
        br = new Point(textLeft + offsetX + padR + width, textTop + offsetY + padB + height);
        bl = new Point(textLeft + offsetX - padL,         textTop + offsetY + padB + height);

    // Normal icon size mode
    } else {
        tl = new Point(left, top);
        tr = new Point(right, top);
        br = new Point(right, bottom);
        bl = new Point(left, bottom);
    }

    const angle = layer.layout.get('icon-rotate').evaluate(feature, {}) * Math.PI / 180;

    if (angle) {
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        rotatePoint(tl, sin, cos);
        rotatePoint(tr, sin, cos);
        rotatePoint(bl, sin, cos);
        rotatePoint(br, sin, cos);
    }

    // Icon quad is padded, so texture coordinates also need to be padded.
    return [{tl, tr, bl, br, tex: image.paddedRect, writingMode: undefined, glyphOffset: [0, 0]}];
}

/**
 * Create the quads used for rendering a text label.
 * @private
 */
export function getGlyphQuads(anchor: Anchor,
                       shaping: Shaping,
                       layer: SymbolStyleLayer,
                       alongLine: boolean,
                       feature: Feature,
                       positions: {[string]: {[number]: GlyphPosition}}): Array<SymbolQuad> {

    const oneEm = 24;
    const textRotate = layer.layout.get('text-rotate').evaluate(feature, {}) * Math.PI / 180;
    const textOffset = layer.layout.get('text-offset').evaluate(feature, {});

    const positionedGlyphs = shaping.positionedGlyphs;
    const quads = [];

    for (const positionedGlyph of positionedGlyphs) {
        const glyphPositions = positions[positionedGlyph.fontStack];
        const glyph = glyphPositions && glyphPositions[positionedGlyph.glyph];
        if (!glyph) continue;

        const rect = glyph.rect;
        if (!rect) continue;

        // The rects have an addditional buffer that is not included in their size.
        const glyphPadding = 1.0;
        const rectBuffer = GLYPH_PBF_BORDER + glyphPadding;
        const halfAdvance = glyph.metrics.advance * positionedGlyph.scale / 2;
        const glyphOffset = alongLine ? [positionedGlyph.x + halfAdvance, positionedGlyph.y] : [0, 0];
        const builtInOffsetX = alongLine ? 0 : positionedGlyph.x + halfAdvance + textOffset[0] * oneEm;
        const builtInOffsetY = alongLine ? 0 : positionedGlyph.y + textOffset[1] * oneEm;

        const x1 = (glyph.metrics.left - rectBuffer) * positionedGlyph.scale - halfAdvance + builtInOffsetX;
        const y1 = (-glyph.metrics.top - rectBuffer) * positionedGlyph.scale + builtInOffsetY;
        const x2 = x1 + rect.w * positionedGlyph.scale;
        const y2 = y1 + rect.h * positionedGlyph.scale;

        const tl = new Point(x1, y1);
        const tr = new Point(x2, y1);
        const bl  = new Point(x1, y2);
        const br = new Point(x2, y2);

        if (alongLine && positionedGlyph.vertical) {
            // Vertical-supporting glyphs are laid out in 24x24 point boxes (1 square em)
            // In horizontal orientation, the y values for glyphs are below the midline
            // and we use a "yOffset" of -17 to pull them up to the middle.
            // By rotating counter-clockwise around the point at the center of the left
            // edge of a 24x24 layout box centered below the midline, we align the center
            // of the glyphs with the horizontal midline, so the yOffset is no longer
            // necessary, but we also pull the glyph to the left along the x axis
            const verticalRotation = -Math.PI / 2;
            const xOffsetCorrection = 5;

            const sin = Math.sin(verticalRotation);
            const cos = Math.cos(verticalRotation);

            rotatePoint(tl, sin, cos, -halfAdvance, halfAdvance);
            rotatePoint(tr, sin, cos, -halfAdvance, halfAdvance);
            rotatePoint(bl, sin, cos, -halfAdvance, halfAdvance);
            rotatePoint(br, sin, cos, -halfAdvance, halfAdvance);

            tl.x += xOffsetCorrection;
            tr.x += xOffsetCorrection;
            bl.x += xOffsetCorrection;
            br.x += xOffsetCorrection;
        }

        if (textRotate) {
            const sin = Math.sin(textRotate);
            const cos = Math.cos(textRotate);

            rotatePoint(tl, sin, cos);
            rotatePoint(tr, sin, cos);
            rotatePoint(bl, sin, cos);
            rotatePoint(br, sin, cos);
        }

        quads.push({tl, tr, bl, br, tex: rect, writingMode: shaping.writingMode, glyphOffset});
    }

    return quads;
}

function rotatePoint(p: Point, sin: number, cos: number, offsetX = 0, offsetY = 0) {
    const x = p.x - offsetX;
    const y = p.y - offsetY;
    p.x = offsetX + cos * x - sin * y;
    p.y = offsetY + sin * x + cos * y;
}
