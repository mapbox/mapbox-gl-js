'use strict';

const Point = require('point-geometry');

module.exports = {
    getIconQuads: getIconQuads,
    getGlyphQuads: getGlyphQuads,
    SymbolQuad: SymbolQuad
};

const minScale = 0.5; // underscale by 1 zoom level

/**
 * A textured quad for rendering a single icon or glyph.
 *
 * The zoom range the glyph can be shown is defined by minScale and maxScale.
 *
 * @param {Point} anchorPoint the point the symbol is anchored around
 * @param {Point} tl The offset of the top left corner from the anchor.
 * @param {Point} tr The offset of the top right corner from the anchor.
 * @param {Point} bl The offset of the bottom left corner from the anchor.
 * @param {Point} br The offset of the bottom right corner from the anchor.
 * @param {Object} tex The texture coordinates.
 * @param {number} anchorAngle The angle of the label at it's center, not the angle of this quad.
 * @param {number} glyphAngle The angle of the glyph to be positioned in the quad.
 * @param {number} minScale The minimum scale, relative to the tile's intended scale, that the glyph can be shown at.
 * @param {number} maxScale The maximum scale, relative to the tile's intended scale, that the glyph can be shown at.
 *
 * @class SymbolQuad
 * @private
 */
function SymbolQuad(anchorPoint, tl, tr, bl, br, tex, anchorAngle, glyphAngle, minScale, maxScale, writingMode) {
    this.anchorPoint = anchorPoint;
    this.tl = tl;
    this.tr = tr;
    this.bl = bl;
    this.br = br;
    this.tex = tex;
    this.anchorAngle = anchorAngle;
    this.glyphAngle = glyphAngle;
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.writingMode = writingMode;
}

/**
 * Create the quads used for rendering an icon.
 *
 * @param {Anchor} anchor
 * @param {PositionedIcon} shapedIcon
 * @param {number} boxScale A magic number for converting glyph metric units to geometry units.
 * @param {Array<Array<Point>>} line
 * @param {StyleLayer} layer
 * @param {boolean} alongLine Whether the icon should be placed along the line.
 * @param {Shaping} shapedText Shaping for corresponding text
 * @param {Object} globalProperties
 * @param {Object} featureProperties
 * @returns {Array<SymbolQuad>}
 * @private
 */
function getIconQuads(anchor, shapedIcon, boxScale, line, layer, alongLine, shapedText, globalProperties, featureProperties) {
    const rect = shapedIcon.image.rect;
    const layout = layer.layout;

    const border = 1;
    const left = shapedIcon.left - border;
    const right = left + rect.w / shapedIcon.image.pixelRatio;
    const top = shapedIcon.top - border;
    const bottom = top + rect.h / shapedIcon.image.pixelRatio;
    let tl, tr, br, bl;

    // text-fit mode
    if (layout['icon-text-fit'] !== 'none' && shapedText) {
        const iconWidth = (right - left),
            iconHeight = (bottom - top),
            size = layout['text-size'] / 24,
            textLeft = shapedText.left * size,
            textRight = shapedText.right * size,
            textTop = shapedText.top * size,
            textBottom = shapedText.bottom * size,
            textWidth = textRight - textLeft,
            textHeight = textBottom - textTop,
            padT = layout['icon-text-fit-padding'][0],
            padR = layout['icon-text-fit-padding'][1],
            padB = layout['icon-text-fit-padding'][2],
            padL = layout['icon-text-fit-padding'][3],
            offsetY = layout['icon-text-fit'] === 'width' ? (textHeight - iconHeight) * 0.5 : 0,
            offsetX = layout['icon-text-fit'] === 'height' ? (textWidth - iconWidth) * 0.5 : 0,
            width = layout['icon-text-fit'] === 'width' || layout['icon-text-fit'] === 'both' ? textWidth : iconWidth,
            height = layout['icon-text-fit'] === 'height' || layout['icon-text-fit'] === 'both' ? textHeight : iconHeight;
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

    let angle = layer.getLayoutValue('icon-rotate', globalProperties, featureProperties) * Math.PI / 180;
    if (alongLine) {
        const prev = line[anchor.segment];
        if (anchor.y === prev.y && anchor.x === prev.x && anchor.segment + 1 < line.length) {
            const next = line[anchor.segment + 1];
            angle += Math.atan2(anchor.y - next.y, anchor.x - next.x) + Math.PI;
        } else {
            angle += Math.atan2(anchor.y - prev.y, anchor.x - prev.x);
        }
    }

    if (angle) {
        const sin = Math.sin(angle),
            cos = Math.cos(angle),
            matrix = [cos, -sin, sin, cos];

        tl = tl.matMult(matrix);
        tr = tr.matMult(matrix);
        bl = bl.matMult(matrix);
        br = br.matMult(matrix);
    }

    return [new SymbolQuad(new Point(anchor.x, anchor.y), tl, tr, bl, br, shapedIcon.image.rect, 0, 0, minScale, Infinity)];
}

/**
 * Create the quads used for rendering a text label.
 *
 * @param {Anchor} anchor
 * @param {Shaping} shaping
 * @param {number} boxScale A magic number for converting from glyph metric units to geometry units.
 * @param {Array<Array<Point>>} line
 * @param {StyleLayer} layer
 * @param {boolean} alongLine Whether the label should be placed along the line.
 * @param {Object} globalProperties
 * @param {Object} featureProperties
 * @returns {Array<SymbolQuad>}
 * @private
 */
function getGlyphQuads(anchor, shaping, boxScale, line, layer, alongLine, globalProperties, featureProperties) {

    const textRotate = layer.getLayoutValue('text-rotate', globalProperties, featureProperties) * Math.PI / 180;
    const keepUpright = layer.layout['text-keep-upright'];

    const positionedGlyphs = shaping.positionedGlyphs;
    const quads = [];

    for (let k = 0; k < positionedGlyphs.length; k++) {
        const positionedGlyph = positionedGlyphs[k];
        const glyph = positionedGlyph.glyph;
        if (!glyph) continue;

        const rect = glyph.rect;
        if (!rect) continue;

        const centerX = (positionedGlyph.x + glyph.advance / 2) * boxScale;

        let glyphInstances;
        let labelMinScale = minScale;
        if (alongLine) {
            glyphInstances = [];
            labelMinScale = getLineGlyphs(glyphInstances, anchor, centerX, line, anchor.segment, false);
            if (keepUpright) {
                labelMinScale = Math.min(labelMinScale, getLineGlyphs(glyphInstances, anchor, centerX, line, anchor.segment, true));
            }

        } else {
            glyphInstances = [{
                anchorPoint: new Point(anchor.x, anchor.y),
                upsideDown: false,
                angle: 0,
                maxScale: Infinity,
                minScale: minScale
            }];
        }

        const x1 = positionedGlyph.x + glyph.left;
        const y1 = positionedGlyph.y - glyph.top;
        const x2 = x1 + rect.w;
        const y2 = y1 + rect.h;

        const center = new Point(positionedGlyph.x, glyph.advance / 2);

        const otl = new Point(x1, y1);
        const otr = new Point(x2, y1);
        const obl = new Point(x1, y2);
        const obr = new Point(x2, y2);

        if (positionedGlyph.angle !== 0) {
            otl._sub(center)._rotate(positionedGlyph.angle)._add(center);
            otr._sub(center)._rotate(positionedGlyph.angle)._add(center);
            obl._sub(center)._rotate(positionedGlyph.angle)._add(center);
            obr._sub(center)._rotate(positionedGlyph.angle)._add(center);
        }

        for (let i = 0; i < glyphInstances.length; i++) {

            const instance = glyphInstances[i];
            let tl = otl,
                tr = otr,
                bl = obl,
                br = obr;

            if (textRotate) {
                const sin = Math.sin(textRotate),
                    cos = Math.cos(textRotate),
                    matrix = [cos, -sin, sin, cos];

                tl = tl.matMult(matrix);
                tr = tr.matMult(matrix);
                bl = bl.matMult(matrix);
                br = br.matMult(matrix);
            }

            // Prevent label from extending past the end of the line
            const glyphMinScale = Math.max(instance.minScale, labelMinScale);
             // All the glyphs for a label are tagged with either the "right side up" or "upside down" anchor angle,
            //  which is used at placement time to determine which set to show
            const anchorAngle = (anchor.angle + (instance.upsideDown ? Math.PI : 0.0) + 2 * Math.PI) % (2 * Math.PI);
            const glyphAngle = (instance.angle + (instance.upsideDown ? Math.PI : 0.0) + 2 * Math.PI) % (2 * Math.PI);
            quads.push(new SymbolQuad(instance.anchorPoint, tl, tr, bl, br, rect, anchorAngle, glyphAngle, glyphMinScale, instance.maxScale, shaping.writingMode));
        }
    }

    return quads;
}

/**
 * We can only render glyph quads that slide along a straight line. To draw
 * curved lines we need an instance of a glyph for each segment it appears on.
 * This creates all the instances of a glyph that are necessary to render a label.
 *
 * Given (1) a glyph positioned relative to an anchor point and (2) a line to follow,
 * calculates which segment of the line the glyph will fall on for each possible
 * scale range, and for each range produces a "virtual" anchor point and an angle that will
 * place the glyph on the right segment and rotated to the correct angle.
 *
 * Because one glyph quad is made ahead of time for each possible orientation, the
 * symbol_sdf shader can quickly handle changing layout as we zoom in and out
 *
 * If the "keepUpright" property is set, we call getLineGlyphs twice (once upright and
 * once "upside down"). This will generate two sets of glyphs following the line in opposite
 * directions. Later, SymbolLayout::place will look at the glyphs and based on the placement
 * angle determine if their original anchor was "upright" or not -- based on that, it throws
 * away one set of glyphs or the other (this work has to be done in the CPU, but it's just a
 * filter so it's fast)
 *
 * We need a
 * @param {Array<Object>} glyphs An empty array that glyphInstances are added to.
 * @param {Anchor} anchor
 * @param {number} glyphHorizontalOffsetFromAnchor The glyph's offset from the center of the label.
 * @param {Array<Point>} line
 * @param {number} anchorSegment The index of the segment of the line on which the anchor exists.
 * @param {boolean} upsideDown
 *
 * @returns {number} minScale
 * @private
 */
function getLineGlyphs(glyphs, anchor, glyphHorizontalOffsetFromAnchor, line, anchorSegment, upsideDown) {

    // This is true if the glyph is "logically forward" of the anchor point, based on the ordering of line segments
    //  The actual angle of the line is irrelevant
    //  If "upsideDown" is set, everything is flipped
    const glyphIsLogicallyForward = (glyphHorizontalOffsetFromAnchor >= 0) ^ upsideDown;
    const glyphDistanceFromAnchor = Math.abs(glyphHorizontalOffsetFromAnchor);

    const initialSegmentAnchor = new Point(anchor.x, anchor.y);
    const initialSegmentEnd = getSegmentEnd(glyphIsLogicallyForward, line, anchorSegment);

    let virtualSegment = {
        anchor: initialSegmentAnchor,
        end: initialSegmentEnd,
        index: anchorSegment,
        minScale: getMinScaleForSegment(glyphDistanceFromAnchor, initialSegmentAnchor, initialSegmentEnd),
        maxScale: Infinity
    };

    while (true) {
        insertSegmentGlyph(glyphs,
                           virtualSegment,
                           glyphIsLogicallyForward,
                           upsideDown);

        if (virtualSegment.minScale <= anchor.scale) {
            // No need to calculate below the scale where the label starts showing
            return anchor.scale;
        }

        const nextVirtualSegment = getNextVirtualSegment(virtualSegment,
                                                         line,
                                                         glyphDistanceFromAnchor,
                                                         glyphIsLogicallyForward);
        if (!nextVirtualSegment) {
            // There are no more segments, so we can't fit this glyph on the line at a lower scale
            // This implies we can't show the label at all at lower scale, so we update the anchor's min scale
            return virtualSegment.minScale;
        } else {
            virtualSegment = nextVirtualSegment;
        }
    }
}

/**
 * @param {Array<Object>} glyphs
 * @param {Object} virtualSegment
 * @param {boolean} glyphIsLogicallyForward
 * @param {boolean} upsideDown
 * @private
 */
function insertSegmentGlyph(glyphs, virtualSegment, glyphIsLogicallyForward, upsideDown) {
    const segmentAngle = Math.atan2(virtualSegment.end.y - virtualSegment.anchor.y, virtualSegment.end.x - virtualSegment.anchor.x);
    // If !glyphIsLogicallyForward, we're iterating through the segments in reverse logical order as well, so we need to flip the segment angle
    const glyphAngle = glyphIsLogicallyForward ? segmentAngle : segmentAngle + Math.PI;

    // Insert a glyph rotated at this angle for display in the range from [scale, previous(larger) scale].
    glyphs.push({
        anchorPoint: virtualSegment.anchor,
        upsideDown: upsideDown,
        minScale: virtualSegment.minScale,
        maxScale: virtualSegment.maxScale,
        angle: (glyphAngle + 2.0 * Math.PI) % (2.0 * Math.PI)});
}

/**
 * Given the distance along the line from the label anchor to the beginning of the current segment,
 * project a "virtual anchor" point at the same distance along the line extending out from this segment.
 *
 *                 B <-- beginning of current segment
 * * . . . . . . . *--------* E <-- end of current segment
 * VA              |
 *                /        VA = "virtual segment anchor"
 *               /
 *     ---*-----`
 *        A = label anchor
 *
 * Distance _along line_ from A to B == straight-line distance from VA to B.
 *
 * @param {Point} segmentBegin
 * @param {Point} segmentEnd
 * @param {number} distanceFromAnchorToSegmentBegin
 *
 * @returns {Point} virtualSegmentAnchor
 * @private
 */
function getVirtualSegmentAnchor(segmentBegin, segmentEnd, distanceFromAnchorToSegmentBegin) {
    const segmentDirectionUnitVector = segmentEnd.sub(segmentBegin)._unit();
    return segmentBegin.sub(segmentDirectionUnitVector._mult(distanceFromAnchorToSegmentBegin));
}

/**
 * Given the segment joining `segmentAnchor` and `segmentEnd` and a desired offset
 * `glyphDistanceFromAnchor` at which a glyph is to be placed, calculate the minimum
 * "scale" at which the glyph will fall on the segment (i.e., not past the end)
 *
 * "Scale" here refers to the ratio between the *rendered* zoom level and the text-layout
 * zoom level, which is 1 + (source tile's zoom level).  `glyphDistanceFromAnchor`, although
 * passed in units consistent with the text-layout zoom level, is based on text size.  So
 * when the tile is being rendered at z < text-layout zoom, the glyph's actual distance from
 * the anchor is larger relative to the segment's length than at layout time:
 *
 *
 *                                                                   GLYPH
 * z == layout-zoom, scale == 1:        segmentAnchor *--------------^-------------* segmentEnd
 * z == layout-zoom - 1, scale == 0.5:  segmentAnchor *--------------^* segmentEnd
 *
 *                                                    <-------------->
 *                                                    Anchor-to-glyph distance stays visually fixed,
 *                                                    so it changes relative to the segment.
 * @param {number} glyphDistanceFromAnchor
 * @param {Point} segmentAnchor
 * @param {Point} segmentEnd

 * @returns {number} minScale
 * @private
 */
function getMinScaleForSegment(glyphDistanceFromAnchor, segmentAnchor, segmentEnd) {
    const distanceFromAnchorToEnd = segmentAnchor.dist(segmentEnd);
    return glyphDistanceFromAnchor / distanceFromAnchorToEnd;
}

/**
 * @param {boolean} glyphIsLogicallyForward
 * @param {Array<Point>} line
 * @param {number} segmentIndex
 *
 * @returns {Point} segmentEnd
 * @private
 */
function getSegmentEnd(glyphIsLogicallyForward, line, segmentIndex) {
    return glyphIsLogicallyForward ? line[segmentIndex + 1] : line[segmentIndex];
}

/**
 * @param {Object} previousVirtualSegment
 * @param {Array<Point>} line
 * @param {number} glyphDistanceFromAnchor
 * @param {boolean} glyphIsLogicallyForward

 * @returns {Object} virtualSegment
 * @private
 */
function getNextVirtualSegment(previousVirtualSegment, line, glyphDistanceFromAnchor, glyphIsLogicallyForward) {
    const nextSegmentBegin = previousVirtualSegment.end;

    let end = nextSegmentBegin;
    let index = previousVirtualSegment.index;

    // skip duplicate nodes
    while (end.equals(nextSegmentBegin)) {
        // look ahead by 2 points in the line because the segment index refers to the beginning
        // of the segment, and we need an endpoint too
        if (glyphIsLogicallyForward && (index + 2 < line.length)) {
            index += 1;
        } else if (!glyphIsLogicallyForward && index !== 0) {
            index -= 1;
        } else {
            return null;
        }

        end = getSegmentEnd(glyphIsLogicallyForward, line, index);
    }

    const anchor = getVirtualSegmentAnchor(nextSegmentBegin, end,
                                           previousVirtualSegment.anchor.dist(previousVirtualSegment.end));
    return {
        anchor: anchor,
        end: end,
        index: index,
        minScale: getMinScaleForSegment(glyphDistanceFromAnchor, anchor, end),
        maxScale: previousVirtualSegment.minScale
    };
}
