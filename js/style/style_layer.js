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
    this.sourceLayer = (refLayer || layer)['source-layer'];
    this.minzoom = (refLayer || layer).minzoom;
    this.maxzoom = (refLayer || layer).maxzoom;
    this.filter = (refLayer || layer).filter;
    this.layout = (refLayer || layer).layout;

    this._classes = {}; // class name -> StyleDeclarationSet
    this._transitions = {}; // property name -> StyleTransition
}

StyleLayer.prototype = {
    resolveLayout: function() {
        if (!this.ref) {
            this.layout = new LayoutProperties[this.type](this._layer.layout);
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
            this._classes[match[1] || ''] =
                new StyleDeclarationSet('paint', this.type, this._layer[p]);
        }
    },

    setPaintProperty: function(name, value, klass) {
        var declarations = this._classes[klass || ''];
        if (!declarations) {
            declarations = this._classes[klass || ''] =
                new StyleDeclarationSet('paint', this.type, {});
        }
        declarations[name] = value;
    },

    getPaintProperty: function(name, klass) {
        var declarations = this._classes[klass || ''];
        return declarations && declarations[name];
    },

    isHidden: function(zoom) {
        if (this.minzoom && zoom < this.minzoom) return true;
        if (this.maxzoom && zoom >= this.maxzoom) return true;
        if (this.layout.visibility === 'none') return true;
        if (this.paint[this.type + '-opacity'] === 0) return true;
        return false;
    },

    // update classes
    cascade: function(classes, options, globalTrans, animationLoop) {
        for (var klass in this._classes) {
            if (klass !== "" && !classes[klass])
                continue;

            var declarations = this._classes[klass],
                values = declarations.values();

            for (var k in values) {
                var newDeclaration = values[k];
                var oldTransition = options.transition ? this._transitions[k] : undefined;

                // Only create a new transition if the declaration changed
                if (!oldTransition || oldTransition.declaration.json !== newDeclaration.json) {
                    var newStyleTrans = declarations.transition(k, globalTrans);
                    var newTransition = this._transitions[k] =
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

    // update zoom
    recalculate: function(zoom, zoomHistory) {
        this.paint = new PaintProperties[this.type]();

        for (var k in this._transitions) {
            this.paint[k] = this._transitions[k].at(zoom, zoomHistory);
        }
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
