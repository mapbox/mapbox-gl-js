'use strict';

var ElementGroups = require('./element_groups');

module.exports = CircleBucket;

/**
 * A container for all circle data
 *
 * Circles are represented by two triangles.
 *
 * Each corner has a pos that is the center of the circle and an extrusion
 * vector that is where it points.
 */
function CircleBucket(buffers) {
    this.buffers = buffers;
    this.elementGroups = new ElementGroups(
        buffers.circleVertex,
        buffers.circleElement);
}

CircleBucket.prototype.addFeatures = function() {
    for (var i = 0; i < this.features.length; i++) {

        this.elementGroups.makeRoomFor(6);

        var geometry = this.features[i].loadGeometry()[0][0],
            x = geometry.x,
            y = geometry.y;

        var idx = this.buffers.circleVertex.index - this.elementGroups.current.vertexStartIndex;

        // this geometry will be of the Point type, and we'll derive
        // two triangles from it.
        //
        //    1
        // 4 / \2
        //   \ /
        //    3
        this.buffers.circleVertex.add(x, y, 0, 1); // 1
        this.buffers.circleVertex.add(x, y, 1, 0); // 2
        this.buffers.circleVertex.add(x, y, 0, -1); // 3
        this.buffers.circleVertex.add(x, y, -1, 0); // 4

        // 1, 2, 3
        // 1, 4, 3
        this.elementGroups.elementBuffer.add(idx, idx + 1, idx + 2);
        this.elementGroups.elementBuffer.add(idx, idx + 3, idx + 2);

        this.elementGroups.current.vertexLength += 4;
        this.elementGroups.current.elementLength += 2;
    }
};
