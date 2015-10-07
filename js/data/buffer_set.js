'use strict';

var Buffer = require('./buffer');

module.exports = BufferSet;

var fillVertexOptions = {type: Buffer.BufferType.VERTEX, attributes: [
    {name: 'pos', components: 2, type: Buffer.AttributeType.SHORT}
]};

var lineVertexOptions = {type: Buffer.BufferType.VERTEX, attributes: [
    {name: 'pos',  components: 2, type: Buffer.AttributeType.SHORT},
    {name: 'data', components: 4, type: Buffer.AttributeType.BYTE}
]};

var symbolVertexOptions = {type: Buffer.BufferType.VERTEX, attributes: [
    {name: 'pos',    components: 2, type: Buffer.AttributeType.SHORT},
    {name: 'offset', components: 2, type: Buffer.AttributeType.SHORT},
    {name: 'data1',  components: 4, type: Buffer.AttributeType.UNSIGNED_BYTE},
    {name: 'data2',  components: 2, type: Buffer.AttributeType.UNSIGNED_BYTE}
]};

var collisionBoxVertexOptions = {type: Buffer.BufferType.VERTEX, attributes: [
    {name: 'pos',     components: 2, type: Buffer.AttributeType.SHORT},
    {name: 'extrude', components: 2, type: Buffer.AttributeType.SHORT},
    {name: 'data',    components: 2, type: Buffer.AttributeType.UNSIGNED_BYTE}
]};

var triangleElementOptions = {type: Buffer.BufferType.ELEMENT, attributes: [
    {name: 'vertices', components: 3, type: Buffer.ELEMENT_ATTRIBUTE_TYPE}
]};

var outlineElementOptions = {type: Buffer.BufferType.ELEMENT, attributes: [
    {name: 'vertices', components: 2, type: Buffer.ELEMENT_ATTRIBUTE_TYPE}
]};

var bufferOptions = {
    glyphVertex: symbolVertexOptions,
    glyphElement: triangleElementOptions,
    iconVertex: symbolVertexOptions,
    iconElement: triangleElementOptions,
    circleVertex: fillVertexOptions,
    circleElement: triangleElementOptions,
    fillVertex: fillVertexOptions,
    fillElement: triangleElementOptions,
    outlineElement: outlineElementOptions,
    lineVertex: lineVertexOptions,
    lineElement: triangleElementOptions,
    collisionBoxVertex: collisionBoxVertexOptions
};

function BufferSet(bufferset) {
    bufferset = bufferset || {};

    for (var id in bufferOptions) {
        bufferset[id] = new Buffer(bufferset[id] || bufferOptions[id]);
    }

    return bufferset;
}
