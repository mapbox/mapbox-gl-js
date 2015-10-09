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
    this.type.iterator.call(this, this.features);
};
