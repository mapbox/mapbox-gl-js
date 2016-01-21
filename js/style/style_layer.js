'use strict';

var util = require('../util/util');
var StyleTransition = require('./style_transition');
var StyleDeclaration = require('./style_declaration');
var LayoutProperties = require('./layout_properties');
var StyleSpecification = require('./reference');
var parseColor = require('./parse_color');

module.exports = StyleLayer;

var TRANSITION_SUFFIX = '-transition';

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

    this._paintDeclarations = {}; // {[class name]: { [property name]: StyleDeclaration }}
    this._paintTransitions = {}; // {[class name]: { [property name]: StyleTransitionOptions }}
    this._paintTransitions = {}; // { [property name]: StyleDeclaration }

    this._paintSpecifications = StyleSpecification['paint_' + this.type];
    this._layoutSpecifications = StyleSpecification['layout_' + this.type];
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
        for (var key in this._layer) {
            var match = key.match(/^paint(?:\.(.*))?$/);
            if (match) {
                var klass = match[1] || '';
                for (var name in this._layer[key]) {
                    this.setPaintProperty(name, this._layer[key][name], klass);
                }
            }
        }
    },

    setPaintProperty: function(name, value, klass) {
        if (endsWith(name, TRANSITION_SUFFIX)) {
            if (!this._paintTransitions[klass || '']) {
                this._paintTransitions[klass || ''] = {};
            }
            this._paintTransitions[klass || ''][name] = value;
        } else {
            if (!this._paintDeclarations[klass || '']) {
                this._paintDeclarations[klass || ''] = {};
            }
            this._paintDeclarations[klass || ''][name] = new StyleDeclaration(this._paintSpecifications[name], value);
        }
    },

    getPaintProperty: function(name, klass) {
        klass = klass || '';
        if (endsWith(name, TRANSITION_SUFFIX)) {
            return (
                this._paintTransitions[klass] &&
                this._paintTransitions[klass][name]
            );
        } else {
            return (
                this._paintDeclarations[klass] &&
                this._paintDeclarations[klass][name] &&
                this._paintDeclarations[klass][name].value
            );
        }
    },

    getPaintValue: function(name, zoom, zoomHistory) {
        var specification = this._paintSpecifications[name];
        var transition = this._paintTransitions[name];

        if (transition) {
            return transition.at(zoom, zoomHistory);
        } else if (specification.type === 'color' && specification.default) {
            return parseColor(specification.default);
        } else {
            return specification.default;
        }
    },

    isHidden: function(zoom) {
        if (this.minzoom && zoom < this.minzoom) return true;
        if (this.maxzoom && zoom >= this.maxzoom) return true;
        if (this.layout.visibility === 'none') return true;
        if (this.paint[this.type + '-opacity'] === 0) return true;
        return false;
    },

    // update classes
    cascade: function(classes, options, globalTransitionOptions, animationLoop) {
        for (var klass in this._paintDeclarations) {
            if (klass !== "" && !classes[klass]) continue;

            for (var name in this._paintDeclarations[klass]) {
                var declaration = this._paintDeclarations[klass][name];
                var oldTransition = options.transition ? this._paintTransitions[name] : undefined;

                // Only create a new transition if the declaration changed
                if (!oldTransition || oldTransition.declaration.json !== declaration.json) {
                    var newTransition = this._paintTransitions[name] = new StyleTransition(declaration, oldTransition, util.extend(
                        {duration: 300, delay: 0},
                        globalTransitionOptions,
                        this.getPaintProperty(name + TRANSITION_SUFFIX)
                    ));

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
        this.paint = {};
        for (var name in this._paintSpecifications) {
            this.paint[name] = this.getPaintValue(name, zoom, zoomHistory);
        }
    },

    json: function() {
        return util.extend(
            {},
            this._layer,
            util.pick(this, [
                'type', 'source', 'source-layer', 'minzoom', 'maxzoom',
                'filter', 'layout', 'paint'
            ])
        );
    }
};

function endsWith(string, suffix) {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
}
