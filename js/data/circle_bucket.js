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

}

CircleBucket.prototype.addFeatures = function() {

    var offsets = {};
    var partiallyEvaluated = {};
    var itemSize = 4; // 2 * sizeof(gl.SHORT)
    var layer = this.layers[0];

    this.elementGroups = new ElementGroups(this.buffers.circleVertex,this. buffers.circleElement);
    this.elementGroups.itemSize = itemSize;
    this.buffers.circleVertex.itemSize = itemSize;
    this.buffers.circleVertex.alignInitialPos();

    for (var i = 0; i < this.features.length; i++) {
        var geometries = this.features[i].loadGeometry()[0];
        for (var j = 0; j < geometries.length; j++) {
            this.elementGroups.makeRoomFor(6);
            var x = geometries[j].x;
            var y = geometries[j].y;

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
            this.buffers.circleVertex.add(x, y, -1, -1); // 1
            this.buffers.circleVertex.add(x, y, 1, -1); // 2
            this.buffers.circleVertex.add(x, y, 1, 1); // 3
            this.buffers.circleVertex.add(x, y, -1, 1); // 4

            // 1, 2, 3
            // 1, 4, 3
            this.elementGroups.elementBuffer.add(idx, idx + 1, idx + 2);
            this.elementGroups.elementBuffer.add(idx, idx + 3, idx + 2);

            this.elementGroups.current.vertexLength += 4;
            this.elementGroups.current.elementLength += 2;
        }
    }
};
