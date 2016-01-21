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
    },

    recalculate: function() {
        StyleLayer.prototype.recalculate.apply(this, arguments);

        if ((this.paint['text-opacity'] === 0 || !this.layout['text-field']) &&
            (this.paint['icon-opacity'] === 0 || !this.layout['icon-image'])) {
            this.hidden = true;
        } else {
            StyleLayer._premultiplyLayer(this.paint, 'text');
            StyleLayer._premultiplyLayer(this.paint, 'icon');
        }

        return !this.hidden;

    }

});
