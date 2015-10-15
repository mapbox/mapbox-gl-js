'use strict';

var Buffer = require('../data/buffer');

module.exports = {

    name: 'fill',

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
            }]
        }
    }

};
