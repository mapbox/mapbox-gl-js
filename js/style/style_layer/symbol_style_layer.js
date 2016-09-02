'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function SymbolStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = SymbolStyleLayer;

SymbolStyleLayer.prototype = util.inherit(StyleLayer, {

    getLayoutValue: function(name, globalProperties, featureProperties) {
        if (name === 'text-rotation-alignment' &&
                this.getLayoutValue('symbol-placement', globalProperties, featureProperties) === 'line' &&
                !this.getLayoutProperty('text-rotation-alignment')) {
            return 'map';
        } else if (name === 'icon-rotation-alignment' &&
                this.getLayoutValue('symbol-placement', globalProperties, featureProperties) === 'line' &&
                !this.getLayoutProperty('icon-rotation-alignment')) {
            return 'map';
        // If unspecified `text-pitch-alignment` inherits `text-rotation-alignment`
        } else if (name === 'text-pitch-alignment' && !this.getLayoutProperty('text-pitch-alignment')) {
            return this.getLayoutValue('text-rotation-alignment');
        } else {
            return StyleLayer.prototype.getLayoutValue.apply(this, arguments);
        }
    }

});
