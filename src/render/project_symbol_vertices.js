'use strict';

const Point = require('point-geometry');
const Buffer = require('../data/buffer');
const createStructArrayType = require('../util/struct_array');
const interpolate = require('../style-spec/util/interpolate');

const mat4 = require('@mapbox/gl-matrix').mat4;
const vec4 = require('@mapbox/gl-matrix').vec4;

const VertexPositionArray = createStructArrayType({
    members: [
        { type: 'Float32', name: 'a_projected_pos', components: 2 }
    ]
});

module.exports = projectSymbolVertices;

function project(point, matrix) {
    const pos = [point.x, point.y, 0, 1];
    vec4.transformMat4(pos, pos, matrix);
    return new Point(pos[0] / pos[3], pos[1] / pos[3]);
}

function projectSymbolVertices(bucket, tileMatrix, painter, rotateWithMap, pitchWithMap, pixelsToTileUnits, layer) {

    const partiallyEvaluatedSize = evaluateSizeForZoom(bucket, layer, painter.transform);

    // matrix for converting from tile coordinates to the label plane
    const labelPlaneMatrix = new Float64Array(16);
    // matrix for converting from the lable plane to gl coords
    const glCoordMatrix = new Float64Array(16);

    const tr = painter.transform;

    if (false && pitchWithMap) {
        const s = 1 / pixelsToTileUnits;
        mat4.identity(labelPlaneMatrix);
        mat4.scale(labelPlaneMatrix, labelPlaneMatrix, [s, s, 1]);

        mat4.identity(glCoordMatrix);
        mat4.multiply(glCoordMatrix, glCoordMatrix, tileMatrix);
        mat4.scale(glCoordMatrix, glCoordMatrix, [1 / s, 1 / s, 1]);

        if (!rotateWithMap) {
            mat4.rotateZ(labelPlaneMatrix, labelPlaneMatrix, tr.angle);
            mat4.rotateZ(glCoordMatrix, glCoordMatrix, -tr.angle);
        }

    } else {
        const m = mat4.create();
        mat4.scale(m, m, [tr.width / 2, -tr.height / 2, 1]);
        mat4.translate(m, m, [1, -1, 0]);
        mat4.multiply(labelPlaneMatrix, m, tileMatrix);

        mat4.identity(glCoordMatrix);
        mat4.scale(glCoordMatrix, glCoordMatrix, [1, -1, 1]);
        mat4.translate(glCoordMatrix, glCoordMatrix, [-1, -1, 0]);
        mat4.scale(glCoordMatrix, glCoordMatrix, [2 / tr.width, 2 / tr.height, 1]);
    }

    const vertexPositions = new VertexPositionArray();

    const placedSymbols = bucket.placedSymbolArray;
    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);
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

        processDirection(glyphsForward, 1, symbol, line, bucket.lineVertexArray, vertexPositions, labelPlaneMatrix, glCoordMatrix, fontScale);
        processDirection(glyphsBackward, -1, symbol, line, bucket.lineVertexArray, vertexPositions, labelPlaneMatrix, glCoordMatrix, fontScale);
    }
    return new Buffer(vertexPositions.serialize(), VertexPositionArray.serialize(), Buffer.BufferType.VERTEX);
}

function processDirection(glyphs, dir, symbol, line, lineVertexArray, vertexPositions, labelPlaneMatrix, glCoordMatrix, fontScale) {
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
            addGlyph(p, glyph, fontScale, segmentAngle, vertexPositions, glCoordMatrix);
        }
    } else {
        const angle = 0;
        for (const glyph of glyphs) {
            const p = anchor.clone();
            p.x += glyph.offsetX * fontScale;
            addGlyph(p, glyph, fontScale, angle, vertexPositions, glCoordMatrix);
        }
    }
}

function addGlyph(p, glyph, fontScale, angle, vertexPositions, glCoordMatrix) {
    const tl = project(p.add(new Point(glyph.tlX, glyph.offsetY + glyph.tlY)._mult(fontScale)._rotate(angle)), glCoordMatrix);
    const tr = project(p.add(new Point(glyph.brX, glyph.offsetY + glyph.tlY)._mult(fontScale)._rotate(angle)), glCoordMatrix);
    const bl = project(p.add(new Point(glyph.tlX, glyph.offsetY + glyph.brY)._mult(fontScale)._rotate(angle)), glCoordMatrix);
    const br = project(p.add(new Point(glyph.brX, glyph.offsetY + glyph.brY)._mult(fontScale)._rotate(angle)), glCoordMatrix);
    vertexPositions.emplaceBack(tl.x, tl.y);
    vertexPositions.emplaceBack(tr.x, tr.y);
    vertexPositions.emplaceBack(bl.x, bl.y);
    vertexPositions.emplaceBack(br.x, br.y);
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
