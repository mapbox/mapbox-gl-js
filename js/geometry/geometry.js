'use strict';

var util = require('../util/util.js');
var LineVertexBuffer = require('./linevertexbuffer.js');
var FillVertexBuffer = require('./fillvertexbuffer.js');
var FillElementsBuffer = require('./fillelementsbuffer.js');
var GlyphVertexBuffer = require('./glyphvertexbuffer.js');

/*
 * Construct a geometry that contains a vertex and fill
 * buffer and can be drawn using `addLine`
 */
module.exports = Geometry;
function Geometry() {
    this.lineVertex = new LineVertexBuffer();
    this.glyphVertex = new GlyphVertexBuffer();

    this.fillBuffers = [];
    this.fillBufferIndex = -1;
    this.fillVertex = null;
    this.fillElements = null;
    this.swapFillBuffers(0);
}

/*
 * Collects all buffers to mark them as transferable object.
 *
 * @return {Array} A list of all buffers ArrayBuffers contained in this geometry
 *     object.
 */
Geometry.prototype.bufferList = function() {
    var buffers = [ this.glyphVertex.array, this.lineVertex.array ];
    for (var l = 0; l < this.fillBuffers.length; l++) {
        buffers.push(this.fillBuffers[l].vertex.array, this.fillBuffers[l].elements.array);
    }
    return buffers;
};

/*
 * Given a desired vertexCount to be available in the vertex buffer,
 * swap the existing buffer if needed for new vertex and fill buffers.
 *
 * @param {number} vertexCount
 */
Geometry.prototype.swapFillBuffers = function(vertexCount) {
    if (!this.fillVertex || this.fillVertex.index + vertexCount >= 65536) {
        this.fillVertex = new FillVertexBuffer();
        this.fillElements = new FillElementsBuffer();
        this.fillBuffers.push({ vertex: this.fillVertex, elements: this.fillElements });
        this.fillBufferIndex++;
    }
};

Geometry.prototype.addMarkers = function(vertices, spacing) {

    var distance = 0;
    var markedDistance = 0;

    for (var i = 0; i < vertices.length - 1; i++) {
        var segmentDist = util.dist(vertices[i], vertices[i+1]);
        var slope = util.unit(util.vectorSub(vertices[i+1], vertices[i]));

        while (markedDistance + spacing < distance + segmentDist) {
            markedDistance += spacing;
            var segmentInterp = (markedDistance - distance)/ segmentDist;
            var point = {
                x: util.interp(vertices[i].x, vertices[i+1].x, segmentInterp),
                y: util.interp(vertices[i].y, vertices[i+1].y, segmentInterp)
            };

            this.lineVertex.add(point.x, point.y, slope.x, slope.y, 0, 0);

        }

        distance += segmentDist;
    }
};

Geometry.prototype.addPoints = function(vertices) {
    for (var i = 0; i < vertices.length; i++) {
        var point = vertices[i];
        this.lineVertex.add(point.x, point.y, 1, 0, 0, 0);
    }
};

Geometry.prototype.addLine = function(vertices, join, cap, miterLimit, roundLimit) {
    if (typeof join === 'undefined') join = 'miter';
    if (typeof cap === 'undefined') cap = 'butt';
    if (typeof miterLimit === 'undefined') miterLimit = 2;
    if (typeof roundLimit === 'undefined') roundLimit = 1;

    if (vertices.length < 2) {
        console.warn('a line must have at least two vertices');
        return;
    }

    var firstVertex = vertices[0];
    var lastVertex = vertices[vertices.length - 1];
    var closed = firstVertex.x == lastVertex.x && firstVertex.y == lastVertex.y;

    if (vertices.length == 2 && closed) {
        // alert('a line may not have coincident points');
        return;
    }

    var beginCap = cap;
    var endCap = closed ? 'butt' : cap;

    var currentVertex = null, prevVertex = null, nextVertex = null;
    var prevNormal = null, nextNormal = null;
    var flip = 1;
    var distance = 0;

    if (closed) {
        currentVertex = vertices[vertices.length - 2];
        nextNormal = util.normal(currentVertex, lastVertex);
    }

    // Start all lines with a degenerate vertex
    this.lineVertex.addDegenerate();

    for (var i = 0; i < vertices.length; i++) {
        if (nextNormal) prevNormal = { x: -nextNormal.x, y: -nextNormal.y };
        if (currentVertex) prevVertex = currentVertex;

        currentVertex = vertices[i];

        if (prevVertex) distance += util.dist(currentVertex, prevVertex);

        // Find the next vertex.
        if (i + 1 < vertices.length) {
            nextVertex = vertices[i + 1];
        } else {
            nextVertex = null;
        }

        var segment = false;

        if (closed && i >= 2 && (i + 1 < vertices.length)) {
            segment = true;
        }

        // If the line is closed, we treat the last vertex like the first vertex.
        if (!nextVertex && closed) {
            nextVertex = vertices[1];
        }


        if (nextVertex) {
            // if two consecutive vertices exist, skip one
            if (currentVertex.x === nextVertex.x && currentVertex.y === nextVertex.y) continue;
        }

        // Calculate the normal towards the next vertex in this line. In case
        // there is no next vertex, pretend that the line is continuing straight,
        // meaning that we are just reversing the previous normal
        if (nextVertex) {
            nextNormal = util.normal(currentVertex, nextVertex);
        } else {
            nextNormal = { x: -prevNormal.x, y: -prevNormal.y };
        }

        // If we still don't have a previous normal, this is the beginning of a
        // non-closed line, so we're doing a straight "join".
        if (!prevNormal) {
            prevNormal = { x: -nextNormal.x, y: -nextNormal.y };
        }

        // Determine the normal of the join extrusion. It is the angle bisector
        // of the segments between the previous line and the next line.
        var joinNormal = {
            x: prevNormal.x + nextNormal.x,
            y: prevNormal.y + nextNormal.y
        };

        // Cross product yields 0..1 depending on whether they are parallel
        // or perpendicular.
        var joinAngularity = nextNormal.x * joinNormal.y - nextNormal.y * joinNormal.x;
        joinNormal.x /= joinAngularity;
        joinNormal.y /= joinAngularity;
        var roundness = Math.max(Math.abs(joinNormal.x), Math.abs(joinNormal.y));


        var roundJoin = false;
        // Determine whether we should actually draw a round/bevelled/butt line join. It looks
        // better if we do, but we can get away with drawing a mitered join for
        // joins that have a very small angle. For this, we have the "roundLimit"
        // parameter. We do this to reduce the number of vertices we have to
        // write into the line vertex buffer. Note that joinAngularity may be 0,
        // so the roundness grows to infinity. This is intended.
        if ((join === 'round' || join === 'bevel' || join === 'butt') && roundness > roundLimit) {
            roundJoin = true;
        }

        // Close up the previous line for a round join
        if (roundJoin && prevVertex && nextVertex) {
            // Add first vertex
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * prevNormal.y, -flip * prevNormal.x, // extrude normal
                      0, 0, distance); // texture normal

            // Add second vertex.
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      -flip * prevNormal.y, flip * prevNormal.x, // extrude normal
                      0, 1, distance); // texture normal

            // Degenerate triangle
            if (join === 'round' || join === 'butt') {
                this.lineVertex.addDegenerate();
            }

            if (join === 'round') prevVertex = null;

            prevNormal = { x: -nextNormal.x, y: -nextNormal.y };
            flip = 1;
        }

        // Add a cap.
        if (!prevVertex && (beginCap == 'round' || beginCap == 'square' || (roundJoin && join === 'round'))) {

            var tex = beginCap == 'round' || roundJoin ? 1 : 0;

            // Add first vertex
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * (prevNormal.x + prevNormal.y), flip * (-prevNormal.x + prevNormal.y), // extrude normal
                      tex, 0, distance); // texture normal

            // Add second vertex
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * (prevNormal.x - prevNormal.y), flip * (prevNormal.x + prevNormal.y), // extrude normal
                      tex, 1, distance); // texture normal
        }

        if (roundJoin) {
            // ROUND JOIN
            // Add first vertex
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      -flip * nextNormal.y, flip * nextNormal.x, // extrude normal
                      0, 0, distance); // texture normal

            // Add second vertex
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * nextNormal.y, -flip * nextNormal.x, // extrude normal
                      0, 1, distance); // texture normal
        } else if ((nextVertex || endCap != 'square') && (prevVertex || beginCap != 'square')) {
            // MITER JOIN
            if (Math.abs(joinAngularity) < 0.01) {
                // The two normals are almost parallel.
                joinNormal.x = -nextNormal.y;
                joinNormal.y = nextNormal.x;
            } else if (roundness > miterLimit) {
                // If the miter grows too large, flip the direction to make a
                // bevel join.
                joinNormal.x = (prevNormal.x - nextNormal.x) / joinAngularity;
                joinNormal.y = (prevNormal.y - nextNormal.y) / joinAngularity;
                flip = -flip;
            }

            // Add first vertex
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      flip * joinNormal.x, flip * joinNormal.y, // extrude normal
                      0, 0, distance); // texture normal

            // Add second vertex
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      -flip * joinNormal.x, -flip * joinNormal.y, // extrude normal
                      0, 1, distance); // texture normal
        }

        // Add the end cap, but only if this vertex is distinct from the begin
        // vertex.
        if (!nextVertex && (endCap == 'round' || endCap == 'square')) {
            var capTex = endCap == 'round' ? 1 : 0;

            // Add first vertex
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      nextNormal.x - flip * nextNormal.y, flip * nextNormal.x + nextNormal.y, // extrude normal
                      capTex, 0, distance); // texture normal

            // Add second vertex
            this.lineVertex.add(currentVertex.x, currentVertex.y, // vertex pos
                      nextNormal.x + flip * nextNormal.y, -flip * nextNormal.x + nextNormal.y, // extrude normal
                      capTex, 1, distance); // texture normal
        }
    }
};


Geometry.prototype.addFill = function(vertices) {
    if (vertices.length < 3) {
        console.warn('a fill must have at least three vertices');
        return;
    }

    // Calculate the total number of vertices we're going to produce so that we
    // can resize the buffer beforehand, or detect whether the current line
    // won't fit into the buffer anymore.
    // In order to be able to use the vertex buffer for drawing the antialiased
    // outlines, we separate all polygon vertices with a degenerate (out-of-
    // viewplane) vertex.
    var vertexCount = vertices.length + 1;

    // Check whether this geometry buffer can hold all the required vertices.
    this.swapFillBuffers(vertexCount);

    // Start all lines with a degenerate vertex
    this.fillVertex.addDegenerate();

    var firstIndex = null, prevIndex = null, currentIndex = null;

    // We're generating triangle fans, so we always start with the first
    // coordinate in this polygon.
    firstIndex = this.fillVertex.index;

    for (var i = 0; i < vertices.length; i++) {
        currentIndex = this.fillVertex.index;
        this.fillVertex.add(vertices[i].x, vertices[i].y);

        // Only add triangles that have distinct vertices.
        if (i >= 2 && (vertices[i].x !== vertices[0].x || vertices[i].y !== vertices[0].y)) {
            this.fillElements.add(firstIndex, prevIndex, currentIndex);
        }

        prevIndex = currentIndex;
    }
};
