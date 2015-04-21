'use strict';

var ElementGroups = require('./element_groups');

module.exports = CircleBucket;

function CircleBucket(buffers) {
    console.log(buffers);
    this.buffers = buffers;
    this.elementGroups = new ElementGroups(buffers.fillVertex, buffers.fillElement, buffers.outlineElement);
}

CircleBucket.prototype.addFeatures = function() {
    var features = this.features;
    for (var i = 0; i < features.length; i++) {
        var feature = features[i];
        this.addFeature(feature.loadGeometry());
    }
};

CircleBucket.prototype.addFeature = function(circles) {
    for (var i = 0; i < circles.length; i++) {
        this.addCircle(circles[i]);
    }
};

CircleBucket.prototype.addCircle = function(vertices) {
    // Calculate the total number of vertices we're going to produce so that we
    // can resize the buffer beforehand, or detect whether the current circle
    // won't fit into the buffer anymore.
    // In order to be able to use the vertex buffer for drawing the antialiased
    // outlines, we separate all polygon vertices with a degenerate (out-of-
    // viewplane) vertex.
    var circleVertex = this.buffers.circleVertex;
    for (var i = 0; i < vertices.length; i++) {
        circleVertex.add(vertices[i].x, vertices[i].y);
    }
};
