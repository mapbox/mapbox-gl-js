'use strict';

var Bucket = require('../bucket');
var util = require('../../util/util');
var loadGeometry = require('../load_geometry');

module.exports = FillBucket;

function FillBucket() {
    Bucket.apply(this, arguments);
}

FillBucket.prototype = util.inherit(Bucket, {});

FillBucket.prototype.addFillVertex = function(x, y) {
    return this.arrays.fillVertex.emplaceBack(x, y);
};

FillBucket.prototype.programInterfaces = {
    fill: {
        vertexBuffer: true,
        elementBuffer: true,
        secondElementBuffer: true,
        secondElementBufferComponents: 2,

        attributes: [{
            name: 'pos',
            components: 2,
            type: 'Int16'
        }]
    }
};

FillBucket.prototype.addFeature = function(feature) {
    var lines = loadGeometry(feature);
    for (var i = 0; i < lines.length; i++) {
        this.addFill(lines[i]);
    }
};

FillBucket.prototype.addFill = function(vertices) {
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
    var group = this.makeRoomFor('fill', len + 1);

    // We're generating triangle fans, so we always start with the first coordinate in this polygon.
    var firstIndex, prevIndex;
    for (var i = 0; i < vertices.length; i++) {
        var currentVertex = vertices[i];

        var currentIndex = this.addFillVertex(currentVertex.x, currentVertex.y) - group.vertexStartIndex;
        group.vertexLength++;
        if (i === 0) firstIndex = currentIndex;

        // Only add triangles that have distinct vertices.
        if (i >= 2 && (currentVertex.x !== vertices[0].x || currentVertex.y !== vertices[0].y)) {
            this.arrays.fillElement.emplaceBack(firstIndex, prevIndex, currentIndex);
            group.elementLength++;
        }

        if (i >= 1) {
            this.arrays.fillSecondElement.emplaceBack(prevIndex, currentIndex);
            group.secondElementLength++;
        }

        prevIndex = currentIndex;
    }
};
