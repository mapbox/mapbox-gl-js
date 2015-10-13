'use strict';

var BufferBuilder = require('./buffer_builder');
var util = require('../util/util');

module.exports = FillBufferBuilder;

function FillBufferBuilder() {
    BufferBuilder.apply(this, arguments);
}

FillBufferBuilder.prototype = util.inherit(BufferBuilder, {});

FillBufferBuilder.prototype.addFeature = function(feature) {
    var lines = feature.loadGeometry();
    for (var i = 0; i < lines.length; i++) {
        this.addFill(lines[i]);
    }
};

FillBufferBuilder.prototype.addFill = function(vertices) {
    if (vertices.length < 3) {
        //console.warn('a fill must have at least three vertices');
        return;
    }

    // Calculate the total number of vertices we're going to produce so that we
    // can resize the buffer beforehand, or detect whether the current line
    // won't fit into the buffer anymore.
    // In order to be able to use the vertex buffer for drawing the antialiased
    // outlines, we separate all polygon vertices with a degenerate (out-of-
    // viewplane) vertex.

    var len = vertices.length;

    // Expand this geometry buffer to hold all the required vertices.
    this.elementGroups.fill.makeRoomFor('fill', len + 1);

    // We're generating triangle fans, so we always start with the first coordinate in this polygon.
    var firstIndex, prevIndex;
    for (var i = 0; i < vertices.length; i++) {
        var currentVertex = vertices[i];

        var currentIndex = this.addFillVertex(currentVertex.x, currentVertex.y);
        if (i === 0) firstIndex = currentIndex;

        // Only add triangles that have distinct vertices.
        if (i >= 2 && (currentVertex.x !== vertices[0].x || currentVertex.y !== vertices[0].y)) {
            this.addFillElement(firstIndex, prevIndex, currentIndex);
        }

        if (i >= 1) {
            this.addOutlineElement(prevIndex, currentIndex);
        }

        prevIndex = currentIndex;
    }
};
