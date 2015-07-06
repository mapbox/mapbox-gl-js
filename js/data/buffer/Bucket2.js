var Buffer = require('./buffer2');
var util = require('../util/util');

// TODO absorb *_bucket functionality
// TODO absorb painter functionality
// TODO absorb draw_* functionality
// TODO absorb gl_util functionality

function Bucket(options) {
    this.mode = options.mode || Bucket.Mode.TRIANGLE;
    this.shader = options.shader;

    // Normalize vertex attributes
    this.vertexAttributes = {};
    for (var vertexAttributeName in options.vertexAttributes) {
        var vertexAttribute = options.vertexAttributes[vertexAttributeName];

        vertexAttribute.name = vertexAttributeName;
        vertexAttribute.components = vertexAttribute.components || 1;
        vertexAttribute.type = vertexAttribute.type || Bucket.AttributeTypes.UNSIGNED_BYTE;
        vertexAttribute.stale = true;
        util.assert(vertexAttribute.value);

        this.vertexAttributes[vertexAttributeName] = vertexAttribute;
    }
}

Bucket.prototype.setVertexAttributeValue = function(vertexAttributeName, value) {
    var vertexAttribute = this.vertexAttributes[vertexAttributeName];
    vertexAttribute.value = value || vertexAttribute.value;
    vertexAttribute.stale = true;
}

Bucket.prototype.bindVertexAttributes = function(vertexAttributeName) {
    var vertexAttribute = this.vertexAttributes[vertexAttributeName];
    if (vertexAttribute.stale) {
        vertexAttribute.buffer = (
            vertexAttribute.buffer ||
            new Buffer(Buffer.BufferTypes.VERTEX, [{
                name: vertexAttribute.name,
                components: vertexAttribute.components,
                type: vertexAttribute.type
            }]);

        if (vertexAttribute.value instanceof Function) {

            for (var index = 0; index < this.features.length; i++) {
                vertexAttribute.buffer.set(index)
            }

        }
    }
}

Bucket.prototype.updateVertexAttributeBuffer = function(vertexAttributeName) {

}

Bucket.prototype.draw = function(gl) {
    this.eachElementGroup(function(index, length) {

        this.bindVertexAttributes();

        gl.drawElements(
            gl[this.mode.name],
            length,
            gl.UNSIGNED_SHORT,    // TODO make configurable?
            buffer.getIndexOffset(index)
        );

    });
}

Bucket.Mode = {

    TRIANGLES: {
        name: 'TRIANGLES'
    }

}

Bucket.AttributeTypes = Buffer.AttributeTypes;

