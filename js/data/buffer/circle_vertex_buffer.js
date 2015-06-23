'use strict';

var util = require('../../util/util');
var Buffer = require('./buffer');

module.exports = CircleVertexBuffer;

/**
 * This contains the data that displays circle markers on the map,
 * including their centerpoint
 */
function CircleVertexBuffer(buffer) {
    Buffer.call(this, buffer);
}

CircleVertexBuffer.prototype = util.inherit(Buffer, {
    defaultLength: 2048 * 16,

    addPosition: function(index, x, y, extrudeX, extrudeY) {
        this.resize();

        // pack the extrusion of -1 or 1 into one short
        this.shorts[index * this.itemSize / 2 + 0] = (x * 2) + ((extrudeX + 1) / 2);
        this.shorts[index * this.itemSize / 2 + 1] = (y * 2) + ((extrudeY + 1) / 2);

        this.pos += this.itemSize;
    },

    add: function(index, offset, type, value) {
        if (type === 'color') {
            this.ubytes[index * this.itemSize + offset + 0] = value[0] * 255;
            this.ubytes[index * this.itemSize + offset + 1] = value[1] * 255;
            this.ubytes[index * this.itemSize + offset + 2] = value[2] * 255;
            this.ubytes[index * this.itemSize + offset + 3] = value[3] * 255;
        } else {
            this.ubytes[index * this.itemSize + offset + 0] = value;
        }
    }

});
