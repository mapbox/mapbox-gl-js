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

        var geometry = this.features[i].loadGeometry();

        var triangleIndex = this.buffers.circleVertex.index - this.elementGroups.current.vertexStartIndex;

        // this geometry will be of the Point type, and we'll derive
        // two triangles from it.
        //
        //     2
        //    /|
        // 1 / |
        //   \ |
        //    \|
        //     3
        //
        // 1
        this.buffers.circleVertex.add(
            geometry.x, geometry.y,
            -1, 0);
        // 2
        this.buffers.circleVertex.add(
            geometry.x, geometry.y,
            0, -1);
        // 3
        this.buffers.circleVertex.add(
            geometry.x, geometry.y,
            0, 1);


        // 2
        // |\
        // | \1
        // | /
        // |/
        // 3
        //
        // 1
        this.buffers.circleVertex.add(
            geometry.x, geometry.y,
            1, 0);
        // 2
        this.buffers.circleVertex.add(
            geometry.x, geometry.y,
            0, -1);
        // 3
        this.buffers.circleVertex.add(
            geometry.x, geometry.y,
            0, 1);

        this.elementGroups.current.vertexLength += 6;

        this.elementGroups.elementBuffer.add(
            triangleIndex, triangleIndex + 1, triangleIndex + 2);
        this.elementGroups.elementBuffer.add(
            triangleIndex + 1, triangleIndex + 2, triangleIndex + 3);

        this.elementGroups.current.elementLength += 2;
    }
};
