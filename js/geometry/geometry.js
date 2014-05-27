'use strict';

var LineVertexBuffer = require('./linevertexbuffer.js');
var LineElementBuffer = require('./lineelementbuffer.js');
var FillVertexBuffer = require('./fillvertexbuffer.js');
var FillElementsBuffer = require('./fillelementsbuffer.js');
var GlyphVertexBuffer = require('./glyphvertexbuffer.js');
var PointVertexBuffer = require('./pointvertexbuffer.js');

// Construct a geometry that contains a vertex and fill buffer and can be drawn using `addLine`
module.exports = Geometry;

function Geometry() {

    this.glyphVertex = new GlyphVertexBuffer();
    this.pointVertex = new PointVertexBuffer();

    this.lineBuffers = [];
    this.lineBufferIndex = -1;
    this.lineVertex = null;
    this.lineElement = null;
    this.swapLineBuffers(0);

    this.fillBuffers = [];
    this.fillBufferIndex = -1;
    this.fillVertex = null;
    this.fillElements = null;
    this.swapFillBuffers(0);
}

// Collects all buffers to mark them as transferable object.
// Returns an array of ArrayBuffers in this geometry object.

Geometry.prototype.bufferList = function() {
    var buffers = [
        this.glyphVertex.array,
        this.pointVertex.array,
    ];

    for (var k = 0, linelen = this.lineBuffers.length; k < linelen; k++) {
        buffers.push(
            this.lineBuffers[k].vertex.array,
            this.lineBuffers[k].element.array);
    }
    for (var i = 0, len = this.fillBuffers.length; i < len; i++) {
        buffers.push(
            this.fillBuffers[i].vertex.array,
            this.fillBuffers[i].elements.array);
    }
    return buffers;
};

// Given a desired vertexCount to be available in the vertex buffer,
// swap the existing buffer if needed for new vertex and fill buffers.

Geometry.prototype.swapFillBuffers = function(vertexCount) {

    if (!this.fillVertex || this.fillVertex.index + vertexCount >= 65536) {
        this.fillVertex = new FillVertexBuffer();
        this.fillElements = new FillElementsBuffer();

        this.fillBuffers.push({
            vertex: this.fillVertex,
            elements: this.fillElements
        });
        this.fillBufferIndex++;
    }
};

Geometry.prototype.swapLineBuffers = function(vertexCount) {

    if (!this.lineVertex || this.lineVertex.index + vertexCount >= 65536) {
        this.lineVertex = new LineVertexBuffer();
        this.lineElement = new LineElementBuffer();

        this.lineBuffers.push({
            vertex: this.lineVertex,
            element: this.lineElement
        });
        this.lineBufferIndex++;
    }
};

Geometry.prototype.addPoints = function(vertices, place) {
    var fullRange = [2 * Math.PI, 0];

    for (var i = 0; i < vertices.length; i++) {
        var point = vertices[i];

        if (place) {
            this.pointVertex.add(point.x, point.y, 0, place.zoom, place.rotationRange);
        } else {
            var zoom = point.scale && Math.log(point.scale) / Math.LN2;
            this.pointVertex.add(point.x, point.y, point.angle || 0, zoom || 0, fullRange);
        }
    }
};

Geometry.prototype.addLine = function(vertices, join, cap, miterLimit, roundLimit) {
    if (vertices.length < 2) {
        console.warn('a line must have at least two vertices');
        return;
    }

    var len = vertices.length,
        firstVertex = vertices[0],
        lastVertex = vertices[len - 1],
        closed = firstVertex.equals(lastVertex);

    // we could be more precies, but it would only save a negligible amount of space
    this.swapLineBuffers(len * 4);

    var lineVertex = this.lineVertex;
    var lineElement = this.lineElement;

    if (len == 2 && closed) {
        // console.warn('a line may not have coincident points');
        return;
    }

    join = join || 'miter';
    cap = cap || 'butt';
    miterLimit = miterLimit || 2;
    roundLimit = roundLimit || 1;

    var beginCap = cap,
        endCap = closed ? 'butt' : cap,
        flip = 1,
        distance = 0,
        currentVertex, prevVertex,  nextVertex, prevNormal,  nextNormal;

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

        // Whether any vertices have been
        var startOfLine = e1 === undefined || e2 === undefined;

        // The join if a middle vertex, otherwise the cap.
        var currentJoin = (prevVertex && nextVertex) ? join :
            nextVertex ? beginCap : endCap;

        if (currentJoin === 'round' && miterLength < roundLimit) {
            currentJoin = 'miter';
        }

        if (currentJoin === 'miter' && miterLength > miterLimit && miterLength < Math.SQRT2) {
            currentJoin = 'bevel';
        }

        // Mitered joins
        if (currentJoin === 'miter') {

            if (miterLength > 100) {
                // Almost parallel lines
                flip = -flip;
                joinNormal = nextNormal;

            } else if (miterLength > miterLimit) {
                flip = -flip;
                // miter is too big, flip the direction to make a beveled join
                var bevelLength = miterLength * prevNormal.add(nextNormal).mag() / prevNormal.sub(nextNormal).mag();
                joinNormal._perp()._mult(flip * bevelLength);

            } else {
                // scale the unit vector by the miter length
                joinNormal._mult(miterLength);
            }

            addCurrentVertex(joinNormal, 0, false);

        // All other types of joins
        } else {

            // Close previous segment with a butt or a square cap
            if (!startOfLine) {
                addCurrentVertex(prevNormal, currentJoin === 'square' ? 1 : 0, false);
            }

            // Add round cap or linejoin at end of segment
            if (!startOfLine && currentJoin === 'round') {
                addCurrentVertex(prevNormal, 1, true);
            }

            // Segment include cap are done, unset vertices to disconnect segments.
            // Or leave them to create a bevel.
            if (startOfLine || currentJoin !== 'bevel') {
                e1 = e2 = -1;
                flip = 1;
            }

            // Add round cap before first segment
            if (startOfLine && beginCap === 'round') {
                addCurrentVertex(nextNormal, -1, true);
            }

            // Start next segment with a butt or square cap
            if (nextVertex) {
                addCurrentVertex(nextNormal, currentJoin === 'square' ? -1 : 0, false);
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
     * endBox === 1 moves the extrude in the direction of the line
     * endBox === -1 moves the extrude in the reverse direction
     */
    function addCurrentVertex(normal, endBox, round) {

        var tx = round ? 1 : 0;
        var extrude;

        extrude = normal.mult(flip);
        if (endBox) extrude._sub(normal.perp()._mult(endBox));
        e3 = lineVertex.add(currentVertex, extrude, tx, 0, distance);
        if (e1 >= 0 && e2 >= 0) lineElement.add(e1, e2, e3);
        e1 = e2; e2 = e3;

        extrude = normal.mult(-flip);
        if (endBox) extrude._sub(normal.perp()._mult(endBox));
        e3 = lineVertex.add(currentVertex, extrude, tx, 1, distance);
        if (e1 >= 0 && e2 >= 0) lineElement.add(e1, e2, e3);
        e1 = e2; e2 = e3;
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

    var len = vertices.length;

    // Check whether this geometry buffer can hold all the required vertices.
    this.swapFillBuffers(len + 1);

    // Start all lines with a degenerate vertex
    this.fillVertex.addDegenerate();

    // We're generating triangle fans, so we always start with the first coordinate in this polygon.
    var firstIndex = this.fillVertex.index,
        prevIndex, currentIndex, currentVertex;

    for (var i = 0; i < vertices.length; i++) {
        currentIndex = this.fillVertex.index;
        currentVertex = vertices[i];

        this.fillVertex.add(currentVertex.x, currentVertex.y);

        // Only add triangles that have distinct vertices.
        if (i >= 2 && (currentVertex.x !== vertices[0].x || currentVertex.y !== vertices[0].y)) {
            this.fillElements.add(firstIndex, prevIndex, currentIndex);
        }

        prevIndex = currentIndex;
    }
};

Geometry.prototype.addGlyphs = function(glyphs, placementZoom, placementRange, zoom) {

    var glyphVertex = this.glyphVertex;
    placementZoom += zoom;

    for (var k = 0; k < glyphs.length; k++) {

        var glyph = glyphs[k],
            tl = glyph.tl,
            tr = glyph.tr,
            bl = glyph.bl,
            br = glyph.br,
            tex = glyph.tex,
            angle = glyph.angle,
            anchor = glyph.anchor,

            minZoom = Math.max(zoom + Math.log(glyph.minScale) / Math.LN2, placementZoom),
            maxZoom = Math.min(zoom + Math.log(glyph.maxScale) / Math.LN2, 25);

        if (maxZoom <= minZoom) continue;

        // Lower min zoom so that while fading out the label it can be shown outside of collision-free zoom levels
        if (minZoom === placementZoom) minZoom = 0;

        // first triangle
        glyphVertex.add(anchor.x, anchor.y, tl.x, tl.y, tex.x, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + tex.w, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + tex.h, angle, minZoom, placementRange, maxZoom, placementZoom);

        // second triangle
        glyphVertex.add(anchor.x, anchor.y, tr.x, tr.y, tex.x + tex.w, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(anchor.x, anchor.y, bl.x, bl.y, tex.x, tex.y + tex.h, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(anchor.x, anchor.y, br.x, br.y, tex.x + tex.w, tex.y + tex.h, angle, minZoom, placementRange, maxZoom, placementZoom);
    }

};
