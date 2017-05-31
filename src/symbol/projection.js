'use strict';

const Point = require('point-geometry');
const assert = require('assert');
const mat4 = require('@mapbox/gl-matrix').mat4;
const vec4 = require('@mapbox/gl-matrix').vec4;
const symbolSize = require('./symbol_size');

const offscreenPoint = new Point(-Infinity, -Infinity);

module.exports = {
    updateLineLabels: updateLineLabels,
    getLabelPlaneMatrix: getLabelPlaneMatrix,
    getGlCoordMatrix: getGlCoordMatrix
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
 * which is (-1, 1) at the top left and (1, -1) in the bottom left.
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
 * 2. the the label follows a line, find the point along the line that is the correct distance from the anchor.
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
function getLabelPlaneMatrix(posMatrix, pitchWithMap, rotateWithMap, transform, pixelsToTileUnits) {
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
function getGlCoordMatrix(posMatrix, pitchWithMap, rotateWithMap, transform, pixelsToTileUnits) {
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

function project(point, matrix) {
    const pos = [point.x, point.y, 0, 1];
    vec4.transformMat4(pos, pos, matrix);
    return new Point(pos[0] / pos[3], pos[1] / pos[3]);
}

function isVisible(symbol, posMatrix, clippingBuffer, painter) {
    const p = project(new Point(symbol.anchorX, symbol.anchorY), posMatrix);
    const inPaddedViewport = (
            p.x >= -clippingBuffer[0] &&
            p.x <= clippingBuffer[0] &&
            p.y >= -clippingBuffer[1] &&
            p.y <= clippingBuffer[1]);
    return inPaddedViewport && painter.frameHistory.isVisible(symbol.placementZoom);
}

/*
 *  Update the `dynamicLayoutVertexBuffer` for the buffer with the correct glyph positions for the current map view.
 *  This is only run on labels that are aligned with lines. Horizontal labels are handled entirely in the shader.
 */
function updateLineLabels(bucket, posMatrix, painter, isText, labelPlaneMatrix, keepUpright, pixelsToTileUnits, layer) {

    const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
    const partiallyEvaluatedSize = symbolSize.evaluateSizeForZoom(sizeData, painter.transform, layer, isText);

    const clippingBuffer = [256 / painter.width * 2 + 1, 256 / painter.height * 2 + 1];

    const dynamicLayoutVertexArray = isText ?
        bucket.buffers.glyph.dynamicLayoutVertexArray :
        bucket.buffers.icon.dynamicLayoutVertexArray;
    dynamicLayoutVertexArray.clear();

    const placedSymbols = isText ? bucket.placedGlyphArray : bucket.placedIconArray;

    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);

        if (!isVisible(symbol, posMatrix, clippingBuffer, painter)) {
            for (let i = symbol.numGlyphs; i > 0; i--) {
                addGlyph(offscreenPoint, 0, dynamicLayoutVertexArray);
            }
            continue;
        }

        const lineVertexArray = bucket.lineVertexArray;
        let flip = false;
        if (keepUpright) {
            const a = project(lineVertexArray.get(symbol.lineStartIndex + symbol.segment), posMatrix);
            const b = project(lineVertexArray.get(symbol.lineStartIndex + symbol.segment + 1), posMatrix);
            flip = symbol.vertical ? b.y > a.y : b.x < a.x;
        }

        const size = symbolSize.evaluateSizeForFeature(sizeData, partiallyEvaluatedSize, symbol);
        const fontScale = size / 24;

        const glyphsForward = [];
        const glyphsBackward = [];

        const end = symbol.glyphStartIndex + symbol.numGlyphs;
        for (let glyphIndex = symbol.glyphStartIndex; glyphIndex < end; glyphIndex++) {
            const glyph = bucket.glyphOffsetArray.get(glyphIndex);
            if (glyph.offsetX > 0) {
                glyphsForward.push(glyph);
            } else {
                glyphsBackward.push(glyph);
            }
        }
        processDirection(glyphsForward, 1, flip, symbol, lineVertexArray, dynamicLayoutVertexArray, labelPlaneMatrix, fontScale);
        processDirection(glyphsBackward, -1, flip, symbol, lineVertexArray, dynamicLayoutVertexArray, labelPlaneMatrix, fontScale);
    }

    if (isText) {
        bucket.buffers.glyph.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray.serialize());
    } else {
        bucket.buffers.icon.dynamicLayoutVertexBuffer.updateData(dynamicLayoutVertexArray.serialize());
    }
}

function processDirection(glyphs, dir, flip, symbol, lineVertexArray, dynamicLayoutVertexArray, labelPlaneMatrix, fontScale) {
    const anchor = project(new Point(symbol.anchorX, symbol.anchorY), labelPlaneMatrix);

    assert(symbol.lineLength > 1);
    let prev = anchor;
    let next = prev;
    let vertexIndex = 0;
    let previousDistance = 0;
    let segmentDistance = 0;
    let segmentAngle = 0;

    let numVertices, vertexStartIndex;
    let angle = 0;

    if (flip) {
        dir *= -1;
        angle = Math.PI;
    }

    if (dir === 1) {
        numVertices = symbol.lineLength - symbol.segment - 1;
        vertexStartIndex = symbol.lineStartIndex + symbol.segment + 1;
    } else {
        numVertices = symbol.segment + 1;
        vertexStartIndex = symbol.lineStartIndex + symbol.segment;
        angle += Math.PI;
    }

    for (const glyph of glyphs) {
        const offsetX = Math.abs(glyph.offsetX) * fontScale;
        while (offsetX >= segmentDistance + previousDistance && Math.abs(vertexIndex) < numVertices) {
            previousDistance += segmentDistance;
            prev = next;
            const next_ = lineVertexArray.get(vertexStartIndex + vertexIndex);
            vertexIndex += dir;
            next = project(new Point(next_.x, next_.y), labelPlaneMatrix);
            segmentAngle = angle + Math.atan2(next.y - prev.y, next.x - prev.x);
            segmentDistance = prev.dist(next);
        }

        const p = next.sub(prev)._mult((offsetX - previousDistance) / segmentDistance)._add(prev);
        addGlyph(p, segmentAngle, dynamicLayoutVertexArray);
    }
}

function addGlyph(p, angle, dynamicLayoutVertexArray) {
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
}
