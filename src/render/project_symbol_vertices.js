'use strict';

const Point = require('point-geometry');
const Buffer = require('../data/buffer');
const createStructArrayType = require('../util/struct_array');
const interpolate = require('../style-spec/util/interpolate');

const mat4 = require('@mapbox/gl-matrix').mat4;
const vec4 = require('@mapbox/gl-matrix').vec4;

const VertexPositionArray = createStructArrayType({
    alignmnet: 4,
    members: [
        { type: 'Float32', name: 'a_projected_pos', components: 3 }
    ]
});

const serializedVertexPositionArrayType = VertexPositionArray.serialize();

module.exports = {
    project: projectSymbolVertices,
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

function projectSymbolVertices(bucket, posMatrix, painter, isText, rotateWithMap, pitchWithMap, keepUpright, alongLine, pixelsToTileUnits, layer) {

    const partiallyEvaluatedSize = evaluateSizeForZoom(bucket, layer, painter.transform);

    // matrix for converting from tile coordinates to the label plane
    const labelPlaneMatrix = getPixelMatrix(posMatrix, pitchWithMap, rotateWithMap, painter.transform, pixelsToTileUnits);

    let vertexPositions;

    if (isText) {
        if (bucket.glyphVertexPositions === undefined) {
            bucket.glyphVertexPositions = new VertexPositionArray();
        } else {
            bucket.glyphVertexPositions.clear();
        }
        vertexPositions = bucket.glyphVertexPositions;
    } else {
        if (bucket.iconVertexPositions === undefined) {
            bucket.iconVertexPositions = new VertexPositionArray();
        } else {
            bucket.iconVertexPositions.clear();
        }
        vertexPositions = bucket.iconVertexPositions;
    }

    const placedSymbols = isText ? bucket.placedGlyphArray : bucket.placedIconArray;

    const bufferX = 256 / painter.width * 2 + 1;
    const bufferY = 256 / painter.height * 2 + 1;

    for (let s = 0; s < placedSymbols.length; s++) {
        const symbol = placedSymbols.get(s);

        if (!isVisible(symbol, posMatrix, bufferX, bufferY, painter)) {
            const numVertices = symbol.numGlyphs * 4;
            for (let i = 0; i < numVertices; i++) {
                vertexPositions.emplaceBack(-Infinity, -Infinity, 0);
            }
            painter.hiddenLabelCount++;
            continue;
        }

        const size = evaluateSizeForFeature(bucket, partiallyEvaluatedSize, symbol);
        const fontScale = size / 24;

        if (!alongLine) {
            painter.pointLabelCount++;
            const numVertices = symbol.numGlyphs * 4;
            const anchor = project(new Point(symbol.anchorX, symbol.anchorY), labelPlaneMatrix);
            for (let i = 0; i < numVertices; i++) {
                vertexPositions.emplaceBack(anchor.x, anchor.y, 0);
            }
            continue;
        }

        const line = bucket.lineArray.get(symbol.lineIndex);

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
            const a = project(lineVertexArray.get(line.startIndex + symbol.segment), posMatrix);
            const b = project(lineVertexArray.get(line.startIndex + symbol.segment + 1), posMatrix);

            if (symbol.vertical) {
                flip = b.y > a.y;
            } else {
                flip = b.x < a.x;
            }
        }

        processDirection(glyphsForward, 1, flip, symbol, line, lineVertexArray, vertexPositions, labelPlaneMatrix, fontScale);
        processDirection(glyphsBackward, -1, flip, symbol, line, lineVertexArray, vertexPositions, labelPlaneMatrix, fontScale);
    }

    if (isText) {
        if (bucket.glyphVertexPositionBuffer === undefined) {
            // TODO avoid leaking this buffer
            bucket.glyphVertexPositionBuffer = new Buffer(vertexPositions.serialize(), serializedVertexPositionArrayType, Buffer.BufferType.VERTEX, true);
        } else {
            bucket.glyphVertexPositionBuffer.updateData(vertexPositions.serialize());
        }
        return bucket.glyphVertexPositionBuffer;
    } else {
        if (bucket.iconVertexPositionBuffer === undefined) {
            // TODO avoid leaking this buffer
            bucket.iconVertexPositionBuffer = new Buffer(vertexPositions.serialize(), serializedVertexPositionArrayType, Buffer.BufferType.VERTEX, true);
        } else {
            bucket.iconVertexPositionBuffer.updateData(vertexPositions.serialize());
        }
        return bucket.iconVertexPositionBuffer;
    }
}

function processDirection(glyphs, dir, flip, symbol, line, lineVertexArray, vertexPositions, labelPlaneMatrix, fontScale) {
    const anchor = project(new Point(symbol.anchorX, symbol.anchorY), labelPlaneMatrix);
    if (line.length > 1) {
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
            numVertices = line.length - symbol.segment - 1;
            vertexStartIndex = line.startIndex + symbol.segment + 1;
        } else {
            numVertices = symbol.segment + 1;
            vertexStartIndex = line.startIndex + symbol.segment;
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
            addGlyph(p, segmentAngle, vertexPositions);
        }
    } else {
        const angle = 0;
        for (const glyph of glyphs) {
            addGlyph(anchor, angle, vertexPositions);
        }
    }
}

function addGlyph(p, angle, vertexPositions) {
    vertexPositions.emplaceBack(p.x, p.y, angle);
    vertexPositions.emplaceBack(p.x, p.y, angle);
    vertexPositions.emplaceBack(p.x, p.y, angle);
    vertexPositions.emplaceBack(p.x, p.y, angle);
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
