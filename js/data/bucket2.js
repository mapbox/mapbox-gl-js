var Buffer = require('./buffer2');
var util = require('../util/util');

// TODO add bufferGroup property to attributes, specifying buffers that ought to be
// grouped together

// TODO create shader in constructor, store attribute locations on attribute objects

// TODO add "second element buffer"

// TODO figure out how to send between worker and main thread

function Bucket(options) {
    this.mode = options.mode || Bucket.Mode.TRIANGLES;
    this.eachVertex = options.eachVertex;
    this.eachElement = options.eachElement;
    this.featureGenerator = options.featureGenerator;
    this.elementVertexGenerator = options.elementVertexGenerator;
    this.shader = options.shader;

    // TODO send this responsability upwards. This is not the bucket's job.
    this.filter = options.filter;
    this.features = [];

    this.createElementBuffer();

    // Normalize vertex attributes
    this.vertexAttributes = {};
    for (var vertexAttributeName in options.vertexAttributes) {
        var vertexAttribute = options.vertexAttributes[vertexAttributeName];

        vertexAttribute.name = vertexAttributeName;
        vertexAttribute.components = vertexAttribute.components || 1;
        vertexAttribute.type = vertexAttribute.type || Bucket.AttributeTypes.UNSIGNED_BYTE;
        vertexAttribute.isStale = true;
        util.assert(vertexAttribute.value !== undefined);

        this.vertexAttributes[vertexAttributeName] = vertexAttribute;
    }
}

Bucket.prototype.isMapboxBucket = true;

Bucket.prototype.setVertexAttributeValue = function(vertexAttributeName, value) {
    var vertexAttribute = this.vertexAttributes[vertexAttributeName];
    vertexAttribute.value = value || vertexAttribute.value;
    vertexAttribute.isStale = true;
}

Bucket.prototype.eachFeature = function(callback) {
    this.featureGenerator(callback);
}

Bucket.prototype.eachVertexAttribute = function(options, callback) {
    if (arguments.length === 1) {
        callback = options;
        options = {};
    }

    for (var attributeName in this.attributes) {
        var attribute = this.attributes[attributeName];

        if (options.isStale !== undefined && options.isStale !== attribute.isStale) continue;
        if (options.isFeatureConstant !== undefined && options.isFeatureConstant !== (attribute.value instanceof Function)) continue;

        callback(attribute);
    }
}

Bucket.prototype.getStaleVertexAttributes = function() {
    var staleVertexAttributes = [];
    this.eachVertexAttribute({isStale: true}, function(attribute) {
        staleVertexAttributes.push(attribute);
    });
    return staleVertexAttributes;
}

Bucket.prototype.createElementBuffer = function() {
    this.elementBuffer = new Buffer({
        type: Buffer.BufferTypes.ELEMENT,
        attributes: {
            verticies: {
                components: this.mode.verticiesPerElement,
                type: Bucket.AttributeTypes.UNSIGNED_SHORT
            }
        }
    });

    this.isElementBufferStale = true;
}

// TODO support buffer groups
Bucket.prototype.createVertexAttributeBuffers = function(attributeName) {
    this.eachVertexAttribute(function(attribute) {
        if (attribute.value instanceof Function && !attribute.buffer) {
            attribute.buffer = new Buffer({
                type: Buffer.Type.VERTEX,
                attributes: [{
                    name: attribute.name,
                    components: attribute.components,
                    type: attribute.type
                }]
            });
        }
    });
}

Bucket.prototype.refreshBuffers = function() {

    // Avoid iterating over everything if buffers are up to date
    var staleVertexAttributes = this.getStaleVertexAttributes();
    if (!staleVertexAttributes.length && !this.isElementBufferStale) return;


    // Refresh vertex attribute buffers
    var vertexIndex = 0;
    this.createVertexAttributeBuffers();
    function vertexCallback(data) {
        for (var j = 0; j < staleVertexAttributes.length; j++) {
            var attribute = staleVertexAttributes[j];
            attribute.buffer.setAttribute(index, attribute.name, attribute.value(data));
        }
        vertexIndex++;
        elementGroup.vertexLength++;
    }

    // Refresh element buffers
    var elementIndex = 0;
    function elementCallback(data) {
        if (this.isElementBufferStale) {
            this.elementBuffer.setAttribute({verticies: data});
        }
        elementIndex++;
        elementGroup.elementLength++;
    }

    // Refresh element groups
    // TODO only refresh element groups if element buffer is stale
    var elementGroup = { vertexIndex: 0, elementIndex: 0 };
    this.elementGroups = [];
    function pushElementGroup(vertexIndexEnd, elementIndexEnd) {
        elementIndex.vertexLength = vertexIndexEnd - elementIndex.vertexIndex;
        elementIndex.elementLength = elementIndexEnd - elementIndex.elementIndex;
        this.elementGroups.push(elementIndex);
        elementGroup = { vertexIndex: vertexIndexEnd, elementIndex: elementIndexEnd };
    }

    // Iterate over all the features, invoking the other callbacks
    this.eachFeature(function(feature) {
        var featureVertexIndex = vertexIndex;
        var featureElementIndex = elementIndex;
        this.elementVertexGenerator(feature, vertexIndex, vertexCallback, elementIndex, elementCallback);
        if (elementGroup.vertexLength > Buffer.elementGroup) {
            pushElementGroup(featureVertexIndex, featureElementIndex);
        }
    });
    pushElementGroup(vertexIndex, elementIndex);

    this.vertexLength = vertexIndex;
    this.elementLength = elementIndex;

    // Mark everything as not stale
    for (var attributeName in attributes) {
        attributes[attributeName].isStale = false;
    }
    this.isElementBufferStale = false;

}

Bucket.prototype.draw = function(gl, tile) {

    // short-circuit if tile is empty
    if (!this.elementLength) return;

    // Allow circles to be drawn across boundaries, so that
    // large circles are not clipped to tiles
    // TODO make configurable
    gl.disable(gl.STENCIL_TEST);

    gl.switchShader(this.shader, tile.posMatrix, tile.exMatrix);

    this.refreshBuffers();

    this.eachVertexAttribute({isFeatureConstant: true}, function(attribute) {

        var attributeShaderLocation = this.shader['a_' + attribute.name];
        util.assert(attributeShaderLocation !== 0);
        util.assert(attributeShaderLocation !== undefined);

        gl.disableVertexAttribArray(shader['a_' + attribute.name]);
        gl['vertexAttrib' + attribute.components + 'fv'](attributeShaderLocation, wrap(attribute.value));

    });

    this.eachElementGroup(function(group) {

        this.eachVertexAttribute({isFeatureConstant: false}, function(attribute) {
            var attributeShaderLocation = this.shader['a_' + attribute.name];

            util.assert(attributeShaderLocation !== undefined);

            // TODO use buffer groups to reduce calls to bind
            attribute.buffer.bind(gl);
            attribute.buffer.bindVertexAttribute(gl, attributeShaderLocation, group.vertexIndex, attribute.name);
        });

        gl.drawElements(
            gl[this.mode.name],
            group.elementLength,
            gl.UNSIGNED_SHORT,    // TODO make configurable?
            this.elementBuffer.getIndexOffset(group.elementIndex)
        );

    });

    gl.enable(gl.STENCIL_TEST);
}

Bucket.Mode = {

    TRIANGLES: {
        name: 'TRIANGLES',
        verticiesPerElement: 3
    }

}

Bucket.AttributeTypes = Buffer.AttributeTypes;

Bucket.ELEMENT_GROUP_VERTEX_LENGTH = 65535;

function wrap(value) {
    return Array.isArray(value) ? value : [ value ];
}

module.exports = Bucket;
