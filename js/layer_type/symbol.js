'use strict';

var Buffer = require('../data/buffer');

var SYMBOL_ATTRIBUTES = [{
    name: 'pos',
    components: 2,
    type: Buffer.AttributeType.SHORT,
    value: function(x, y) {
        return [x, y];
    }
}, {
    name: 'offset',
    components: 2,
    type: Buffer.AttributeType.SHORT,
    value: function(x, y, ox, oy) {
        return [
            Math.round(ox * 64), // use 1/64 pixels for placement
            Math.round(oy * 64)
        ];
    }
}, {
    name: 'data1',
    components: 4,
    type: Buffer.AttributeType.UNSIGNED_BYTE,
    value: function(x, y, ox, oy, tx, ty, minzoom, maxzoom, labelminzoom) {
        return [
            tx / 4, /* tex */
            ty / 4, /* tex */
            (labelminzoom || 0) * 10, /* labelminzoom */
            0
        ];
    }
}, {
    name: 'data2',
    components: 2,
    type: Buffer.AttributeType.UNSIGNED_BYTE,
    value: function(x, y, ox, oy, tx, ty, minzoom, maxzoom) {
        return [
            (minzoom || 0) * 10, /* minzoom */
            Math.min(maxzoom || 25, 25) * 10 /* minzoom */
        ];
    }
}];

module.exports = {

    type: 'symbol',

    shaders: {
        glyph: {
            vertexBuffer: 'glyphVertex',
            elementBuffer: 'glyphElement',
            attributes: SYMBOL_ATTRIBUTES
        },
        icon: {
            vertexBuffer: 'iconVertex',
            elementBuffer: 'iconElement',

            attributes: SYMBOL_ATTRIBUTES
        },
        collisionBox: {
            vertexBuffer: 'collisionBoxVertex',

            attributes: [{
                name: 'pos',
                components: 2,
                type: Buffer.AttributeType.SHORT,
                value: function(point) {
                    return [ point.x, point.y ];
                }
            }, {
                name: 'extrude',
                components: 2,
                type: Buffer.AttributeType.SHORT,
                value: function(point, extrude) {
                    return [
                        Math.round(extrude.x),
                        Math.round(extrude.y)
                    ];
                }
            }, {
                name: 'data',
                components: 2,
                type: Buffer.AttributeType.UNSIGNED_BYTE,
                value: function(point, extrude, maxZoom, placementZoom) {
                    return [
                        maxZoom * 10,
                        placementZoom * 10
                    ];
                }
            }]
        }
    }
};
