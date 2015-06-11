'use strict';

var ElementGroups = require('./element_groups');

module.exports = CircleBucket;

function CircleBucket(buffers) {
    this.buffers = buffers;
    this.elementGroups = new ElementGroups(this.buffers.circleVertex, this.buffers.circleElement);
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
    this.elementGroups.makeRoomFor(4 * vertices.length);
    var elementGroup = this.elementGroups.current;
    for (var i = 0; i < vertices.length; i++) {
        this.buffers.circleVertex.add(vertices[i].x, vertices[i].y);
        // this.buffers.circleElement.add(
        //     this.buffers.circleVertex.index -
        //     elementGroup.vertexStartIndex);
        elementGroup.vertexLength += 4;
        elementGroup.elementLength += 1;
    }
};
