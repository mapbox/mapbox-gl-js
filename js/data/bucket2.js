'use strict';

var ElementGroups = require('./element_groups');
var featureFilter = require('feature-filter');
var LayerType = require('../layer_type');
var util = require('../util/util');
var assert = require('assert');

module.exports = Bucket2;

function Bucket2(buffers, options) {
    this.buffers = buffers;

    // TODO simplify, remove as many of these as possible
    this.z = options.z;
    this.zoom = options.z;
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
    this.layoutProperties = options.layoutProperties;

    util.extend(this, LayerType[options.layer.type]);

    this.elementGroups = {};

    Object.keys(this.shaders).forEach(function(shaderName) {
        var shaderOptions = this.shaders[shaderName];

        var vertexBufferName = shaderOptions.vertexBuffer;
        var elementBufferName = shaderOptions.elementBuffer;
        var secondElementBufferName = shaderOptions.secondElementBuffer;

        this.elementGroups[shaderName] = new ElementGroups(
            this.buffers[vertexBufferName],
            this.buffers[elementBufferName],
            this.buffers[secondElementBufferName]
        );

        this['add' + capitalize(vertexBufferName)] = function() {
            return addVertex(shaderName, arguments);
        };

        if (elementBufferName) {
            this['add' + capitalize(elementBufferName)] = function(one, two, three) {
                return addElement(shaderName, one, two, three);
            };
        }

        if (secondElementBufferName) {
            this['add' + capitalize(secondElementBufferName)] = function(one, two, three) {
                return addSecondElement(shaderName, one, two, three);
            };
        }
    }, this);

    var addVertex = (function(shaderName, args) {
        var shaderOptions = this.shaders[shaderName];

        var elementGroups = this.elementGroups[shaderName];
        elementGroups.current.vertexLength++;

        // TODO automatically handle makeRoomFor
        // TODO insert into element buffer directly?
        var value = [];
        for (var i = 0; i < shaderOptions.attributes.length; i++) {
            var attributeOptions = shaderOptions.attributes[i];
            var subvalue = attributeOptions.value.apply(this, args);
            value = value.concat(subvalue);
        }

        var vertexBufferName = shaderOptions.vertexBuffer;
        var vertexBuffer = this.buffers[vertexBufferName];
        return vertexBuffer.push.apply(vertexBuffer, value) - elementGroups.current.vertexStartIndex;
    }).bind(this);

    var addElement = (function(shaderName, one, two, three) {
        var shaderOptions = this.shaders[shaderName];

        var elementGroups = this.elementGroups[shaderName];
        elementGroups.current.elementLength++;

        var elementBufferName = shaderOptions.elementBuffer;
        var elementBuffer = this.buffers[elementBufferName];

        assert(!isNaN(one) && !isNaN(two));

        return elementBuffer.push(one, two, three);
    }).bind(this);

    var addSecondElement = (function(shaderName, one, two, three) {
        var shaderOptions = this.shaders[shaderName];

        var elementGroups = this.elementGroups[shaderName];
        elementGroups.current.secondElementLength++;

        var secondElementBufferName = shaderOptions.secondElementBuffer;
        var secondElementBuffer = this.buffers[secondElementBufferName];

        assert(!isNaN(one) && !isNaN(two));

        return secondElementBuffer.push(one, two, three);
    }).bind(this);
}


function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
