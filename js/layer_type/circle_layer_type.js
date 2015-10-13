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
            }]

        }
    }

};
