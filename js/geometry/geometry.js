'use strict';

var util = require('../util/util.js');
var LineVertexBuffer = require('./linevertexbuffer.js');
var FillVertexBuffer = require('./fillvertexbuffer.js');
var FillElementsBuffer = require('./fillelementsbuffer.js');
var GlyphVertexBuffer = require('./glyphvertexbuffer.js');
var PointVertexBuffer = require('./pointvertexbuffer.js');

// Construct a geometry that contains a vertex and fill buffer and can be drawn using `addLine`
module.exports = Geometry;

function Geometry() {

    this.lineVertex = new LineVertexBuffer();
    this.glyphVertex = new GlyphVertexBuffer();
    this.pointVertex = new PointVertexBuffer();

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
        this.lineVertex.array,
        this.pointVertex.array
    ];
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

Geometry.prototype.addMarkers = function(vertices, spacing) {

    var distance = 0,
        markedDistance = 0,
        added = 1;

    for (var i = 0; i < vertices.length - 1; i++) {

        var segmentDist = util.dist(vertices[i], vertices[i + 1]),
            slope = util.normal(vertices[i], vertices[i + 1]),
            angle = Math.atan2(slope.y, slope.x);

        while (markedDistance + spacing < distance + segmentDist) {
            markedDistance += spacing;

            var t = (markedDistance - distance) / segmentDist,
                x = util.interp(vertices[i].x, vertices[i + 1].x, t),
                y = util.interp(vertices[i].y, vertices[i + 1].y, t),
                z = added % 8 === 0 ? 0 :
                    added % 4 === 0 ? 1 :
                    added % 2 === 0 ? 2 : 3;

            this.pointVertex.add(x, y, angle, z, [0, Math.PI * 2]);
            added++;
        }

        distance += segmentDist;
    }
};

Geometry.prototype.addPoints = function(vertices, collision, size, padding) {
    var fullRange = [2 * Math.PI, 0];

    for (var i = 0; i < vertices.length; i++) {
        var point = vertices[i];

        // place to prevent collisions
        if (size) {
            var ratio = 8, // todo uhardcode tileExtent/tileSize
                x = size.x / 2 * ratio,
                y = size.y / 2 * ratio,
                bbox = {x1: -x, x2: x, y1: -y, y2: y};

            var glyphs = [{
                bbox: bbox,
                box: bbox,
                minScale: 1,
                anchor: point
            }];

            var place = collision.place(glyphs, point, 1, 16, padding);

            if (place) {
                this.pointVertex.add(point.x, point.y, 0, place.zoom, place.rotationRange);
            }

        // just add without considering collisions
        } else {
            this.pointVertex.add(point.x, point.y, 0, 0, fullRange);
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
        closed = firstVertex.x == lastVertex.x && firstVertex.y == lastVertex.y;

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
        currentVertex,  prevVertex,  nextVertex, prevNormal,  nextNormal;

    if (closed) {
        currentVertex = vertices[len - 2];
        nextNormal = util.normal(currentVertex, lastVertex);
    }

    // Start all lines with a degenerate vertex
    this.lineVertex.addDegenerate();

    for (var i = 0; i < len; i++) {
        if (nextNormal) prevNormal = { x: -nextNormal.x, y: -nextNormal.y };
        if (currentVertex) prevVertex = currentVertex;

        currentVertex = vertices[i];

        if (prevVertex) distance += util.dist(currentVertex, prevVertex);

        nextVertex =
            i + 1 < len ? vertices[i + 1] : // find the next vertex
            closed ? vertices[1] : null; // if the line is closed, we treat the last vertex like the first

        if (nextVertex) {
            // if two consecutive vertices exist, skip one
            if (currentVertex.x === nextVertex.x && currentVertex.y === nextVertex.y) continue;
        }

        // Calculate the normal towards the next vertex in this line. In case
        // there is no next vertex, pretend that the line is continuing straight,
        // meaning that we are just reversing the previous normal
        nextNormal = nextVertex ? util.normal(currentVertex, nextVertex) : {x: -prevNormal.x, y: -prevNormal.y};

        // If we still don't have a previous normal, this is the beginning of a
        // non-closed line, so we're doing a straight "join".
        prevNormal = prevNormal || {x: -nextNormal.x, y: -nextNormal.y};

        // Determine the normal of the join extrusion. It is the angle bisector
        // of the segments between the previous line and the next line.
        var joinNormal = {
            x: prevNormal.x + nextNormal.x,
            y: prevNormal.y + nextNormal.y
        };

        // Cross product yields 0..1 depending on whether they are parallel or perpendicular.
        var joinAngularity = nextNormal.x * joinNormal.y - nextNormal.y * joinNormal.x;
        joinNormal.x /= joinAngularity;
        joinNormal.y /= joinAngularity;

        var roundness = Math.max(Math.abs(joinNormal.x), Math.abs(joinNormal.y));

        // Determine whether we should actually draw a round/bevelled/butt line join. It looks
        // better if we do, but we can get away with drawing a mitered join for
        // joins that have a very small angle. For this, we have the "roundLimit"
        // parameter. We do this to reduce the number of vertices we have to
        // write into the line vertex buffer. Note that joinAngularity may be 0,
        // so the roundness grows to infinity. This is intended.
        var roundJoin = (join === 'round' || join === 'bevel' || join === 'butt') && roundness > roundLimit;

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

            prevNormal = {x: -nextNormal.x, y: -nextNormal.y};
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
                // If the miter grows too large, flip the direction to make a bevel join.
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

        // Add the end cap, but only if this vertex is distinct from the begin vertex.
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
