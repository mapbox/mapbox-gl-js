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
 * @private
 */
function CircleBucket(buffers) {
    this.buffers = buffers;
    this.elementGroups = new ElementGroups(
        buffers.circleVertex,
        buffers.circleElement);
}

CircleBucket.prototype.addFeatures = function() {
    var extent = 4096;
    for (var i = 0; i < this.features.length; i++) {
        var geometries = this.features[i].loadGeometry()[0];
        for (var j = 0; j < geometries.length; j++) {
            this.elementGroups.makeRoomFor(6);
            var x = geometries[j].x,
                y = geometries[j].y;

            // Do not include points that are outside the tile boundaries.
            if (x < 0 || x >= extent || y < 0 || y >= extent) continue;

            var idx = this.buffers.circleVertex.index -
                this.elementGroups.current.vertexStartIndex;

            // this geometry will be of the Point type, and we'll derive
            // two triangles from it.
            //
            // ┌─────────┐
            // │ 4     3 │
            // │         │
            // │ 1     2 │
            // └─────────┘
            //
            this.buffers.circleVertex.push(x * 2,     y * 2); // 1
            this.buffers.circleVertex.push(x * 2 + 1, y * 2); // 2
            this.buffers.circleVertex.push(x * 2 + 1, y * 2 + 1); // 3
            this.buffers.circleVertex.push(x * 2,     y * 2 + 1); // 4

            // 1, 2, 3
            // 1, 4, 3
            this.elementGroups.elementBuffer.push(idx, idx + 1, idx + 2);
            this.elementGroups.elementBuffer.push(idx, idx + 3, idx + 2);

            this.elementGroups.current.vertexLength += 4;
            this.elementGroups.current.elementLength += 2;
        }
    }
};
