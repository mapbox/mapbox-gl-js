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
        nextNormal = currentVertex.normal(lastVertex);
    }

    for (var i = 0; i < len; i++) {

        nextVertex = closed && i === len - 1 ?
            vertices[1] : // if the line is closed, we treat the last vertex like the first
            vertices[i + 1]; // just the next vertex

        // if two consecutive vertices exist, skip the current one
        if (nextVertex && vertices[i].equals(nextVertex)) continue;

        if (nextNormal) prevNormal = nextNormal.mult(-1);
        if (currentVertex) prevVertex = currentVertex;

        currentVertex = vertices[i];

        // At this point:
        // currentVertex will be added this iteration, and is distinct from prevVertex and nextVertex
        // prevNormal and prevVertex are undefined if this is the first vertex of an unclosed line
        // nextVertex and nextNormal are undefined if this is the last vertex of an unclosed line

        // Calculate how far along the line the currentVertex is
        if (prevVertex) distance += currentVertex.dist(prevVertex);

        // Calculate the normal towards the next vertex in this line. In case
        // there is no next vertex, pretend that the line is continuing straight,
        // meaning that we are just reversing the previous normal
        nextNormal = nextVertex ? currentVertex.normal(nextVertex) : prevNormal.mult(-1);

        // If we still don't have a previous normal, this is the beginning of a
        // non-closed line, so we're doing a straight "join".
        prevNormal = prevNormal || nextNormal.mult(-1);

        // Determine the normal of the join extrusion. It is the angle bisector
        // of the segments between the previous line and the next line.
        var joinNormal = prevNormal.add(nextNormal);

        // Cross product yields 0..1 depending on whether they are parallel or perpendicular.
        var joinAngularity = nextNormal.x * joinNormal.y - nextNormal.y * joinNormal.x;
        joinNormal._div(joinAngularity);

        var roundness = Math.max(Math.abs(joinNormal.x), Math.abs(joinNormal.y));

        if (false && prevVertex && nextVertex && (join === 'miter' || roundness < roundLimit)) {
            // Do miter join
        } else {

            // Close previous segment
            if (prevVertex && e1 !== undefined && e2 !== undefined) {

                e3 = this.lineVertex.add(currentVertex,
                        flip * prevNormal.y, -flip * prevNormal.x,
                        0, 0, distance);
                this.lineElement.add(e1, e2, e3);
                e1 = e2; e2 = e3;

                e3 = this.lineVertex.add(currentVertex,
                        -flip * prevNormal.y, flip * prevNormal.x,
                        0, 1, distance);
                this.lineElement.add(e1, e2, e3);
                e1 = e2; e2 = e3;
            }

            flip = 1;

            // Round join and cap stuff here
            if ((join === 'round' && prevVertex && nextVertex) ||
                (endCap === 'round' && !nextVertex) ||
                (beginCap === 'round' && !prevVertex)) {
                // add a dot
            }

            // Start next segment
            if (nextVertex) {
                this.swapLineBuffers(4);
                e1 = this.lineVertex.add(currentVertex,
                        -flip * nextNormal.y, flip * nextNormal.x,
                        0, 0, distance);
                e2 = this.lineVertex.add(currentVertex,
                        flip * nextNormal.y, -flip * nextNormal.x,
                        0, 1, distance);
            }
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
               width = glyph.width,
               height = glyph.height,
               angle = glyph.angle;

        var minZoom = Math.max(zoom + Math.log(glyph.minScale) / Math.LN2, placementZoom);
        var maxZoom = Math.min(zoom + Math.log(glyph.maxScale) / Math.LN2, 25);
        var glyphAnchor = glyph.anchor;

        if (maxZoom <= minZoom) continue;

        // Lower min zoom so that while fading out the label
        // it can be shown outside of collision-free zoom levels
        if (minZoom === placementZoom) {
            minZoom = 0;
        }

        // first triangle
        glyphVertex.add(glyphAnchor.x, glyphAnchor.y, tl.x, tl.y, tex.x, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(glyphAnchor.x, glyphAnchor.y, tr.x, tr.y, tex.x + width, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(glyphAnchor.x, glyphAnchor.y, bl.x, bl.y, tex.x, tex.y + height, angle, minZoom, placementRange, maxZoom, placementZoom);

        // second triangle
        glyphVertex.add(glyphAnchor.x, glyphAnchor.y, tr.x, tr.y, tex.x + width, tex.y, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(glyphAnchor.x, glyphAnchor.y, bl.x, bl.y, tex.x, tex.y + height, angle, minZoom, placementRange, maxZoom, placementZoom);
        glyphVertex.add(glyphAnchor.x, glyphAnchor.y, br.x, br.y, tex.x + width, tex.y + height, angle, minZoom, placementRange, maxZoom, placementZoom);
    }

};
