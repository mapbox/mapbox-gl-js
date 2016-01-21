'use strict';

var util = require('../util/util');
var StyleTransition = require('./style_transition');
var StyleDeclarationSet = require('./style_declaration_set');
var LayoutProperties = require('./layout_properties');
var PaintProperties = require('./paint_properties');

module.exports = StyleLayer;

StyleLayer.create = function(layer, refLayer) {
    var Classes = {
        background: require('./style_layer/background_style_layer'),
        circle: require('./style_layer/circle_style_layer'),
        fill: require('./style_layer/fill_style_layer'),
        line: require('./style_layer/line_style_layer'),
        raster: require('./style_layer/raster_style_layer'),
        symbol: require('./style_layer/symbol_style_layer')
    };
    return new Classes[(refLayer || layer).type](layer, refLayer);
};

function StyleLayer(layer, refLayer) {
    this._layer = layer;

    this.id = layer.id;
    this.ref = layer.ref;
    this.type = (refLayer || layer).type;
    this.source = (refLayer || layer).source;
    this['source-layer'] = (refLayer || layer)['source-layer'];
    this.minzoom = (refLayer || layer).minzoom;
    this.maxzoom = (refLayer || layer).maxzoom;
    this.filter = (refLayer || layer).filter;
    this.layout = (refLayer || layer).layout;

    // Resolved and cascaded paint properties.
    this._resolved = {}; // class name -> StyleDeclarationSet
    this._cascaded = {}; // property name -> StyleTransition
}

StyleLayer.prototype = {
    resolveLayout: function() {
        if (!this.ref) {
            this.layout = new LayoutProperties[this.type](this._layer.layout);

            if (this.layout['symbol-placement'] === 'line') {
                if (!this.layout.hasOwnProperty('text-rotation-alignment')) {
                    this.layout['text-rotation-alignment'] = 'map';
                }
                if (!this.layout.hasOwnProperty('icon-rotation-alignment')) {
                    this.layout['icon-rotation-alignment'] = 'map';
                }
            }
        }
    },

    setLayoutProperty: function(name, value) {
        if (value == null) {
            delete this.layout[name];
        } else {
            this.layout[name] = value;
        }
    },

    getLayoutProperty: function(name) {
        return this.layout[name];
    },

    resolvePaint: function() {
        for (var p in this._layer) {
            var match = p.match(/^paint(?:\.(.*))?$/);
            if (!match)
                continue;
            this._resolved[match[1] || ''] =
                new StyleDeclarationSet('paint', this.type, this._layer[p]);
        }
    },

    setPaintProperty: function(name, value, klass) {
        var declarations = this._resolved[klass || ''];
        if (!declarations) {
            declarations = this._resolved[klass || ''] =
                new StyleDeclarationSet('paint', this.type, {});
        }
        declarations[name] = value;
    },

    getPaintProperty: function(name, klass) {
        var declarations = this._resolved[klass || ''];
        if (!declarations)
            return undefined;
        return declarations[name];
    },

    cascade: function(classes, options, globalTrans, animationLoop) {
        for (var klass in this._resolved) {
            if (klass !== "" && !classes[klass])
                continue;

            var declarations = this._resolved[klass],
                values = declarations.values();

            for (var k in values) {
                var newDeclaration = values[k];
                var oldTransition = options.transition ? this._cascaded[k] : undefined;

                // Only create a new transition if the declaration changed
                if (!oldTransition || oldTransition.declaration.json !== newDeclaration.json) {
                    var newStyleTrans = declarations.transition(k, globalTrans);
                    var newTransition = this._cascaded[k] =
                        new StyleTransition(newDeclaration, oldTransition, newStyleTrans);

                    // Run the animation loop until the end of the transition
                    if (!newTransition.instant()) {
                        newTransition.loopID = animationLoop.set(newTransition.endTime - (new Date()).getTime());
                    }

                    if (oldTransition) {
                        animationLoop.cancel(oldTransition.loopID);
                    }
                }
            }
        }

        // the -size properties are used both as layout and paint.
        // In the spec they are layout properties. This adds them
        // as internal paint properties.
        if (this.type === 'symbol') {
            var resolvedLayout = new StyleDeclarationSet('layout', this.type, this.layout);
            this._cascaded['text-size'] = new StyleTransition(resolvedLayout.values()['text-size'], undefined, globalTrans);
            this._cascaded['icon-size'] = new StyleTransition(resolvedLayout.values()['icon-size'], undefined, globalTrans);
        }
    },

    recalculate: function(z, zoomHistory) {
        var type = this.type,
            calculated = this.paint = new PaintProperties[type]();

        for (var k in this._cascaded) {
            calculated[k] = this._cascaded[k].at(z, zoomHistory);
        }

        this.hidden = (this.minzoom && z < this.minzoom) ||
                      (this.maxzoom && z >= this.maxzoom) ||
                      // include visibility check for non-bucketed background layers
                      (this.layout.visibility === 'none');

        if (type === 'symbol') {
            if ((calculated['text-opacity'] === 0 || !this.layout['text-field']) &&
                (calculated['icon-opacity'] === 0 || !this.layout['icon-image'])) {
                this.hidden = true;
            } else {
                premultiplyLayer(calculated, 'text');
                premultiplyLayer(calculated, 'icon');
            }

        } else if (calculated[type + '-opacity'] === 0) {
            this.hidden = true;
        } else {
            premultiplyLayer(calculated, type);
        }

        if (this._cascaded['line-dasharray']) {
            // If the line is dashed, scale the dash lengths by the line
            // width at the previous round zoom level.
            var dashArray = calculated['line-dasharray'];
            var lineWidth = this._cascaded['line-width'] ?
                this._cascaded['line-width'].at(Math.floor(z), Infinity) :
                calculated['line-width'];

            dashArray.fromScale *= lineWidth;
            dashArray.toScale *= lineWidth;
        }

        return !this.hidden;
    },

    json: function() {
        return util.extend({},
            this._layer,
            util.pick(this,
                ['type', 'source', 'source-layer',
                'minzoom', 'maxzoom', 'filter',
                'layout', 'paint']));
    }
};

function premultiplyLayer(layer, type) {
    var colorProp = type + '-color',
        haloProp = type + '-halo-color',
        outlineProp = type + '-outline-color',
        color = layer[colorProp],
        haloColor = layer[haloProp],
        outlineColor = layer[outlineProp],
        opacity = layer[type + '-opacity'];

    var colorOpacity = color && (opacity * color[3]);
    var haloOpacity = haloColor && (opacity * haloColor[3]);
    var outlineOpacity = outlineColor && (opacity * outlineColor[3]);

    if (colorOpacity !== undefined && colorOpacity < 1) {
        layer[colorProp] = util.premultiply([color[0], color[1], color[2], colorOpacity]);
    }
    if (haloOpacity !== undefined && haloOpacity < 1) {
        layer[haloProp] = util.premultiply([haloColor[0], haloColor[1], haloColor[2], haloOpacity]);
    }
    if (outlineOpacity !== undefined && outlineOpacity < 1) {
        layer[outlineProp] = util.premultiply([outlineColor[0], outlineColor[1], outlineColor[2], outlineOpacity]);
    }
}
