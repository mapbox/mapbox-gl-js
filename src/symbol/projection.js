// @flow

const Point = require('@mapbox/point-geometry');
const {mat4, vec4} = require('@mapbox/gl-matrix');
const symbolSize = require('./symbol_size');
const {addDynamicAttributes} = require('../data/bucket/symbol_bucket');

import type Painter from '../render/painter';
import type SymbolStyleLayer from '../style/style_layer/symbol_style_layer';
import type Transform from '../geo/transform';
import type SymbolBucket from '../data/bucket/symbol_bucket';

module.exports = {
    updateLineLabels,
    getLabelPlaneMatrix,
    getGlCoordMatrix
};

/*
 * # Overview of coordinate spaces
 *
 * ## Tile coordinate spaces
 * Each label has an anchor. Some labels have corresponding line geometries.
 * The points for both anchors and lines are stored in tile units. Each tile has it's own
 * coordinate space going from (0, 0) at the top left to (EXTENT, EXTENT) at the bottom right.
 *
 * ## GL coordinate space
 * At the end of everything, the vertex shader needs to produce a position in GL coordinate space,
 * which is (-1, 1) at the top left and (1, -1) in the bottom right.
 *
 * ## Map pixel coordinate spaces
 * Each tile has a pixel coordinate space. It's just the tile units scaled so that one unit is
 * whatever counts as 1 pixel at the current zoom.
 * This space is used for pitch-alignment=map, rotation-alignment=map
 *
 * ## Rotated map pixel coordinate spaces
 * Like the above, but rotated so axis of the space are aligned with the viewport instead of the tile.
 * This space is used for pitch-alignment=map, rotation-alignment=viewport
 *
 * ## Viewport pixel coordinate space
 * (0, 0) is at the top left of the canvas and (pixelWidth, pixelHeight) is at the bottom right corner
 * of the canvas. This space is used for pitch-alignment=viewport
 *
 *
 * # Vertex projection
 * It goes roughly like this:
 * 1. project the anchor and line from tile units into the correct label coordinate space
 *      - map pixel space           pitch-alignment=map         rotation-alignment=map
 *      - rotated map pixel space   pitch-alignment=map         rotation-alignment=viewport
 *      - viewport pixel space      pitch-alignment=viewport    rotation-alignment=*
 * 2. if the label follows a line, find the point along the line that is the correct distance from the anchor.
 * 3. add the glyph's corner offset to the point from step 3
 * 4. convert from the label coordinate space to gl coordinates
 *
 * For horizontal labels we want to do step 1 in the shader for performance reasons (no cpu work).
 *      This is what `u_label_plane_matrix` is used for.
 * For labels aligned with lines we have to steps 1 and 2 on the cpu since we need access to the line geometry.
 *      This is what `updateLineLabels(...)` does.
 *      Since the conversion is handled on the cpu we just set `u_label_plane_matrix` to an identity matrix.
 *
 * Steps 3 and 4 are done in the shaders for all labels.
 */

/*
 * Returns a matrix for converting from tile units to the correct label coordinate space.
 */
function getLabelPlaneMatrix(posMatrix: mat4,
                             pitchWithMap: boolean,
                             rotateWithMap: boolean,
                             transform: Transform,
                             pixelsToTileUnits: number) {
    const m = mat4.identity(new Float32Array(16));
    if (pitchWithMap) {
        mat4.identity(m);
        mat4.scale(m, m, [1 / pixelsToTileUnits, 1 / pixelsToTileUnits, 1]);
        if (!rotateWithMap) {
            mat4.rotateZ(m, m, transform.angle);
        }
    } else {
        mat4.scale(m, m, [transform.width / 2, -transform.height / 2, 1]);
        mat4.translate(m, m, [1, -1, 0]);
        mat4.multiply(m, m, posMatrix);
    }
    return m;
}

/*
 * Returns a matrix for converting from the correct label coordinate space to gl coords.
 */
function getGlCoordMatrix(posMatrix: mat4,
                          pitchWithMap: boolean,
                          rotateWithMap: boolean,
                          transform: Transform,
                          pixelsToTileUnits: number) {
    const m = mat4.identity(new Float32Array(16));
    if (pitchWithMap) {
        mat4.multiply(m, m, posMatrix);
        mat4.scale(m, m, [pixelsToTileUnits, pixelsToTileUnits, 1]);
        if (!rotateWithMap) {
            mat4.rotateZ(m, m, -transform.angle);
        }
    } else {
        mat4.scale(m, m, [1, -1, 1]);
        mat4.translate(m, m, [-1, -1, 0]);
        mat4.scale(m, m, [2 / transform.width, 2 / transform.height, 1]);
    }
    return m;
}

function project(point: Point, matrix: mat4) {
    const pos = [point.x, point.y, 0, 1];
    vec4.transformMat4(pos, pos, matrix);
    const w = pos[3];
    return {
        point: new Point(pos[0] / w, pos[1] / w),
        signedDistanceFromCamera: w
    };
}

function isVisible(anchorPos: [number, number, number, number],
                   placementZoom: number,
                   clippingBuffer: [number, number],
                   painter: Painter) {
    const x = anchorPos[0] / anchorPos[3];
    const y = anchorPos[1] / anchorPos[3];
    const inPaddedViewport = (
        x >= -clippingBuffer[0] &&
        x <= clippingBuffer[0] &&
        y >= -clippingBuffer[1] &&
        y <= clippingBuffer[1]);
    return inPaddedViewport && painter.frameHistory.isVisible(placementZoom);
}

/*
 *  Update the `dynamicLayoutVertexBuffer` for the buffer with the correct glyph positions for the current map view.
 *  This is only run on labels that are aligned with lines. Horizontal labels are handled entirely in the shader.
 */
function updateLineLabels(bucket: SymbolBucket,
                          posMatrix: mat4,
                          painter: Painter,
                          isText: boolean,
                          labelPlaneMatrix: mat4,
                          glCoordMatrix: mat4,
                          pitchWithMap: boolean,
                          keepUpright: boolean,
                          pixelsToTileUnits: number,
                          layer: SymbolStyleLayer) {

    const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
    const partiallyEvaluatedSize = symbolSize.evaluateSizeForZoom(sizeData, painter.transform, layer, isText);

    const clippingBuffer = [256 / painter.width * 2 + 1, 256 / painter.height * 2 + 1];

    const dynamicLayoutVertexArray = isText ?
        bucket.text.dynamicLayoutVertexArray :
        bucket.icon.dynamicLayoutVertexArray;
    dynamicLayoutVertexArray.clear();

    const lineVertexArray = bucket.lineVertexArray;
    const placedSymbols = isText ? bucket.placedGlyphArray : bucket.placedIconArray;

    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol: any = placedSymbols.get(s);

        const anchorPos = [symbol.anchorX, symbol.anchorY, 0, 1];
        vec4.transformMat4(anchorPos, anchorPos, posMatrix);

        // Don't bother calculating the correct point for invisible labels.
        if (!isVisible(anchorPos, symbol.placementZoom, clippingBuffer, painter)) {
            hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
            continue;
        }

        const cameraToAnchorDistance = anchorPos[3];
        const perspectiveRatio = 1 + 0.5 * ((cameraToAnchorDistance / painter.transform.cameraToCenterDistance) - 1);

        const fontSize = symbolSize.evaluateSizeForFeature(sizeData, partiallyEvaluatedSize, symbol);
        const pitchScaledFontSize = pitchWithMap ?
            fontSize * perspectiveRatio :
            fontSize / perspectiveRatio;

        const tileAnchorPoint = new Point(symbol.anchorX, symbol.anchorY);
        const anchorPoint = project(tileAnchorPoint, labelPlaneMatrix).point;
        const projectionCache = {};

        const placeUnflipped = placeGlyphsAlongLine(symbol, pitchScaledFontSize, false /*unflipped*/, keepUpright, posMatrix, labelPlaneMatrix, glCoordMatrix,
            bucket.glyphOffsetArray, lineVertexArray, dynamicLayoutVertexArray, anchorPoint, tileAnchorPoint, projectionCache);

        if (placeUnflipped.notEnoughRoom ||
            (placeUnflipped.needsFlipping &&
             placeGlyphsAlongLine(symbol, pitchScaledFontSize, true /*flipped*/, keepUpright, posMatrix, labelPlaneMatrix, glCoordMatrix,
                 bucket.glyphOffsetArray, lineVertexArray, dynamicLayoutVertexArray, anchorPoint, tileAnchorPoint, projectionCache).notEnoughRoom)) {
            hideGlyphs(symbol.numGlyphs, dynamicLayoutVertexArray);
        }
    }

    if (isText) {
        bucket.text.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray.serialize());
    } else {
        bucket.icon.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray.serialize());
    }
}

function placeGlyphsAlongLine(symbol,
                              fontSize: number,
                              flip: boolean,
                              keepUpright: boolean,
                              posMatrix: mat4,
                              labelPlaneMatrix: mat4,
                              glCoordMatrix: mat4,
                              glyphOffsetArray: any,
                              lineVertexArray: any,
                              dynamicLayoutVertexArray,
                              anchorPoint: Point,
                              tileAnchorPoint: Point,
                              projectionCache: {[number]: Point}) {
    const fontScale = fontSize / 24;
    const lineOffsetX = symbol.lineOffsetX * fontSize;
    const lineOffsetY = symbol.lineOffsetY * fontSize;

    let placedGlyphs;
    if (symbol.numGlyphs > 1) {
        const glyphEndIndex = symbol.glyphStartIndex + symbol.numGlyphs;

        // Place the first and the last glyph in the label first, so we can figure out
        // the overall orientation of the label and determine whether it needs to be flipped in keepUpright mode
        const firstGlyphOffset = glyphOffsetArray.get(symbol.glyphStartIndex).offsetX;
        const lastGlyphOffset = glyphOffsetArray.get(glyphEndIndex - 1).offsetX;
        const lineStartIndex = symbol.lineStartIndex;
        const lineEndIndex = symbol.lineStartIndex + symbol.lineLength;

        const firstPlacedGlyph = placeGlyphAlongLine(fontScale * firstGlyphOffset, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol.segment,
            lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache);
        if (!firstPlacedGlyph)
            return { notEnoughRoom: true };

        const lastPlacedGlyph = placeGlyphAlongLine(fontScale * lastGlyphOffset, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol.segment,
            lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache);
        if (!lastPlacedGlyph)
            return { notEnoughRoom: true };

        const firstPoint = project(firstPlacedGlyph.point, glCoordMatrix).point;
        const lastPoint = project(lastPlacedGlyph.point, glCoordMatrix).point;

        if (keepUpright && !flip &&
            (symbol.vertical ? firstPoint.y < lastPoint.y : firstPoint.x > lastPoint.x)) {
            return { needsFlipping: true };
        }

        placedGlyphs = [firstPlacedGlyph];
        for (let glyphIndex = symbol.glyphStartIndex + 1; glyphIndex < glyphEndIndex - 1; glyphIndex++) {
            const glyph = glyphOffsetArray.get(glyphIndex);

            // Since first and last glyph fit on the line, we're sure that the rest of the glyphs can be placed
            placedGlyphs.push(placeGlyphAlongLine(fontScale * glyph.offsetX, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol.segment,
                lineStartIndex, lineEndIndex, lineVertexArray, labelPlaneMatrix, projectionCache));
        }
        placedGlyphs.push(lastPlacedGlyph);
    } else {
        // Only a single glyph to place
        // So, determine whether to flip based on projected angle of the line segment it's on
        if (keepUpright && !flip) {
            const a = project(tileAnchorPoint, posMatrix).point;
            const tileSegmentEnd = lineVertexArray.get(symbol.lineStartIndex + symbol.segment + 1);
            const projectedVertex = project(tileSegmentEnd, posMatrix);
            // We know the anchor will be in the viewport, but the end of the line segment may be
            // behind the plane of the camera, in which case we can use a point at any arbitrary (closer)
            // point on the segment.
            const b = (projectedVertex.signedDistanceFromCamera > 0) ?
                projectedVertex.point :
                projectTruncatedLineSegment(tileAnchorPoint, new Point(tileSegmentEnd.x, tileSegmentEnd.y), a, 1, posMatrix);

            if (symbol.vertical ? b.y > a.y : b.x < a.x) {
                return { needsFlipping: true };
            }
        }
        const glyph = glyphOffsetArray.get(symbol.glyphStartIndex);
        const singleGlyph = placeGlyphAlongLine(fontScale * glyph.offsetX, lineOffsetX, lineOffsetY, flip, anchorPoint, tileAnchorPoint, symbol.segment,
            symbol.lineStartIndex, symbol.lineStartIndex + symbol.lineLength, lineVertexArray, labelPlaneMatrix, projectionCache);
        if (!singleGlyph)
            return { notEnoughRoom: true };

        placedGlyphs = [singleGlyph];
    }

    const placementZoom = symbol.placementZoom;
    for (const glyph: any of placedGlyphs) {
        addDynamicAttributes(dynamicLayoutVertexArray, glyph.point, glyph.angle, placementZoom);
    }
    return {};
}

function projectTruncatedLineSegment(previousTilePoint: Point, currentTilePoint: Point, previousProjectedPoint: Point, minimumLength: number, projectionMatrix: mat4) {
    // We are assuming "previousTilePoint" won't project to a point within one unit of the camera plane
    // If it did, that would mean our label extended all the way out from within the viewport to a (very distant)
    // point near the plane of the camera. We wouldn't be able to render the label anyway once it crossed the
    // plane of the camera.
    const projectedUnitVertex = project(previousTilePoint.add(previousTilePoint.sub(currentTilePoint)._unit()), projectionMatrix).point;
    const projectedUnitSegment = previousProjectedPoint.sub(projectedUnitVertex);

    return previousProjectedPoint.add(projectedUnitSegment._mult(minimumLength / projectedUnitSegment.mag()));
}

function placeGlyphAlongLine(offsetX: number,
                             lineOffsetX: number,
                             lineOffsetY: number,
                             flip: boolean,
                             anchorPoint: Point,
                             tileAnchorPoint: Point,
                             anchorSegment: number,
                             lineStartIndex: number,
                             lineEndIndex: number,
                             lineVertexArray: any,
                             labelPlaneMatrix: mat4,
                             projectionCache: {[number]: Point}) {

    const combinedOffsetX = flip ?
        offsetX - lineOffsetX :
        offsetX + lineOffsetX;

    let dir = combinedOffsetX > 0 ? 1 : -1;

    let angle = 0;
    if (flip) {
        // The label needs to be flipped to keep text upright.
        // Iterate in the reverse direction.
        dir *= -1;
        angle = Math.PI;
    }

    if (dir < 0) angle += Math.PI;

    let currentIndex = dir > 0 ?
        lineStartIndex + anchorSegment :
        lineStartIndex + anchorSegment + 1;

    let current = anchorPoint;
    let prev = anchorPoint;
    let distanceToPrev = 0;
    let currentSegmentDistance = 0;
    const absOffsetX = Math.abs(combinedOffsetX);

    while (distanceToPrev + currentSegmentDistance <= absOffsetX) {
        currentIndex += dir;

        // offset does not fit on the projected line
        if (currentIndex < lineStartIndex || currentIndex >= lineEndIndex)
            return null;

        prev = current;

        current = projectionCache[currentIndex];
        if (current === undefined) {
            const projection = project(lineVertexArray.get(currentIndex), labelPlaneMatrix);
            if (projection.signedDistanceFromCamera > 0) {
                current = projectionCache[currentIndex] = projection.point;
            } else {
                // The vertex is behind the plane of the camera, so we can't project it
                // Instead, we'll create a vertex along the line that's far enough to include the glyph
                const previousTilePoint = distanceToPrev === 0 ?
                    tileAnchorPoint :
                    new Point(lineVertexArray.get(currentIndex - dir).x, lineVertexArray.get(currentIndex - dir).y);
                const currentTilePoint = new Point(lineVertexArray.get(currentIndex).x, lineVertexArray.get(currentIndex).y);
                // Don't cache because the new vertex might not be far enough out for future glyphs on the same segment
                current = projectTruncatedLineSegment(previousTilePoint, currentTilePoint, prev, absOffsetX - distanceToPrev + 1, labelPlaneMatrix);
            }
        }

        distanceToPrev += currentSegmentDistance;
        currentSegmentDistance = prev.dist(current);
    }

    // The point is on the current segment. Interpolate to find it.
    const segmentInterpolationT = (absOffsetX - distanceToPrev) / currentSegmentDistance;
    const prevToCurrent = current.sub(prev);
    const p = prevToCurrent.mult(segmentInterpolationT)._add(prev);

    // offset the point from the line to text-offset and icon-offset
    p._add(prevToCurrent._unit()._perp()._mult(lineOffsetY * dir));

    const segmentAngle = angle + Math.atan2(current.y - prev.y, current.x - prev.x);

    return {
        point: p,
        angle: segmentAngle
    };
}

const offscreenPoint = new Point(-Infinity, -Infinity);

// Hide them by moving them offscreen. We still need to add them to the buffer
// because the dynamic buffer is paired with a static buffer that doesn't get updated.
function hideGlyphs(num, dynamicLayoutVertexArray) {
    for (let i = 0; i < num; i++) {
        addDynamicAttributes(dynamicLayoutVertexArray, offscreenPoint, 0, 25);
    }
}
