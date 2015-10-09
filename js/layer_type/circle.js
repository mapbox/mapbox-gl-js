'use strict';

var Buffer = require('../data/buffer');
var assert = require('assert');

module.exports = {

    name: 'circle',

    shaders: {
        circle: {

            vertexBuffer: 'circleVertex',

            elementBuffer: 'circleElement',

            attributes: [{
                name: 'pos',
                components: 2,
                type: Buffer.AttributeType.SHORT,
                value: function(x, y, extrudeX, extrudeY) {
                    return [
                        (x * 2) + ((extrudeX + 1) / 2),
                        (y * 2) + ((extrudeY + 1) / 2)
                    ];
                }
            }],

            uniforms: [{
                name: 'color',
                components: 4,
                value: function() {
                    var color = this.paint['circle-color'];
                    var opacity = this.paint['circle-opacity'];
                    return color.map(function(colorComponent) {
                        return colorComponent * opacity * 255;
                    });
                }
            }, {
                name: 'size',
                value: function() {
                    return [this.paint['circle-radius']];
                }
            }, {
                name: 'blur',
                value: function() {
                    return [this.paint['circle-blur']];
                }
            }]

        },
    },


    iterator: function(features, push) {
        var EXTENT = 4096;

        for (var i = 0; i < features.length; i++) {
            var feature = features[i];
            var geometries = feature.loadGeometry()[0];
            for (var j = 0; j < geometries.length; j++) {
                this.elementGroups.makeRoomFor(6);

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

                var vertex0 = push.circleVertex(x, y, -1, -1);
                var vertex1 = push.circleVertex(x, y, 1, -1);
                var vertex2 = push.circleVertex(x, y, 1, 1);
                var vertex3 = push.circleVertex(x, y, -1, 1);
                this.elementGroups.current.vertexLength += 4;

                push.circleElement(vertex0, vertex1, vertex2);
                push.circleElement(vertex0, vertex3, vertex2);
                this.elementGroups.current.elementLength += 2;
            }
        }
    }

};
