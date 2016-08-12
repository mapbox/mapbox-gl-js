'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function ExtrusionStyleLayer() {
    StyleLayer.apply(this, arguments);
}

ExtrusionStyleLayer.prototype = util.inherit(StyleLayer, {

    getPaintValue: function(name, globalProperties, featureProperties) {
        if (name === 'extrusion-outline-color' && this.getPaintProperty('extrusion-outline-color') === undefined) {
            return StyleLayer.prototype.getPaintValue.call(this, 'extrusion-color', globalProperties, featureProperties);
        } else {
            // This is to account for the case where extrusion-outline-color is defined but a feature property specified in the function is undefined
            var paintValue = StyleLayer.prototype.getPaintValue.call(this, name, globalProperties, featureProperties);
            return paintValue || StyleLayer.prototype.getPaintValue.call(this, 'extrusion-color', globalProperties, featureProperties);
        }
    },

    getPaintValueStopZoomLevels: function(name) {
        if (name === 'extrusion-outline-color' && this.getPaintProperty('extrusion-outline-color') === undefined) {
            return StyleLayer.prototype.getPaintValueStopZoomLevels.call(this, 'extrusion-color');
        } else {
            return StyleLayer.prototype.getPaintValueStopZoomLevels.call(this, arguments);
        }
    },

    getPaintInterpolationT: function(name, zoom) {
        if (name === 'extrusion-outline-color' && this.getPaintProperty('extrusion-outline-color') === undefined) {
            return StyleLayer.prototype.getPaintInterpolationT.call(this, 'extrusion-color', zoom);
        } else {
            return StyleLayer.prototype.getPaintInterpolationT.call(this, name, zoom);
        }
    },

    isPaintValueFeatureConstant: function(name) {
        if (name === 'extrusion-outline-color' && this.getPaintProperty('extrusion-outline-color') === undefined) {
            return StyleLayer.prototype.isPaintValueFeatureConstant.call(this, 'extrusion-color');
        } else {
            return StyleLayer.prototype.isPaintValueFeatureConstant.call(this, name);
        }
    },

    isPaintValueZoomConstant: function(name) {
        if (name === 'extrusion-outline-color' && this.getPaintProperty('extrusion-outline-color') === undefined) {
            return StyleLayer.prototype.isPaintValueZoomConstant.call(this, 'extrusion-color');
        } else {
            return StyleLayer.prototype.isPaintValueZoomConstant.call(this, name);
        }
    }

});

module.exports = ExtrusionStyleLayer;
