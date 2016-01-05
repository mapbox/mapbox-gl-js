'use strict';

var Bucket = require('./bucket');
var util = require('../util/util');

// NOTE ON EXTRUDE SCALE:
// scale the extrusion vector so that the normal length is this value.
// contains the "texture" normals (-1..1). this is distinct from the extrude
// normals for line joins, because the x-value remains 0 for the texture
// normal array, while the extrude normal actually moves the vertex to create
// the acute/bevelled line join.
var EXTRUDE_SCALE = 63;

module.exports = LineBucket;

function LineBucket() {
    Bucket.apply(this, arguments);
}

LineBucket.prototype = util.inherit(Bucket, {});

LineBucket.prototype.shaders = {
    line: {
        vertexBuffer: true,
        elementBuffer: true,

        attributeArgs: ['point', 'extrude', 'tx', 'ty', 'dir', 'linesofar'],

        attributes: [{
            name: 'pos',
            components: 2,
            type: Bucket.AttributeType.SHORT,
            value: [
                '(point.x << 1) | tx',
                '(point.y << 1) | ty'
            ]
        }, {
            name: 'data',
            components: 4,
            type: Bucket.AttributeType.BYTE,
            value: [
                'Math.round(' + EXTRUDE_SCALE + ' * extrude.x)',
                'Math.round(' + EXTRUDE_SCALE + ' * extrude.y)',

                // Encode the -1/0/1 direction value into .zw coordinates of a_data, which is normally covered
                // by linesofar, so we need to merge them.
                // The z component's first bit, as well as the sign bit is reserved for the direction,
                // so we need to shift the linesofar.
                '((dir < 0) ? -1 : 1) * ((dir ? 1 : 0) | ((linesofar << 1) & 0x7F))',
                '(linesofar >> 6) & 0x7F'
            ]
        }]
    }
};

LineBucket.prototype.addFeature = function(feature) {
    var lines = feature.loadGeometry();
    var layoutProperties = this.layoutProperties;
    for (var i = 0; i < lines.length; i++) {
        this.addLine(
            lines[i],
            layoutProperties['line-join'],
            layoutProperties['line-cap'],
            layoutProperties['line-miter-limit'],
            layoutProperties['line-round-limit']
        );
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
    this.makeRoomFor('line', len * 10);

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
            this.addCurrentVertex(currentVertex, -flip, distance, joinNormal, 0, 0, false);

        } else if (currentJoin === 'bevel' || currentJoin === 'fakeround') {
            var lineTurnsLeft = flip * (prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x) > 0;
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
                this.addCurrentVertex(currentVertex, flip, distance, prevNormal, offsetA, offsetB, false);
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
                    this.addPieSliceVertex(currentVertex, flip, distance, approxFractionalJoinNormal, lineTurnsLeft);
                }

                this.addPieSliceVertex(currentVertex, flip, distance, joinNormal, lineTurnsLeft);

                for (var k = n - 1; k >= 0; k--) {
                    approxFractionalJoinNormal = prevNormal.mult((k + 1) / (n + 1))._add(nextNormal)._unit();
                    this.addPieSliceVertex(currentVertex, flip, distance, approxFractionalJoinNormal, lineTurnsLeft);
                }
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
            }


            // Start next segment with a butt
            if (nextVertex) {
                // Add round cap before first segment
                this.addCurrentVertex(currentVertex, flip, distance, nextNormal, -1, -1, true);

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
 * @param {number} distance the distance from the beginning of the line to the vertex
 * @param {number} endLeft extrude to shift the left vertex along the line
 * @param {number} endRight extrude to shift the left vertex along the line
 * @param {boolean} round whether this is a round cap
 * @private
 */
LineBucket.prototype.addCurrentVertex = function(currentVertex, flip, distance, normal, endLeft, endRight, round) {
    var tx = round ? 1 : 0;
    var extrude;
    var group = this.elementGroups.line.current;
    group.vertexLength += 2;

    extrude = normal.mult(flip);
    if (endLeft) extrude._sub(normal.perp()._mult(endLeft));
    this.e3 = this.addLineVertex(currentVertex, extrude, tx, 0, endLeft, distance) - group.vertexStartIndex;
    if (this.e1 >= 0 && this.e2 >= 0) {
        this.addLineElement(this.e1, this.e2, this.e3);
        group.elementLength++;
    }
    this.e1 = this.e2;
    this.e2 = this.e3;

    extrude = normal.mult(-flip);
    if (endRight) extrude._sub(normal.perp()._mult(endRight));
    this.e3 = this.addLineVertex(currentVertex, extrude, tx, 1, -endRight, distance) - group.vertexStartIndex;
    if (this.e1 >= 0 && this.e2 >= 0) {
        this.addLineElement(this.e1, this.e2, this.e3);
        group.elementLength++;
    }
    this.e1 = this.e2;
    this.e2 = this.e3;
};

/**
 * Add a single new vertex and a triangle using two previous vertices.
 * This adds a pie slice triangle near a join to simulate round joins
 *
 * @param {Object} currentVertex the line vertex to add buffer vertices for
 * @param {number} flip -1 if the vertices should be flipped, 1 otherwise
 * @param {number} distance the distance from the beggining of the line to the vertex
 * @param {Object} extrude the offset of the new vertex from the currentVertex
 * @param {boolean} whether the line is turning left or right at this angle
 * @private
 */
LineBucket.prototype.addPieSliceVertex = function(currentVertex, flip, distance, extrude, lineTurnsLeft) {
    var ty = lineTurnsLeft ? 1 : 0;
    extrude = extrude.mult(flip * (lineTurnsLeft ? -1 : 1));
    var group = this.elementGroups.line.current;

    this.e3 = this.addLineVertex(currentVertex, extrude, 0, ty, 0, distance) - group.vertexStartIndex;
    group.vertexLength++;

    if (this.e1 >= 0 && this.e2 >= 0) {
        this.addLineElement(this.e1, this.e2, this.e3);
        group.elementLength++;
    }

    if (lineTurnsLeft) {
        this.e2 = this.e3;
    } else {
        this.e1 = this.e3;
    }
};
