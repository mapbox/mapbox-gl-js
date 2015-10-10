'use strict';

var ElementGroups = require('./element_groups');
var assert = require('assert');
var featureFilter = require('feature-filter');
var LayerType = require('../layer_type');
var util = require('../util/util');

module.exports = Bucket2;

function Bucket2(buffers, options) {
    this.buffers = buffers;

    // TODO simplify, remove as many of these as possible
    this.z = options.z;
    this.overscaling = options.overscaling;
    this.collisionDebug = options.collisionDebug;
    this.layer = options.layer;
    this.id = options.layer.id;
    this['source-layer'] = options.layer['source-layer'];
    this.interactive = options.layer.interactive;
    this.minZoom = options.layer.minzoom;
    this.maxZoom = options.layer.maxzoom;
    this.filter = featureFilter(options.layer.filter);
    this.features = [];

    util.extend(this, LayerType[options.layer.type]);

    Object.keys(this.shaders).forEach(function(shaderName) {
        var shaderOptions = this.shaders[shaderName];
        var vertexBufferName = shaderOptions.vertexBuffer;
        var vertexBuffer = this.buffers[vertexBufferName];

        var elementBufferName = shaderOptions.elementBuffer;
        var elementBuffer = this.buffers[elementBufferName];

        // TODO automatically handle element groups

        this.elementGroups = new ElementGroups(buffers[this.type + 'Vertex'], buffers[this.type + 'Element']);

        this['add' + capitalize(vertexBufferName)] = function() {
            this.elementGroups.current.vertexLength++;

            // TODO insert into element buffer directly?
            var value = [];
            for (var i = 0; i < shaderOptions.attributes.length; i++) {
                var attributeOptions = shaderOptions.attributes[i];
                value = value.concat(attributeOptions.value.apply(this, arguments));
            }

            return vertexBuffer.push.apply(vertexBuffer, value) - this.elementGroups.current.vertexStartIndex;
        }

        this['add' + capitalize(elementBufferName)] = function(one, two, three) {
            this.elementGroups.current.elementLength++;
            return elementBuffer.push(one, two, three);
        }
    }, this);

}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
