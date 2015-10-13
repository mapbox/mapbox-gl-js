'use strict';

var Buffer = require('../data/buffer');

module.exports = {

    type: 'fill',

    shaders: {

        fill: {
            vertexBuffer: 'fillVertex',
            elementBuffer: 'fillElement',
            secondElementBuffer: 'outlineElement',

            secondElementBufferComponents: 2,

            attributes: [{
                name: 'pos',
                components: 2,
                type: Buffer.AttributeType.SHORT,
                value: function(x, y) {
                    return [x, y];
                }
            }],

            uniforms: [{
                name: 'color',
                components: 4,
                value: function() {
                    var color = this.paint['fill-color'];
                    var opacity = this.paint['fill-opacity'];
                    return color.map(function(colorComponent) {
                        return colorComponent * opacity * 255;
                    });
                }
            }]

        }
    }

};
