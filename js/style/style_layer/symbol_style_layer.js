'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');

function SymbolStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = SymbolStyleLayer;

SymbolStyleLayer.prototype = util.inherit(StyleLayer, {

    isHidden: function() {
        if (StyleLayer.prototype.isHidden.apply(this, arguments)) return true;

        var isTextHidden = this.paint['text-opacity'] === 0 || !this.layout['text-field'];
        var isIconHidden = this.paint['icon-opacity'] === 0 || !this.layout['icon-image'];
        if (isTextHidden && isIconHidden) return true;

        return false;
    },

    getLayoutValue: function(name, zoom, zoomHistory) {
        if (name === 'text-rotation-alignment' &&
                this.getLayoutValue('symbol-placement', zoom, zoomHistory) === 'line' &&
                !this.getLayoutProperty('text-rotation-alignment')) {
            return 'map';
        } else if (name === 'icon-rotation-alignment' &&
                this.getLayoutValue('symbol-placement', zoom, zoomHistory) === 'line' &&
                !this.getLayoutProperty('icon-rotation-alignment')) {
            return 'map';
        } else {
            return StyleLayer.prototype.getLayoutValue.apply(this, arguments);
        }
    }

});
