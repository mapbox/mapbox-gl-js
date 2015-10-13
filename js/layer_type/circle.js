'use strict';

var Buffer = require('../data/buffer');

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
    }

};
