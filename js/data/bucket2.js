var Buffer = require('./buffer2');
var util = require('../util/util');
var featureFilter = require('feature-filter');

function Bucket(options) {
    // The layer id of the primary layer associated with this bucket
    this.id = options.id;
    // The layer ids of secondary layers ref-ed to this bucket.
    // Truly supporting multiple layers for data driven styles is going to be a lift.
    this.layers = [];

    this.mode = options.mode || Bucket.Mode.TRIANGLES;
    this.elementVertexGenerator = options.elementVertexGenerator;
    this.shader = options.shader;
    this.buffers = options.buffers;
    this.elementBuffer = options.elementBuffer;
    this.isElementBufferStale = true;
    this.features = [];
    this.disableStencilTest = options.disableStencilTest;
    this.isInteractive = options.isInteractive;

    // Normalize vertex attributes
    this.vertexAttributes = {};
    for (var attributeName in options.vertexAttributes) {
        var attribute = options.vertexAttributes[attributeName];

        attribute.name = attribute.name || attributeName;
        attribute.components = attribute.components || 1;
        attribute.type = attribute.type || Bucket.AttributeTypes.UNSIGNED_BYTE;
        attribute.isStale = true;
        attribute.isFeatureConstant = !(attribute.value instanceof Function);
        attribute.buffer = options.vertexBuffer;
        util.assert(attribute.value !== undefined);

        this.vertexAttributes[attribute.name] = attribute;
    }
}

Bucket.prototype.serialize = function() {
    this.refreshBuffers();

    var serializedVertexAttributes = {};
    this.eachVertexAttribute(function(attribute) {
        serializedVertexAttributes[attribute.name] = util.extend(
            { },
            attribute,
            { value: attribute.isFeatureConstant ? attribute.value : null }
        );
    });

    return {
        id: this.id,
        mode: this.mode,
        vertexAttributes: serializedVertexAttributes,
        elementGroups: this.elementGroups,
        isSerializedMapboxBucket: true,
        shader: this.shader,
        elementLength: this.elementLength,
        vertexLength: this.vertexLength,
        elementBuffer: this.elementBuffer,
        disableStencilTest: this.disableStencilTest
    }
}

Bucket.prototype.isMapboxBucket = true;

Bucket.prototype.setVertexAttributeValue = function(vertexAttributeName, value) {
    var vertexAttribute = this.vertexAttributes[vertexAttributeName];
    vertexAttribute.value = value || vertexAttribute.value;
    vertexAttribute.isStale = true;
}

Bucket.prototype.eachFeature = function(callback) {
    for (var i = 0; i < this.features.length; i++) {
        callback(this.features[i]);
    }
}

Bucket.prototype.eachVertexAttribute = function(filters, callback) {
    if (arguments.length === 1) {
        callback = filters;
        filters = {};
    }

    for (var attributeName in this.vertexAttributes) {
        var attribute = this.vertexAttributes[attributeName];

        if (filters.isStale !== undefined && filters.isStale !== attribute.isStale) continue;
        if (filters.isFeatureConstant !== undefined && filters.isFeatureConstant !== attribute.isFeatureConstant) continue;

        callback(attribute);
    }
}

Bucket.prototype.refreshBuffers = function() {
    var that = this;

    var staleVertexAttributes = [];
    this.eachVertexAttribute({isStale: true, isFeatureConstant: false}, function(attribute) {
        staleVertexAttributes.push(attribute);
    });

    // Avoid iterating over everything if buffers are up to date
    if (!staleVertexAttributes.length && !this.isElementBufferStale) return;

    // Refresh vertex attribute buffers
    var vertexIndex = 0;
    function vertexCallback(data) {
        for (var j = 0; j < staleVertexAttributes.length; j++) {
            var attribute = staleVertexAttributes[j];
            that.buffers[attribute.buffer].setAttribute(vertexIndex, attribute.name, attribute.value(data));
        }
        elementGroup.vertexLength++;
        return vertexIndex++;
    }

    // Refresh element buffers
    var elementIndex = 0;
    function elementCallback(data) {
        if (that.isElementBufferStale) {
            that.buffers[that.elementBuffer].add(data);
        }
        elementGroup.elementLength++;
        return elementIndex++;
    }

    // Refresh element groups
    var elementGroup = { vertexIndex: 0, elementIndex: 0 };
    var elementGroups = this.elementGroups = [];
    function pushElementGroup(vertexIndexEnd, elementIndexEnd) {
        elementGroup.vertexLength = vertexIndexEnd - elementGroup.vertexIndex;
        elementGroup.elementLength = elementIndexEnd - elementGroup.elementIndex;
        elementGroups.push(elementGroup);
        elementGroup = { vertexIndex: vertexIndexEnd, elementIndex: elementIndexEnd };
    }

    // Iterate over all the features, invoking the other callbacks
    this.eachFeature(function(feature) {
        var featureVertexIndex = vertexIndex;
        var featureElementIndex = elementIndex;
        that.elementVertexGenerator(feature, vertexCallback, elementCallback);
        if (elementGroup.vertexLength > Buffer.elementGroup) {
            pushElementGroup(featureVertexIndex, featureElementIndex);
        }
    });
    pushElementGroup(vertexIndex, elementIndex);

    for (var k in staleVertexAttributes) staleVertexAttributes[k].isStale = false;
    this.isElementBufferStale = false;
    this.vertexLength = vertexIndex;
    this.elementLength = elementIndex;

}

Bucket.Mode = {
    TRIANGLES: {
        name: 'TRIANGLES',
        verticiesPerElement: 3
    }
}

Bucket.AttributeTypes = Buffer.AttributeTypes;

Bucket.ELEMENT_GROUP_VERTEX_LENGTH = 65535;

module.exports = Bucket;
