'use strict';

var ElementGroups = require('./element_groups');

module.exports = LineBucket;

function LineBucket(buffers, layoutProperties, _, overscaling) {
    this.buffers = buffers;
    this.elementGroups = new ElementGroups(buffers.lineVertex, buffers.lineElement);
    this.layoutProperties = layoutProperties;
    this.overscaling = overscaling;
}

LineBucket.prototype.addFeatures = function() {
    var features = this.features;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        this.addFeature(feature.loadGeometry());
    }
};

LineBucket.prototype.addFeature = function(lines) {
    var layoutProperties = this.layoutProperties;
    for (var i = 0; i < lines.length; i++) {
        this.addLine(lines[i],
            layoutProperties['line-join'],
            layoutProperties['line-cap'],
            layoutProperties['line-miter-limit'],
            layoutProperties['line-round-limit']);
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

    var lineVertex = this.buffers.lineVertex;
    var lineElement = this.buffers.lineElement;

    // we could be more precise, but it would only save a negligible amount of space
    this.elementGroups.makeRoomFor(len * 4);
    var elementGroup = this.elementGroups.current;
    var vertexStartIndex = elementGroup.vertexStartIndex;

    if (len === 2 && closed) {
        // console.warn('a line may not have coincident points');
        return;
    }

    var beginCap = cap,
        endCap = closed ? 'butt' : cap,
        flip = 1,
        distance = 0,
        currentVertex, prevVertex, nextVertex, prevNormal, nextNormal;

    // the last three vertices added
    var e1, e2, e3;

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
        if (prevVertex) distance += currentVertex.dist(prevVertex) * this.overscaling;

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

        // Whether any vertices have been
        var startOfLine = e1 === undefined || e2 === undefined;

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
            // The maximum extrude length is 63 / 256 = 4 times the width of the line
            // so if miterLength >= 4 we need to draw a different type of bevel where.
            if (miterLength > 4) currentJoin = 'flipbevel';

            // If the miterLength is really small and the line bevel wouldn't be visible,
            // just draw a miter join to save a triangle.
            if (miterLength < miterLimit) currentJoin = 'miter';
        }

        // Mitered joins
        if (currentJoin === 'miter') {
            // scale the unit vector by the miter length
            joinNormal._mult(miterLength);
            addCurrentVertex(joinNormal, 0, 0, false);

        } else if (currentJoin === 'flipbevel') {
            // miter is too big, flip the direction to make a beveled join

            if (miterLength > 100) {
                // Almost parallel lines
                flip = -flip;
                joinNormal = nextNormal;

            } else {
                var bevelLength = miterLength * prevNormal.add(nextNormal).mag() / prevNormal.sub(nextNormal).mag();
                joinNormal._perp()._mult(flip * bevelLength);
                flip = -flip;
            }
            addCurrentVertex(joinNormal, 0, 0, false);

        // All other types of joins
        } else {

            var offsetA, offsetB;
            if (currentJoin === 'bevel') {
                var dir = prevNormal.x * nextNormal.y - prevNormal.y * nextNormal.x;
                var offset = -Math.sqrt(miterLength * miterLength - 1);
                if (flip * dir > 0) {
                    offsetB = 0;
                    offsetA = offset;
                } else {
                    offsetA = 0;
                    offsetB = offset;
                }
            } else if (currentJoin === 'square') {
                offsetA = offsetB = 1;
            } else {
                offsetA = offsetB = 0;
            }

            // Close previous segment with a butt or a square cap or bevel
            if (!startOfLine) {
                addCurrentVertex(prevNormal, offsetA, offsetB, false);
            }

            // Add round cap or linejoin at end of segment
            if (!startOfLine && currentJoin === 'round') {
                addCurrentVertex(prevNormal, 1, 1, true);
            }

            // Segment include cap are done, unset vertices to disconnect segments.
            // Or leave them to create a bevel.
            if (startOfLine || currentJoin !== 'bevel') {
                e1 = e2 = -1;
                flip = 1;
            }

            // Add round cap before first segment
            if (startOfLine && beginCap === 'round') {
                addCurrentVertex(nextNormal, -1, -1, true);
            }

            // Start next segment with a butt or square cap or bevel
            if (nextVertex) {
                addCurrentVertex(nextNormal, -offsetA, -offsetB, false);
            }
        }

    }


    /*
     * Adds two vertices to the buffer that are
     * normal and -normal from the currentVertex.
     *
     * endBox moves the extrude one unit in the direction of the line
     * to create square or round cap.
     *
     * endLeft and endRight shifts the extrude along the line
     * endLeft === 1 moves the extrude in the direction of the line
     * endLeft === -1 moves the extrude in the reverse direction
     */
    function addCurrentVertex(normal, endLeft, endRight, round) {

        var tx = round ? 1 : 0;
        var extrude;

        extrude = normal.mult(flip);
        if (endLeft) extrude._sub(normal.perp()._mult(endLeft));
        e3 = lineVertex.add(currentVertex, extrude, tx, 0, distance) - vertexStartIndex;
        if (e1 >= 0 && e2 >= 0) {
            lineElement.add(e1, e2, e3);
            elementGroup.elementLength++;
        }
        e1 = e2;
        e2 = e3;

        extrude = normal.mult(-flip);
        if (endRight) extrude._sub(normal.perp()._mult(endRight));
        e3 = lineVertex.add(currentVertex, extrude, tx, 1, distance) - vertexStartIndex;
        if (e1 >= 0 && e2 >= 0) {
            lineElement.add(e1, e2, e3);
            elementGroup.elementLength++;
        }
        e1 = e2;
        e2 = e3;

        elementGroup.vertexLength += 2;
    }
};
