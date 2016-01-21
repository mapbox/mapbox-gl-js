'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');
var MapboxGLFunction = require('mapbox-gl-function');

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

    resolveLayout: function() {
        StyleLayer.prototype.resolveLayout.apply(this, arguments);

        if (this.layout && this.layout['symbol-placement'] === 'line') {
            if (!this.layout.hasOwnProperty('text-rotation-alignment')) {
                this.layout['text-rotation-alignment'] = 'map';
            }
            if (!this.layout.hasOwnProperty('icon-rotation-alignment')) {
                this.layout['icon-rotation-alignment'] = 'map';
            }
        }
    },

    recalculate: function(zoom) {
        StyleLayer.prototype.recalculate.apply(this, arguments);

        // the -size properties are used both as layout and paint.
        // In the spec they are layout properties. This adds them
        // as paint properties.
        this.paint['text-size'] = MapboxGLFunction.interpolated(this.layout['text-size'])(zoom);
        this.paint['icon-size'] = MapboxGLFunction.interpolated(this.layout['icon-size'])(zoom);
    }

});
