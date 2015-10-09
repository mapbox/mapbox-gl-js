'use strict';

var ElementGroups = require('./element_groups');
var assert = require('assert');
var featureFilter = require('feature-filter');
var LayerType = require('../layer_type');

module.exports = Bucket2;

function Bucket2(buffers, options) {
    this.buffers = buffers;

    // TODO simplify this constructor
    this.z = options.z;
    this.overscaling = options.overscaling;
    this.collisionDebug = options.collisionDebug;
    this.layer = options.layer;
    this.type = LayerType[options.layer.type];
    this.id = options.layer.id;
    this['source-layer'] = options.layer['source-layer'];
    this.interactive = options.layer.interactive;
    this.minZoom = options.layer.minzoom;
    this.maxZoom = options.layer.maxzoom;
    this.filter = featureFilter(options.layer.filter);
    this.features = [];

    this.elementGroups = new ElementGroups(buffers[this.type.name + 'Vertex'], buffers[this.type.name + 'Element']);
}

Bucket2.prototype.createVertexBufferItem = function(shaderName, args) {
    var shaderOptions = this.type.shaders[shaderName];

    var value = [];
    for (var i = 0; i < shaderOptions.attributes.length; i++) {
        var attributeOptions = shaderOptions.attributes[i];
        value = value.concat(attributeOptions.value.apply(this, args));
    }
    return value;
}

Bucket2.prototype.addFeatures = function() {
    var push = {};
    var bucket = this;

    Object.keys(bucket.type.shaders).forEach(function(shaderName) {
        var shaderOptions = bucket.type.shaders[shaderName];
        var vertexBufferName = shaderOptions.vertexBuffer;
        var vertexBuffer = bucket.buffers[vertexBufferName];

        var elementBufferName = shaderOptions.elementBuffer;
        var elementBuffer = bucket.buffers[elementBufferName];

        push[vertexBufferName] = function() {
            bucket.elementGroups.current.vertexLength++;
            var item = bucket.createVertexBufferItem(shaderName, arguments);
            return vertexBuffer.push.apply(vertexBuffer, item) - bucket.elementGroups.current.vertexStartIndex;
        }

        push[elementBufferName] = function() {
            bucket.elementGroups.current.elementLength++;
            return elementBuffer.push.apply(elementBuffer, arguments);
        }
    }, bucket);

    bucket.type.iterator.call(bucket, bucket.features, push);
};
