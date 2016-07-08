'use strict';

var Bucket = require('../bucket');
var util = require('../../util/util');
var loadGeometry = require('../load_geometry');
var EXTENT = Bucket.EXTENT;

// NOTE ON EXTRUDE SCALE:
// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.
var EXTRUDE_SCALE = 63;

/*
 * Sharp corners cause dashed lines to tilt because the distance along the line
 * is the same at both the inner and outer corners. To improve the appearance of
 * dashed lines we add extra points near sharp corners so that a smaller part
 * of the line is tilted.
 *
 * COS_HALF_SHARP_CORNER controls how sharp a corner has to be for us to add an
 * extra vertex. The default is 75 degrees.
 *
 * The newly created vertices are placed SHARP_CORNER_OFFSET pixels from the corner.
 */
var COS_HALF_SHARP_CORNER = Math.cos(75 / 2 * (Math.PI / 180));
var SHARP_CORNER_OFFSET = 15;

// The number of bits that is used to store the line distance in the buffer.
var LINE_DISTANCE_BUFFER_BITS = 15;

// We don't have enough bits for the line distance as we'd like to have, so
// use this value to scale the line distance (in tile units) down to a smaller
// value. This lets us store longer distances while sacrificing precision.
var LINE_DISTANCE_SCALE = 1 / 2;

// The maximum line distance, in tile units, that fits in the buffer.
var MAX_LINE_DISTANCE = Math.pow(2, LINE_DISTANCE_BUFFER_BITS - 1) / LINE_DISTANCE_SCALE;


module.exports = LineBucket;

/**
 * @private
 */
function LineBucket() {
    Bucket.apply(this, arguments);
}

LineBucket.prototype = util.inherit(Bucket, {});

LineBucket.prototype.addLineVertex = function(layoutVertexBuffer, point, extrude, tx, ty, dir, linesofar) {
    return layoutVertexBuffer.emplaceBack(
            // a_pos
            (point.x << 1) | tx,
            (point.y << 1) | ty,
            // a_data
            // add 128 to store an byte in an unsigned byte
            Math.round(EXTRUDE_SCALE * extrude.x) + 128,
            Math.round(EXTRUDE_SCALE * extrude.y) + 128,
            // Encode the -1/0/1 direction value into the first two bits of .z of a_data.
            // Combine it with the lower 6 bits of `linesofar` (shifted by 2 bites to make
            // room for the direction value). The upper 8 bits of `linesofar` are placed in
            // the `w` component. `linesofar` is scaled down by `LINE_DISTANCE_SCALE` so that
            // we can store longer distances while sacrificing precision.
            ((dir === 0 ? 0 : (dir < 0 ? -1 : 1)) + 1) | (((linesofar * LINE_DISTANCE_SCALE) & 0x3F) << 2),
            (linesofar * LINE_DISTANCE_SCALE) >> 6);
};

LineBucket.prototype.programInterfaces = {
    line: {
        layoutVertexArrayType: new Bucket.VertexArrayType([{
            name: 'a_pos',
            components: 2,
            type: 'Int16'
        }, {
            name: 'a_data',
            components: 4,
            type: 'Uint8'
        }]),
        elementArrayType: new Bucket.ElementArrayType()
    }
};

LineBucket.prototype.addFeature = function(feature) {
    var lines = loadGeometry(feature, LINE_DISTANCE_BUFFER_BITS);
    for (var i = 0; i < lines.length; i++) {
        this.addLine(
            lines[i],
            this.layer.layout['line-join'],
            this.layer.layout['line-cap'],
            this.layer.layout['line-miter-limit'],
            this.layer.layout['line-round-limit']
        );
    }
};

LineBucket.prototype.addLine = function(vertices, join, cap, miterLimit, roundLimit) {

    var len = vertices.length;
    // If the line has duplicate vertices at the end, adjust length to remove them.
    while (len > 2 && vertices[len - 1].equals(vertices[len - 2])) {
        len--;
    }

    // a line must have at least two vertices
    if (vertices.length < 2) return;

    if (join === 'bevel') miterLimit = 1.05;

    var sharpCornerOffset = SHARP_CORNER_OFFSET * (EXTENT / (512 * this.overscaling));

    var firstVertex = vertices[0],
        lastVertex = vertices[len - 1],
        closed = firstVertex.equals(lastVertex);

    // we could be more precise, but it would only save a negligible amount of space
    this.prepareArrayGroup('line', len * 10);

    // a line may not have coincident points
    if (len === 2 && closed) return;

    this.distance = 0;

    var beginCap = cap,
        endCap = closed ? 'butt' : cap,
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

        var isSharpCorner = cosHalfAngle < COS_HALF_SHARP_CORNER && prevVertex && nextVertex;

        if (isSharpCorner && i > 0) {
            var prevSegmentLength = currentVertex.dist(prevVertex);
            if (prevSegmentLength > 2 * sharpCornerOffset) {
                var newPrevVertex = currentVertex.sub(currentVertex.sub(prevVertex)._mult(sharpCornerOffset / prevSegmentLength)._round());
                this.distance += newPrevVertex.dist(prevVertex);
                this.addCurrentVertex(newPrevVertex, this.distance, prevNormal.mult(1), 0, 0, false);
                prevVertex = newPrevVertex;
            }
        }

        // The join if a middle vertex, otherwise the cap.
        var middleVertex = prevVertex && nextVertex;
        var currentJoin = middleVertex ? join : nextVertex ? beginCap : endCap;

        if (middleVertex && currentJoin === 'round') {
            if (miterLength < roundLimit) {
                currentJoin = 'miter';
            } else if (miterLength <= 2) {
                currentJoin = 'fakeround';
            }
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

        // Calculate how far along the line the currentVertex is
        if (prevVertex) this.distance += currentVertex.dist(prevVertex);

        if (currentJoin === 'miter') {

            joinNormal._mult(miterLength);
            this.addCurrentVertex(currentVertex, this.distance, joinNormal, 0, 0, false);

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
            this.addCurrentVertex(currentVertex, this.distance, joinNormal, 0, 0, false);
            this.addCurrentVertex(currentVertex, this.distance, joinNormal.mult(-1), 0, 0, false);

        } else if (currentJoin === 'bevel' || currentJoin === 'fakeround') {
            var lineTurnsLeft = (prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x) > 0;
            var offset = -Math.sqrt(miterLength * miterLength - 1);
            if (lineTurnsLeft) {
                offsetB = 0;
                offsetA = offset;
            } else {
                offsetA = 0;
                offsetB = offset;
            }

            // Close previous segment with a bevel
            if (!startOfLine) {
                this.addCurrentVertex(currentVertex, this.distance, prevNormal, offsetA, offsetB, false);
            }

            if (currentJoin === 'fakeround') {
                // The join angle is sharp enough that a round join would be visible.
                // Bevel joins fill the gap between segments with a single pie slice triangle.
                // Create a round join by adding multiple pie slices. The join isn't actually round, but
                // it looks like it is at the sizes we render lines at.

                // Add more triangles for sharper angles.
                // This math is just a good enough approximation. It isn't "correct".
                var n = Math.floor((0.5 - (cosHalfAngle - 0.5)) * 8);
                var approxFractionalJoinNormal;

                for (var m = 0; m < n; m++) {
                    approxFractionalJoinNormal = nextNormal.mult((m + 1) / (n + 1))._add(prevNormal)._unit();
                    this.addPieSliceVertex(currentVertex, this.distance, approxFractionalJoinNormal, lineTurnsLeft);
                }

                this.addPieSliceVertex(currentVertex, this.distance, joinNormal, lineTurnsLeft);

                for (var k = n - 1; k >= 0; k--) {
                    approxFractionalJoinNormal = prevNormal.mult((k + 1) / (n + 1))._add(nextNormal)._unit();
                    this.addPieSliceVertex(currentVertex, this.distance, approxFractionalJoinNormal, lineTurnsLeft);
                }
            }

            // Start next segment
            if (nextVertex) {
                this.addCurrentVertex(currentVertex, this.distance, nextNormal, -offsetA, -offsetB, false);
            }

        } else if (currentJoin === 'butt') {
            if (!startOfLine) {
                // Close previous segment with a butt
                this.addCurrentVertex(currentVertex, this.distance, prevNormal, 0, 0, false);
            }

            // Start next segment with a butt
            if (nextVertex) {
                this.addCurrentVertex(currentVertex, this.distance, nextNormal, 0, 0, false);
            }

        } else if (currentJoin === 'square') {

            if (!startOfLine) {
                // Close previous segment with a square cap
                this.addCurrentVertex(currentVertex, this.distance, prevNormal, 1, 1, false);

                // The segment is done. Unset vertices to disconnect segments.
                this.e1 = this.e2 = -1;
            }

            // Start next segment
            if (nextVertex) {
                this.addCurrentVertex(currentVertex, this.distance, nextNormal, -1, -1, false);
            }

        } else if (currentJoin === 'round') {

            if (!startOfLine) {
                // Close previous segment with butt
                this.addCurrentVertex(currentVertex, this.distance, prevNormal, 0, 0, false);

                // Add round cap or linejoin at end of segment
                this.addCurrentVertex(currentVertex, this.distance, prevNormal, 1, 1, true);

                // The segment is done. Unset vertices to disconnect segments.
                this.e1 = this.e2 = -1;
            }


            // Start next segment with a butt
            if (nextVertex) {
                // Add round cap before first segment
                this.addCurrentVertex(currentVertex, this.distance, nextNormal, -1, -1, true);

                this.addCurrentVertex(currentVertex, this.distance, nextNormal, 0, 0, false);
            }
        }

        if (isSharpCorner && i < len - 1) {
            var nextSegmentLength = currentVertex.dist(nextVertex);
            if (nextSegmentLength > 2 * sharpCornerOffset) {
                var newCurrentVertex = currentVertex.add(nextVertex.sub(currentVertex)._mult(sharpCornerOffset / nextSegmentLength)._round());
                this.distance += newCurrentVertex.dist(currentVertex);
                this.addCurrentVertex(newCurrentVertex, this.distance, nextNormal.mult(1), 0, 0, false);
                currentVertex = newCurrentVertex;
            }
        }

        startOfLine = false;
    }

};

/**
 * Add two vertices to the buffers.
 *
 * @param {Object} currentVertex the line vertex to add buffer vertices for
 * @param {number} distance the distance from the beginning of the line to the vertex
 * @param {number} endLeft extrude to shift the left vertex along the line
 * @param {number} endRight extrude to shift the left vertex along the line
 * @param {boolean} round whether this is a round cap
 * @private
 */
LineBucket.prototype.addCurrentVertex = function(currentVertex, distance, normal, endLeft, endRight, round) {
    var tx = round ? 1 : 0;
    var extrude;
    var arrayGroup = this.arrayGroups.line[this.arrayGroups.line.length - 1];
    var layoutVertexArray = arrayGroup.layoutVertexArray;
    var elementArray = arrayGroup.elementArray;

    extrude = normal.clone();
    if (endLeft) extrude._sub(normal.perp()._mult(endLeft));
    this.e3 = this.addLineVertex(layoutVertexArray, currentVertex, extrude, tx, 0, endLeft, distance);
    if (this.e1 >= 0 && this.e2 >= 0) {
        elementArray.emplaceBack(this.e1, this.e2, this.e3);
    }
    this.e1 = this.e2;
    this.e2 = this.e3;

    extrude = normal.mult(-1);
    if (endRight) extrude._sub(normal.perp()._mult(endRight));
    this.e3 = this.addLineVertex(layoutVertexArray, currentVertex, extrude, tx, 1, -endRight, distance);
    if (this.e1 >= 0 && this.e2 >= 0) {
        elementArray.emplaceBack(this.e1, this.e2, this.e3);
    }
    this.e1 = this.e2;
    this.e2 = this.e3;

    // There is a maximum "distance along the line" that we can store in the buffers.
    // When we get close to the distance, reset it to zero and add the vertex again with
    // a distance of zero. The max distance is determined by the number of bits we allocate
    // to `linesofar`.
    if (distance > MAX_LINE_DISTANCE / 2) {
        this.distance = 0;
        this.addCurrentVertex(currentVertex, this.distance, normal, endLeft, endRight, round);
    }
};

/**
 * Add a single new vertex and a triangle using two previous vertices.
 * This adds a pie slice triangle near a join to simulate round joins
 *
 * @param {Object} currentVertex the line vertex to add buffer vertices for
 * @param {number} distance the distance from the beggining of the line to the vertex
 * @param {Object} extrude the offset of the new vertex from the currentVertex
 * @param {boolean} whether the line is turning left or right at this angle
 * @private
 */
LineBucket.prototype.addPieSliceVertex = function(currentVertex, distance, extrude, lineTurnsLeft) {
    var ty = lineTurnsLeft ? 1 : 0;
    extrude = extrude.mult(lineTurnsLeft ? -1 : 1);
    var arrayGroup = this.arrayGroups.line[this.arrayGroups.line.length - 1];
    var layoutVertexArray = arrayGroup.layoutVertexArray;
    var elementArray = arrayGroup.elementArray;

    this.e3 = this.addLineVertex(layoutVertexArray, currentVertex, extrude, 0, ty, 0, distance);

    if (this.e1 >= 0 && this.e2 >= 0) {
        elementArray.emplaceBack(this.e1, this.e2, this.e3);
    }

    if (lineTurnsLeft) {
        this.e2 = this.e3;
    } else {
        this.e1 = this.e3;
    }
};
