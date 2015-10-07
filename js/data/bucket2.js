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

Bucket2.prototype.addFeatures = function() {
    var pushVertex = (function() {
        var vertexValue = [];
        for (var i = 0; i < this.type.attributes.length; i++) {
            var attribute = this.type.attributes[i];
            var attributeValue = attribute.value.apply(attribute, arguments);
            assert(attributeValue.length === attribute.components);
            vertexValue = vertexValue.concat(attributeValue);
        }
        this.elementGroups.current.vertexLength++;
        var index = this.buffers.circleVertex.push.apply(this.buffers.circleVertex, vertexValue);
        return index - this.elementGroups.current.vertexStartIndex;
    }).bind(this);

    var pushElement = (function(one, two, three) {
        this.elementGroups.current.elementLength++;
        return this.elementGroups.elementBuffer.push(one, two, three);
    }).bind(this);

    // TODO replace makeRoomFor with a sort of transactional system
    var makeRoomFor = this.elementGroups.makeRoomFor.bind(this.elementGroups);

    this.type.iterator(this.features, pushElement, pushVertex, makeRoomFor);
};
