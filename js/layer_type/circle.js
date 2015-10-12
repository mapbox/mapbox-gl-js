'use strict';

var Buffer = require('../data/buffer');

module.exports = {

    type: 'circle',

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
                    return [
                        color[0] * opacity,
                        color[1] * opacity,
                        color[2] * opacity,
                        opacity
                    ];
                }
            }, {
                name: 'size',
                value: function() {
                    return [this.paint['circle-radius']];
                }
            }, {
                name: 'blur',
                value: function() {
                    // antialiasing factor: this is a minimum blur distance that serves as
                    // a faux-antialiasing for the circle. since blur is a ratio of the circle's
                    // size and the intent is to keep the blur at roughly 1px, the two
                    // are inversely related.
                    var browser = require('../util/browser');
                    var antialias = 1 / browser.devicePixelRatio / this.paint['circle-radius'];
                    return [Math.max(this.paint['circle-blur'], antialias)];
                }
            }]

        }
    },


    addFeatures: function() {
        var EXTENT = 4096;

        for (var i = 0; i < this.features.length; i++) {
            var feature = this.features[i];
            var geometries = feature.loadGeometry()[0];
            for (var j = 0; j < geometries.length; j++) {
                this.elementGroups.circle.makeRoomFor(6);

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
        }
    }

};
