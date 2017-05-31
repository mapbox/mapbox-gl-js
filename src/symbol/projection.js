'use strict';

const Point = require('point-geometry');
const assert = require('assert');

const symbolSize = require('./symbol_size');

const mat4 = require('@mapbox/gl-matrix').mat4;
const vec4 = require('@mapbox/gl-matrix').vec4;


module.exports = {
    updateLineLabels: updateLineLabels,
    getPixelMatrix: getPixelMatrix,
    getGlCoordMatrix: getGlCoordMatrix
};

function getPixelMatrix(posMatrix, pitchWithMap, rotateWithMap, transform, pixelsToTileUnits) {
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

function isVisible(symbol, posMatrix, bufferX, bufferY, painter) {
    const p = project(new Point(symbol.anchorX, symbol.anchorY), posMatrix);
    const inPaddedViewport = p.x >= -bufferX && p.x <= bufferX && p.y >= -bufferY && p.y <= bufferY;
    return inPaddedViewport && painter.frameHistory.isVisible(symbol.placementZoom);
}

function updateLineLabels(bucket, posMatrix, painter, isText, rotateWithMap, pitchWithMap, keepUpright, pixelsToTileUnits, layer) {

    const sizeData = isText ? bucket.textSizeData : bucket.iconSizeData;
    const partiallyEvaluatedSize = symbolSize.evaluateSizeForZoom(sizeData, painter.transform, layer, isText);

    // matrix for converting from tile coordinates to the label plane
    const labelPlaneMatrix = getPixelMatrix(posMatrix, pitchWithMap, rotateWithMap, painter.transform, pixelsToTileUnits);

    const dynamicLayoutVertexArray = isText ?
        bucket.buffers.glyph.dynamicLayoutVertexArray :
        bucket.buffers.icon.dynamicLayoutVertexArray;

    dynamicLayoutVertexArray.clear();

    const placedSymbols = isText ? bucket.placedGlyphArray : bucket.placedIconArray;

    const bufferX = 256 / painter.width * 2 + 1;
    const bufferY = 256 / painter.height * 2 + 1;

    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);

        if (!isVisible(symbol, posMatrix, bufferX, bufferY, painter)) {
            const numVertices = symbol.numGlyphs * 4;
            for (let i = 0; i < numVertices; i++) {
                dynamicLayoutVertexArray.emplaceBack(-Infinity, -Infinity, 0);
            }
            painter.hiddenLabelCount++;
            continue;
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

        painter.labelCount++;
        painter.glyphCount += symbol.verticesLength;

        const lineVertexArray = bucket.lineVertexArray;

        let flip = false;
        if (keepUpright) {
            const a = project(lineVertexArray.get(symbol.lineStartIndex + symbol.segment), posMatrix);
            const b = project(lineVertexArray.get(symbol.lineStartIndex + symbol.segment + 1), posMatrix);

            if (symbol.vertical) {
                flip = b.y > a.y;
            } else {
                flip = b.x < a.x;
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
