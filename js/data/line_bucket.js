'use strict';

var ElementGroups = require('./element_groups');
var LineLayoutProperties = require('../style/layout_properties').line;

module.exports = LineBucket;

/**
 * @class LineBucket
 * @private
 */
function LineBucket(buffers, layoutDeclarations, paintDeclarations, _, zoom) {

    this.partiallyEvaluatedScales = {};
    var itemSize = 8;
    var offsets = {};

    var lineColor = paintDeclarations['line-color'];
    if (lineColor && !lineColor.calculate.isFeatureConstant) {
        offsets.color = itemSize;
        itemSize += 4;
        this.partiallyEvaluatedScales.color = lineColor.calculate(zoom);
    }

    var lineWidth = paintDeclarations['line-width'];
    if (lineWidth && !lineWidth.calculate.isFeatureConstant) {
        offsets.width = itemSize;
        itemSize += 4;
        this.partiallyEvaluatedScales.width = lineWidth.calculate(zoom);
    }

    var lineGapWidth = paintDeclarations['line-gap-width'];
    if (lineGapWidth && !lineGapWidth.calculate.isFeatureConstant) {
        offsets.gapWidth = itemSize;
        itemSize += 4;
        this.partiallyEvaluatedScales.gapWidth = lineGapWidth.calculate(zoom);
    }

    var lineBlur = paintDeclarations['line-blur'];
    if (lineBlur && !lineBlur.calculate.isFeatureConstant) {
        offsets.blur = itemSize;
        itemSize += 4;
        this.partiallyEvaluatedScales.blur = lineBlur.calculate(zoom);
    }

    var lineOpacity = paintDeclarations['line-opacity'];
    if (lineOpacity && !lineOpacity.calculate.isFeatureConstant) {
        offsets.opacity = itemSize;
        itemSize += 4;
        this.partiallyEvaluatedScales.opacity = lineOpacity.calculate(zoom);
    }

    this.buffers = buffers;
    this.elementGroups = new ElementGroups(buffers.lineVertex, buffers.lineElement);
    this.layoutDeclarations = layoutDeclarations;
    this.paintDeclarations = paintDeclarations;

    this.elementGroups.itemSize = itemSize;
    this.elementGroups.offsets = offsets;
}

LineBucket.prototype.addFeatures = function() {
    this.buffers.lineVertex.itemSize = this.elementGroups.itemSize;
    this.buffers.lineVertex.alignInitialPos();

    var features = this.features;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        this.addFeature(feature);
    }
};

LineBucket.prototype.addFeature = function(feature) {
    var lines = feature.loadGeometry();
    var layoutDeclarations = this.layoutDeclarations;

    var calculatedLayout = {};
    for (var k in layoutDeclarations) {
        calculatedLayout[k] = layoutDeclarations[k].calculate(this.zoom)(feature.properties);
    }
    var layoutProperties = new LineLayoutProperties(calculatedLayout);

    var lineVertex = this.buffers.lineVertex;
    var featureStartIndex = lineVertex.index;

    for (var i = 0; i < lines.length; i++) {
        this.addLine(lines[i],
            layoutProperties['line-join'],
            layoutProperties['line-cap'],
            layoutProperties['line-miter-limit'],
            layoutProperties['line-round-limit']);
    }

    var featureEndIndex = lineVertex.index;
    var offsets = this.elementGroups.offsets;
    var index;

    var colorOffset = offsets.color;
    var widthOffset = offsets.width;
    var gapWidthOffset = offsets.gapWidth;
    var blurOffset = offsets.blur;
    var opacityOffset = offsets.opacity;

    if (colorOffset !== undefined) {
        var color = this.partiallyEvaluatedScales.color(feature.properties);
        color = [color[0] * 255, color[1] * 255, color[2] * 255, color[3] * 255];
        for (index = featureStartIndex; index < featureEndIndex; index++) {
            lineVertex.addColor(index, colorOffset, color);
        }
    }

    if (widthOffset !== undefined) {
        var width = this.partiallyEvaluatedScales.width(feature.properties);
        for (index = featureStartIndex; index < featureEndIndex; index++) {
            lineVertex.addWidth(index, widthOffset, width);
        }
    }

    if (gapWidthOffset !== undefined) {
        var gapWidth = this.partiallyEvaluatedScales.gapWidth(feature.properties);
        for (index = featureStartIndex; index < featureEndIndex; index++) {
            lineVertex.addWidth(index, gapWidthOffset, gapWidth);
        }
    }

    if (blurOffset !== undefined) {
        var blur = this.partiallyEvaluatedScales.blur(feature.properties);
        for (index = featureStartIndex; index < featureEndIndex; index++) {
            lineVertex.addBlur(index, blurOffset, blur);
        }
    }

    if (blurOffset !== undefined) {
        var opacity = this.partiallyEvaluatedScales.opacity(feature.properties);
        for (index = featureStartIndex; index < featureEndIndex; index++) {
            lineVertex.addOpacity(index, opacityOffset, opacity);
        }
    }
};

LineBucket.prototype.addLine = function(vertices, join, cap, miterLimit, roundLimit) {

    var len = vertices.length;
    // If the line has duplicate vertices at the end, adjust length to remove them.
    while (len > 2 && vertices[len - 1].equals(vertices[len - 2])) {
        len--;
    }

    if (vertices.length < 2) {
        //console.warn('a line must have at least two vertices');
        return;
    }

    if (join === 'bevel') miterLimit = 1.05;

    var firstVertex = vertices[0],
        lastVertex = vertices[len - 1],
        closed = firstVertex.equals(lastVertex);

    // we could be more precise, but it would only save a negligible amount of space
    this.elementGroups.makeRoomFor(len * 4);

    if (len === 2 && closed) {
        // console.warn('a line may not have coincident points');
        return;
    }

    var beginCap = cap,
        endCap = closed ? 'butt' : cap,
        flip = 1,
        distance = 0,
        startOfLine = true,
        currentVertex, prevVertex, nextVertex, prevNormal, nextNormal, offsetA, offsetB;

    // the last three vertices added
    this.e1 = this.e2 = this.e3 = -1;

    if (closed) {
        currentVertex = vertices[len - 2];
        nextNormal = firstVertex.sub(currentVertex)._unit()._perp();
    }

    for (var i = 0; i < len; i++) {

        nextVertex = closed && i === len - 1 ?
            vertices[1] : // if the line is closed, we treat the last vertex like the first
            vertices[i + 1]; // just the next vertex

        // if two consecutive vertices exist, skip the current one
        if (nextVertex && vertices[i].equals(nextVertex)) continue;

        if (nextNormal) prevNormal = nextNormal;
        if (currentVertex) prevVertex = currentVertex;

        currentVertex = vertices[i];

        // Calculate how far along the line the currentVertex is
        if (prevVertex) distance += currentVertex.dist(prevVertex);

        // Calculate the normal towards the next vertex in this line. In case
        // there is no next vertex, pretend that the line is continuing straight,
        // meaning that we are just using the previous normal.
        nextNormal = nextVertex ? nextVertex.sub(currentVertex)._unit()._perp() : prevNormal;

        // If we still don't have a previous normal, this is the beginning of a
        // non-closed line, so we're doing a straight "join".
        prevNormal = prevNormal || nextNormal;

        // Determine the normal of the join extrusion. It is the angle bisector
        // of the segments between the previous line and the next line.
        var joinNormal = prevNormal.add(nextNormal)._unit();

        /*  joinNormal     prevNormal
         *             ↖      ↑
         *                .________. prevVertex
         *                |
         * nextNormal  ←  |  currentVertex
         *                |
         *     nextVertex !
         *
         */

        // Calculate the length of the miter (the ratio of the miter to the width).
        // Find the cosine of the angle between the next and join normals
        // using dot product. The inverse of that is the miter length.
        var cosHalfAngle = joinNormal.x * nextNormal.x + joinNormal.y * nextNormal.y;
        var miterLength = 1 / cosHalfAngle;

        // The join if a middle vertex, otherwise the cap.
        var middleVertex = prevVertex && nextVertex;
        var currentJoin = middleVertex ? join : nextVertex ? beginCap : endCap;

        if (middleVertex && currentJoin === 'round' && miterLength < roundLimit) {
            currentJoin = 'miter';
        }

        if (currentJoin === 'miter' && miterLength > miterLimit) {
            currentJoin = 'bevel';
        }

        if (currentJoin === 'bevel') {
            // The maximum extrude length is 128 / 63 = 2 times the width of the line
            // so if miterLength >= 2 we need to draw a different type of bevel where.
            if (miterLength > 2) currentJoin = 'flipbevel';

            // If the miterLength is really small and the line bevel wouldn't be visible,
            // just draw a miter join to save a triangle.
            if (miterLength < miterLimit) currentJoin = 'miter';
        }

        if (currentJoin === 'miter') {
            joinNormal._mult(miterLength);
            this.addCurrentVertex(currentVertex, flip, distance, joinNormal, 0, 0, false);

        } else if (currentJoin === 'flipbevel') {
            // miter is too big, flip the direction to make a beveled join

            if (miterLength > 100) {
                // Almost parallel lines
                joinNormal = nextNormal.clone();

            } else {
                var direction = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x > 0 ? -1 : 1;
                var bevelLength = miterLength * prevNormal.add(nextNormal).mag() / prevNormal.sub(nextNormal).mag();
                joinNormal._perp()._mult(bevelLength * direction);
            }
            this.addCurrentVertex(currentVertex, flip, distance, joinNormal, 0, 0, false);
            flip = -flip;

        } else if (currentJoin === 'bevel') {
            var dir = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x;
            var offset = -Math.sqrt(miterLength * miterLength - 1);
            if (flip * dir > 0) {
                offsetB = 0;
                offsetA = offset;
            } else {
                offsetA = 0;
                offsetB = offset;
            }

            // Close previous segment with a bevel
            if (!startOfLine) {
                this.addCurrentVertex(currentVertex, flip, distance, prevNormal, offsetA, offsetB, false);
            }

            // Start next segment
            if (nextVertex) {
                this.addCurrentVertex(currentVertex, flip, distance, nextNormal, -offsetA, -offsetB, false);
            }

        } else if (currentJoin === 'butt') {
            if (!startOfLine) {
                // Close previous segment with a butt
                this.addCurrentVertex(currentVertex, flip, distance, prevNormal, 0, 0, false);
            }

            // Start next segment with a butt
            if (nextVertex) {
                this.addCurrentVertex(currentVertex, flip, distance, nextNormal, 0, 0, false);
            }

        } else if (currentJoin === 'square') {

            if (!startOfLine) {
                // Close previous segment with a square cap
                this.addCurrentVertex(currentVertex, flip, distance, prevNormal, 1, 1, false);

                // The segment is done. Unset vertices to disconnect segments.
                this.e1 = this.e2 = -1;
                flip = 1;
            }

            // Start next segment
            if (nextVertex) {
                this.addCurrentVertex(currentVertex, flip, distance, nextNormal, -1, -1, false);
            }

        } else if (currentJoin === 'round') {

            if (!startOfLine) {
                // Close previous segment with butt
                this.addCurrentVertex(currentVertex, flip, distance, prevNormal, 0, 0, false);

                // Add round cap or linejoin at end of segment
                this.addCurrentVertex(currentVertex, flip, distance, prevNormal, 1, 1, true);

                // The segment is done. Unset vertices to disconnect segments.
                this.e1 = this.e2 = -1;
                flip = 1;

            } else if (beginCap === 'round') {
                // Add round cap before first segment
                this.addCurrentVertex(currentVertex, flip, distance, nextNormal, -1, -1, true);
            }

            // Start next segment with a butt
            if (nextVertex) {
                this.addCurrentVertex(currentVertex, flip, distance, nextNormal, 0, 0, false);
            }
        }

        startOfLine = false;
    }


};

/**
 * Add two vertices to the buffers.
 *
 * @param {Object} currentVertex the line vertex to add buffer vertices for
 * @param {number} flip -1 if the vertices should be flipped, 1 otherwise
 * @param {number} distance the distance from the beggining of the line to the vertex
 * @param {number} endLeft extrude to shift the left vertex along the line
 * @param {number} endRight extrude to shift the left vertex along the line
 * @param {boolean} round whether this is a round cap
 * @private
 */
LineBucket.prototype.addCurrentVertex = function(currentVertex, flip, distance, normal, endLeft, endRight, round) {
    var tx = round ? 1 : 0;
    var extrude;

    var lineVertex = this.buffers.lineVertex;
    var lineElement = this.buffers.lineElement;
    var elementGroup = this.elementGroups.current;
    var vertexStartIndex = this.elementGroups.current.vertexStartIndex;

    extrude = normal.mult(flip);
    if (endLeft) extrude._sub(normal.perp()._mult(endLeft));
    this.e3 = lineVertex.add(currentVertex, extrude, tx, 0, distance) - vertexStartIndex;
    if (this.e1 >= 0 && this.e2 >= 0) {
        lineElement.add(this.e1, this.e2, this.e3);
        elementGroup.elementLength++;
    }
    this.e1 = this.e2;
    this.e2 = this.e3;

    extrude = normal.mult(-flip);
    if (endRight) extrude._sub(normal.perp()._mult(endRight));
    this.e3 = lineVertex.add(currentVertex, extrude, tx, 1, distance) - vertexStartIndex;
    if (this.e1 >= 0 && this.e2 >= 0) {
        lineElement.add(this.e1, this.e2, this.e3);
        elementGroup.elementLength++;
    }
    this.e1 = this.e2;
    this.e2 = this.e3;

    elementGroup.vertexLength += 2;
};
