'use strict';

var Bucket = require('./bucket');
var util = require('../util/util');

module.exports = CircleBucket;

var EXTENT = 4096;

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

CircleBucket.prototype.shaders = {
    circle: {
        vertexBuffer: true,
        elementBuffer: true,

        attributeArgs: ['x', 'y', 'extrudeX', 'extrudeY'],

        attributes: [{
            name: 'pos',
            components: 2,
            type: Bucket.AttributeType.SHORT,
            value: [
                '(x * 2) + ((extrudeX + 1) / 2)',
                '(y * 2) + ((extrudeY + 1) / 2)'
            ]
        }]
    }
};

CircleBucket.prototype.addFeature = function(feature) {

    var geometries = feature.loadGeometry()[0];
    for (var j = 0; j < geometries.length; j++) {
        this.makeRoomFor('circle', 6);

        var x = geometries[j].x;
        var y = geometries[j].y;

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

        var vertex0 = this.addCircleVertex(x, y, -1, -1);
        var vertex1 = this.addCircleVertex(x, y, 1, -1);
        var vertex2 = this.addCircleVertex(x, y, 1, 1);
        var vertex3 = this.addCircleVertex(x, y, -1, 1);

        this.addCircleElement(vertex0, vertex1, vertex2);
        this.addCircleElement(vertex0, vertex3, vertex2);
    }

};
