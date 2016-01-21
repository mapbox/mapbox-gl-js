'use strict';

var util = require('../../util/util');
var StyleLayer = require('../style_layer');
var StyleDeclarationSet = require('../style_declaration_set');
var StyleTransition = require('../style_transition');


function SymbolStyleLayer() {
    StyleLayer.apply(this, arguments);
}

module.exports = SymbolStyleLayer;

SymbolStyleLayer.prototype = util.inherit(StyleLayer, {

    premultiply: function() {
        this.paint['text-color'] = util.premultiply(this.paint['text-color'], this.paint['text-opacity']);
        this.paint['text-halo-color'] = util.premultiply(this.paint['text-halo-color'], this.paint['text-opacity']);

        this.paint['icon-color'] = util.premultiply(this.paint['icon-color'], this.paint['icon-opacity']);
        this.paint['icon-halo-color'] = util.premultiply(this.paint['icon-halo-color'], this.paint['icon-opacity']);
    },

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

    cascade: function(classes, options, globalTrans) {
        StyleLayer.prototype.cascade.apply(this, arguments);

        // the -size properties are used both as layout and paint.
        // In the spec they are layout properties. This adds them
        // as internal paint properties.
        var resolvedLayout = new StyleDeclarationSet('layout', this.type, this.layout);
        this._transitions['text-size'] = new StyleTransition(resolvedLayout.values()['text-size'], undefined, globalTrans);
        this._transitions['icon-size'] = new StyleTransition(resolvedLayout.values()['icon-size'], undefined, globalTrans);
    }

});
