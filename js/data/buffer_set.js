'use strict';

var Buffer = require('./buffer');
var LayerType = require('../layer_type');

module.exports = BufferSet;

var bufferOptions = {
    glyphVertex: createVertexOptions(LayerType.symbol, 'glyph'),
    glyphElement: createElementOptions(LayerType.symbol, 'glyph'),
    iconVertex: createVertexOptions(LayerType.symbol, 'icon'),
    iconElement: createElementOptions(LayerType.symbol, 'icon'),
    circleVertex: createVertexOptions(LayerType.circle, 'circle'),
    circleElement: createElementOptions(LayerType.circle, 'circle'),
    fillVertex: createVertexOptions(LayerType.fill, 'fill'),
    fillElement: createElementOptions(LayerType.fill, 'fill'),
    outlineElement: createSecondElementOptions(LayerType.fill, 'fill'),
    lineVertex: createVertexOptions(LayerType.line, 'line'),
    lineElement: createElementOptions(LayerType.line, 'line'),
    collisionBoxVertex: createVertexOptions(LayerType.symbol, 'collisionBox')
};

function BufferSet(bufferset) {
    bufferset = bufferset || {};

    for (var id in bufferOptions) {
        bufferset[id] = new Buffer(bufferset[id] || bufferOptions[id]);
    }

    return bufferset;
}

function createElementOptions(type, shader) {
    return {
        type: Buffer.BufferType.ELEMENT,
        attributes: [{
            name: 'vertices',
            components: type.shaders[shader].elementBufferComponents || 3,
            type: Buffer.ELEMENT_ATTRIBUTE_TYPE
        }]
    };
}

function createSecondElementOptions(type, shader) {
    return {
        type: Buffer.BufferType.ELEMENT,
        attributes: [{
            name: 'vertices',
            components: type.shaders[shader].secondElementBufferComponents || 3,
            type: Buffer.ELEMENT_ATTRIBUTE_TYPE
        }]
    };
}

function createVertexOptions(type, shader) {
    return {
        type: Buffer.BufferType.VERTEX,
        attributes: type.shaders[shader].attributes
    };
}
