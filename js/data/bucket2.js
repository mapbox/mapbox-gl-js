var Buffer = require('./buffer2');
var util = require('../util/util');
var featureFilter = require('feature-filter');

/**
 * The `Bucket` class is responsible for managing all the style values, WebGL resources, and WebGL
 * configuration needed to render a particular layer. Ideally it will serve as the single point of
 * coupling between the "style" (style_*.js) and "gl" (painter.js) subsystems.
 *
 * Buckets are created in a worker thread, where they perform as much precompuation as possible
 * (namely populating `Buffer`s). Then they are serialized, transferred to the main thread, and
 * used by `painter.draw` to draw the layer.
 *
 * @class Bucket
 * @namespace Bucket
 * @private
 * @param options Configuration for the bucket.
 * @param {StyleLayer} options.layer
 * @param {string} options.elementBuffer The name of the buffer on this tile's instance of
 *    `BufferSet` that should be used for elements (e.g. `circleElement`).
 * @param {string} options.vertexBuffer The name of the buffer on this tile's instance of
 *    `BufferSet` that should be used for verticies (e.g. `circleVertex`).
 * @param {BucketMode} options.mode
 * @param {Bucket.ElementVertexGenerator} options.elementVertexGenerator
 * @param {string} options.shader The name of the shader used to draw this bucket (e.g. `circleShader`)
 * @param {BuffetSet} options.buffers
 * @param {boolean} options.disableStencilTest
 * @param {boolean} options.isInteractive This will be deprecated in the near future
 * @param {Object.<string, Bucket.VertexAttribute>} options.vertexAttributes
 */
function Bucket(options) {
    this.layer = options.layer;
    this.mode = options.mode || Bucket.Mode.TRIANGLES;
    this.elementVertexGenerator = options.elementVertexGenerator;
    this.shader = options.shader;
    this.buffers = options.buffers;
    this.elementBuffer = options.elementBuffer;
    this.disableStencilTest = options.disableStencilTest;

    this.isElementBufferStale = true;
    this.interactive = this.layer.interactive; // TODO deprecate
    this.features = [];
    this.id = this.layer.id;

    // The layer ids of secondary layers ref-ed to this bucket will be inserted into this array.
    // Initializing this property prevents errors from being thrown but this class does not fully
    // implement ref-ed layers. Truly supporting ref-ed layers for data driven styles is going to be
    // a large lift.
    this.layers = [];

    // Normalize vertex attributes
    this.vertexAttributes = {};
    for (var attributeName in options.vertexAttributes) {
        var attribute = options.vertexAttributes[attributeName];

        attribute.name = attribute.name || attributeName;
        attribute.components = attribute.components || 1;
        attribute.type = attribute.type || BucketAttributeType.UNSIGNED_BYTE;
        attribute.isStale = true;
        attribute.isFeatureConstant = !(attribute.value instanceof Function);
        attribute.buffer = options.vertexBuffer;
        util.assert(attribute.value !== undefined);

        this.vertexAttributes[attribute.name] = attribute;
    }
}

/**
 * @private
 * @returns a serialized version of this instance of `Bucket`, suitable for transfer between the
 * worker thread and the main thread.
 */
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

/**
 * Set a new vertex attribute value. The vertex attribute buffer will not be updated until
 * there is a call to `refreshBuffers`.
 *
 * @private
 * @param callback
 */
Bucket.prototype.setVertexAttributeValue = function(vertexAttributeName, value) {
    var vertexAttribute = this.vertexAttributes[vertexAttributeName];
    vertexAttribute.value = value || vertexAttribute.value;
    vertexAttribute.isStale = true;
}

/**
 * Iterate over this bucket's features
 *
 * @private
 * @param callback
 */
Bucket.prototype.eachFeature = function(callback) {
    for (var i = 0; i < this.features.length; i++) {
        callback(this.features[i]);
    }
}

/**
 * Iterate over this bucket's vertex attributes
 *
 * @private
 * @param [filter]
 * @param {boolean} filter.isStale
 * @param {boolean} filter.isFeatureConstant
 * @param callback
 */
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

/**
 * Refresh the elements buffer and/or vertex attribute buffers if nescessary.
 *
 * @private
 */
Bucket.prototype.refreshBuffers = function() {
    var that = this;

    var staleVertexAttributes = [];
    this.eachVertexAttribute({isStale: true, isFeatureConstant: false}, function(attribute) {
        staleVertexAttributes.push(attribute);
    });

    // Avoid iterating over everything if all buffers are up to date
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

    // Refresh the element buffer
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

    // Iterate over all features
    this.eachFeature(function(feature) {
        var featureVertexIndex = vertexIndex;
        var featureElementIndex = elementIndex;
        that.elementVertexGenerator(feature, vertexCallback, elementCallback);
        if (elementGroup.vertexLength > Buffer.elementGroup) {
            pushElementGroup(featureVertexIndex, featureElementIndex);
        }
    });
    pushElementGroup(vertexIndex, elementIndex);

    // Update object state, makring everything as not stale and updating lengths.
    for (var k in staleVertexAttributes) staleVertexAttributes[k].isStale = false;
    this.isElementBufferStale = false;
    this.vertexLength = vertexIndex;
    this.elementLength = elementIndex;

}

/**
 * @private
 * @constant {number}
 */
Bucket.prototype.isMapboxBucket = true;

/**
 * Specifies the WebGL drawElements mode targeted by this buffer. See the "mode" section at
 * https://msdn.microsoft.com/en-us/library/dn302396.aspx
 *
 * @enum
 * @private
 */
Bucket.Mode = {
    TRIANGLES: {
        name: 'TRIANGLES',
        verticiesPerElement: 3
    }
}

/**
 * @see Buffer.AttributeType
 * @private
 */
Bucket.AttributeType = Buffer.AttributeType;

/**
 * WebGL verticies are addressed by an unsigned 16 bit integer, limiting us to 2^16 = 65535
 * verticies per `drawElements` call. For this reason, we divide features into groups, each
 * of which contains less than 65535 verticies and is rendered seperately.
 *
 * @constant {number}
 * @private
 */
Bucket.ELEMENT_GROUP_VERTEX_LENGTH = 65535;

module.exports = Bucket;
