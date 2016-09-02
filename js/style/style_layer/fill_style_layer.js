'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function FillStyleLayer() {
    StyleLayer.apply(this, arguments);
}

FillStyleLayer.prototype = util.inherit(StyleLayer, {

    getPaintValue: function(name, globalProperties, featureProperties) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return StyleLayer.prototype.getPaintValue.call(this, 'fill-color', globalProperties, featureProperties);
        } else {
            return StyleLayer.prototype.getPaintValue.call(this, name, globalProperties, featureProperties);
        }
    },

    getPaintValueStopZoomLevels: function(name) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return StyleLayer.prototype.getPaintValueStopZoomLevels.call(this, 'fill-color');
        } else {
            return StyleLayer.prototype.getPaintValueStopZoomLevels.call(this, arguments);
        }
    },

    getPaintInterpolationT: function(name, zoom) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return StyleLayer.prototype.getPaintInterpolationT.call(this, 'fill-color', zoom);
        } else {
            return StyleLayer.prototype.getPaintInterpolationT.call(this, name, zoom);
        }
    },

    isPaintValueFeatureConstant: function(name) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return StyleLayer.prototype.isPaintValueFeatureConstant.call(this, 'fill-color');
        } else {
            return StyleLayer.prototype.isPaintValueFeatureConstant.call(this, name);
        }
    },

    isPaintValueZoomConstant: function(name) {
        if (name === 'fill-outline-color' && this.getPaintProperty('fill-outline-color') === undefined) {
            return StyleLayer.prototype.isPaintValueZoomConstant.call(this, 'fill-color');
        } else {
            return StyleLayer.prototype.isPaintValueZoomConstant.call(this, name);
        }
    }

});

module.exports = FillStyleLayer;
