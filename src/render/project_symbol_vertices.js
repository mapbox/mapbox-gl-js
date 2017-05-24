'use strict';

const Point = require('point-geometry');
const Buffer = require('../data/buffer');
const createStructArrayType = require('../util/struct_array');
const interpolate = require('../style-spec/util/interpolate');

const mat4 = require('@mapbox/gl-matrix').mat4;
const vec4 = require('@mapbox/gl-matrix').vec4;

const VertexPositionArray = createStructArrayType({
    members: [
        { type: 'Float32', name: 'a_projected_pos', components: 4 }
    ]
});

module.exports = {
    project: projectSymbolVertices,
    getPixelMatrix: getPixelMatrix,
    getGlCoordMatrix: getGlCoordMatrix
};

function getPixelMatrix(posMatrix, pitchWithMap, rotateWithMap, transform, pixelsToTileUnits) {
    const m = mat4.identity(new Float32Array(16));
    if (false && pitchWithMap) {
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
    if (false && pitchWithMap) {
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

function isVisible(anchor, posMatrix) {
    const p = project(anchor, posMatrix);
    return p.x >= -1 && p.x <= 1 && p.y >= -1 && p.y <= 1;
}

function projectSymbolVertices(bucket, posMatrix, painter, rotateWithMap, pitchWithMap, pixelsToTileUnits, layer) {

    const partiallyEvaluatedSize = evaluateSizeForZoom(bucket, layer, painter.transform);

    // matrix for converting from tile coordinates to the label plane
    const labelPlaneMatrix = getPixelMatrix(posMatrix, pitchWithMap, rotateWithMap, painter.transform, pixelsToTileUnits);

    const vertexPositions = new VertexPositionArray();

    const placedSymbols = bucket.placedSymbolArray;
    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);

        if (!isVisible(new Point(symbol.anchorX, symbol.anchorY), posMatrix)) {
            const numVertices = symbol.verticesLength * 4;
            for (let i = 0; i < numVertices; i++) {
                vertexPositions.emplaceBack(0, 0, 0, 0);
            }
            painter.hiddenLabelCount++;
            continue;
        }

        const line = bucket.lineArray.get(symbol.lineIndex);
        const size = evaluateSizeForFeature(bucket, partiallyEvaluatedSize, symbol);
        const fontScale = size / 24;

        const glyphsForward = [];
        const glyphsBackward = [];

        const end = symbol.verticesStart + symbol.verticesLength;
        for (let vertexIndex = symbol.verticesStart; vertexIndex < end; vertexIndex++) {
            const vertex = bucket.vertexTransformArray.get(vertexIndex);
            if (vertex.offsetX >= 0) {
                glyphsForward.push(vertex);
            } else {
                glyphsBackward.push(vertex);
            }
        }

        painter.labelCount++;
        painter.glyphCount += symbol.verticesLength;

        processDirection(glyphsForward, 1, symbol, line, bucket.lineVertexArray, vertexPositions, labelPlaneMatrix, fontScale);
        processDirection(glyphsBackward, -1, symbol, line, bucket.lineVertexArray, vertexPositions, labelPlaneMatrix, fontScale);
    }
    return new Buffer(vertexPositions.serialize(), VertexPositionArray.serialize(), Buffer.BufferType.VERTEX);
}

function processDirection(glyphs, dir, symbol, line, lineVertexArray, vertexPositions, labelPlaneMatrix, fontScale) {
    const anchor = project(new Point(symbol.anchorX, symbol.anchorY), labelPlaneMatrix);
    if (line.length > 1) {
        let prev = anchor;
        let next = prev;
        let vertexIndex = 0;
        let previousDistance = 0;
        let segmentDistance = 0;
        let segmentAngle = 0;

        let numVertices, vertexStartIndex, angle;
        if (dir === 1) {
            numVertices = line.length - symbol.segment;
            vertexStartIndex = line.startIndex + symbol.segment + 1;
            angle = 0;
        } else {
            numVertices = symbol.segment + 1;
            vertexStartIndex = line.startIndex + symbol.segment;
            angle = Math.PI;
        }

        for (const glyph of glyphs) {
            const offsetX = Math.abs(glyph.offsetX) * fontScale;
            while (offsetX >= segmentDistance + previousDistance && vertexIndex < numVertices) {
                previousDistance += segmentDistance;
                prev = next;
                const next_ = lineVertexArray.get(vertexStartIndex + vertexIndex);
                vertexIndex++;
                next = project(new Point(next_.x, next_.y), labelPlaneMatrix);
                segmentAngle = angle + Math.atan2(next.y - prev.y, next.x - prev.x);
                segmentDistance = prev.dist(next);
            }

            const p = next.sub(prev)._mult((offsetX - previousDistance) / segmentDistance)._add(prev);
            addGlyph(p, fontScale, segmentAngle, vertexPositions);
        }
    } else {
        const angle = 0;
        for (const glyph of glyphs) {
            addGlyph(anchor, fontScale, angle, vertexPositions);
        }
    }
}

function addGlyph(p, fontScale, angle, vertexPositions) {
    vertexPositions.emplaceBack(p.x, p.y, angle, fontScale);
    vertexPositions.emplaceBack(p.x, p.y, angle, fontScale);
    vertexPositions.emplaceBack(p.x, p.y, angle, fontScale);
    vertexPositions.emplaceBack(p.x, p.y, angle, fontScale);
}

function evaluateSizeForZoom(bucket, layer, transform) {
    const sizeProperty = 'text-size';
    const sizeData = bucket.textSizeData;
    if (sizeData.isFeatureConstant) {
        return { size: layer.getLayoutValue(sizeProperty, { zoom: transform.zoom }) };
    } else {
        if (sizeData.isZoomConstant) {
            return {};
        } else {
            return { t: layer.getLayoutInterpolationT(sizeProperty, { zoom: transform.zoom }) };
        }
    }
}

function evaluateSizeForFeature(bucket, partiallyEvaluatedSize, symbol) {
    const sizeData = bucket.textSizeData;
    if (sizeData.isFeatureConstant) {
        return partiallyEvaluatedSize.size;
    } else {
        if (sizeData.isZoomConstant) {
            return bucket.zoomStopArray.get(symbol.sizeStopStart).textSize;
        } else {
            const offset = symbol.sizeStopStart;
            const a = bucket.zoomStopArray.get(offset + Math.floor(partiallyEvaluatedSize.t));
            const b = bucket.zoomStopArray.get(offset + Math.ceil(partiallyEvaluatedSize.t));
            return interpolate.number(a.textSize, b.textSize, partiallyEvaluatedSize.t % 1);
        }
    }
}
