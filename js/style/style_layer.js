'use strict';

var util = require('../util/util');
var StyleConstant = require('./style_constant');
var StyleTransition = require('./style_transition');
var StyleDeclaration = require('./style_declaration');
var LayoutProperties = require('./layout_properties');
var PaintProperties = require('./paint_properties');

module.exports = StyleLayer;

function StyleLayer(layer) {
    this._layer = layer;

    this.id  = layer.id;
    this.ref = layer.ref;

    this.assign(layer);
}

StyleLayer.prototype = {
    resolveLayout(layers, constants) {
        if (!this.ref) {
            this.layout = new LayoutProperties[this.type](
                StyleConstant.resolve(this._layer.layout, constants));

            if (this.layout['symbol-placement'] === 'line') {
                if (!this.layout.hasOwnProperty('text-rotation-alignment')) {
                    this.layout['text-rotation-alignment'] = 'map';
                }
                if (!this.layout.hasOwnProperty('icon-rotation-alignment')) {
                    this.layout['icon-rotation-alignment'] = 'map';
                }
                this.layout['symbol-avoid-edges'] = true;
            }
        }

        if (this._layer.layers) {
            this.layers = this._layer.layers.map(l => layers[l.id]);
        }
    },

    resolvePaint(layers, constants, globalTrans) {
        globalTrans = globalTrans || {};

        if (this.ref) {
            this.assign(layers[this.ref]);
        }

        // Resolved and cascaded paint properties.
        this._resolved = {}; // class name -> (property name -> StyleDeclaration)
        this._cascaded = {}; // property name -> StyleTransition

        for (var p in this._layer) {
            var match = p.match(/^paint(?:\.(.*))?$/);
            if (!match)
                continue;

            var paint = StyleConstant.resolve(this._layer[p], constants),
                declarations = this._resolved[match[1] || ''] = {};

            for (var k in paint) {
                if (/-transition$/.test(k))
                    continue;

                var declaration = declarations[k] =
                    new StyleDeclaration(this.type, k, paint[k]);

                var t = paint[k + '-transition'] || {};
                declaration.transition = {
                    duration: util.coalesce(t.duration, globalTrans.duration, 300),
                    delay: util.coalesce(t.delay, globalTrans.delay, 0)
                };
            }
        }
    },

    cascade(classes, options, animationLoop) {
        for (var klass in this._resolved) {
            if (klass !== "" && !classes[klass])
                continue;

            var declarations = this._resolved[klass];
            for (var k in declarations) {
                var newDeclaration = declarations[k];
                var newStyleTrans = options.transition ? declarations[k].transition : {duration: 0, delay: 0};
                var oldTransition = this._cascaded[k];

                // Only create a new transition if the declaration changed
                if (!oldTransition || oldTransition.declaration.json !== newDeclaration.json) {
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
    },

    recalculate(z) {
        var type = this.type,
            calculated = this.paint = new PaintProperties[type]();

        for (var k in this._cascaded) {
            calculated[k] = this._cascaded[k].at(z);
        }

        this.hidden = (this.minzoom && z < this.minzoom) ||
                      (this.maxzoom && z >= this.maxzoom);

        if (type === 'symbol') {
            if ((calculated['text-opacity'] === 0 || !this.layout['text-field']) &&
                (calculated['icon-opacity'] === 0 || !this.layout['icon-image'])) {
                this.hidden = true;
            } else {
                premultiplyLayer(calculated, 'text');
                premultiplyLayer(calculated, 'icon');
            }
        } else {
            if (calculated[type + '-opacity'] === 0) {
                this.hidden = true;
            } else {
                premultiplyLayer(calculated, type);
            }
        }

        return !this.hidden;
    },

    assign(layer) {
        util.extend(this, util.pick(layer,
            'type', 'source', 'source-layer',
            'minzoom', 'maxzoom', 'filter',
            'layout'));
    },

    json() {
        return util.extend({},
            this._layer,
            util.pick(this,
                'type', 'source', 'source-layer',
                'minzoom', 'maxzoom', 'filter',
                'layout', 'paint'));
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
