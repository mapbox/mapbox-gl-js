'use strict';

var Bucket = require('../bucket');
var util = require('../../util/util');
var loadGeometry = require('../load_geometry');
var EXTENT = Bucket.EXTENT;

module.exports = CircleBucket;

/**
 * Circles are represented by two triangles.
 *
 * Each corner has a pos that is the center of the circle and an extrusion
 * vector that is where it points.
 * @private
 */
function CircleBucket() {
    Bucket.apply(this, arguments);
}

CircleBucket.prototype = util.inherit(Bucket, {});

CircleBucket.prototype.programInterfaces = {
    circle: {
        vertexBuffer: true,
        elementBuffer: true,

        attributeArgs: ['x', 'y', 'extrudeX', 'extrudeY'],

        attributes: [{
            name: 'pos',
            components: 2,
            type: 'Int16',
            value: [
                '(x * 2) + ((extrudeX + 1) / 2)',
                '(y * 2) + ((extrudeY + 1) / 2)'
            ]
        }]
    }
};

CircleBucket.prototype.addFeature = function(feature) {

    var geometries = loadGeometry(feature);
    for (var j = 0; j < geometries.length; j++) {
        var geometry = geometries[j];

        for (var k = 0; k < geometry.length; k++) {
            var group = this.makeRoomFor('circle', 4);

            var x = geometry[k].x;
            var y = geometry[k].y;

            // Do not include points that are outside the tile boundaries.
            if (x < 0 || x >= EXTENT || y < 0 || y >= EXTENT) continue;

            // this geometry will be of the Point type, and we'll derive
            // two triangles from it.
            //
            // ┌─────────┐
            // │ 3     2 │
            // │         │
            // │ 0     1 │
            // └─────────┘

            var index = this.addCircleVertex(x, y, -1, -1) - group.vertexStartIndex;
            this.addCircleVertex(x, y, 1, -1);
            this.addCircleVertex(x, y, 1, 1);
            this.addCircleVertex(x, y, -1, 1);
            group.vertexLength += 4;

            this.addCircleElement(index, index + 1, index + 2);
            this.addCircleElement(index, index + 3, index + 2);
            group.elementLength += 2;
        }
    }

};
