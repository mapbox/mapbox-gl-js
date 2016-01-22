'use strict';

var util = require('../util/util');
var StyleTransition = require('./style_transition');
var StyleDeclaration = require('./style_declaration');
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
    this.id = layer.id;
    this.ref = layer.ref;
    this.metadata = layer.metadata;
    this.type = (refLayer || layer).type;
    this.source = (refLayer || layer).source;
    this.sourceLayer = (refLayer || layer)['source-layer'];
    this.minzoom = (refLayer || layer).minzoom;
    this.maxzoom = (refLayer || layer).maxzoom;
    this.filter = (refLayer || layer).filter;
    this.interactive = (refLayer || layer).interactive;

    this._paintSpecifications = StyleSpecification['paint_' + this.type];
    this._layoutSpecifications = StyleSpecification['layout_' + this.type];

    // Resolve paint declarations
    this._paintDeclarations = {};
    this._paintTransitions = {};
    for (var key in layer) {
        var match = key.match(/^paint(?:\.(.*))?$/);
        if (match) {
            var klass = match[1] || '';
            for (var name in layer[key]) {
                this.setPaintProperty(name, layer[key][name], klass);
            }
        }
    }

    // Resolve layout declarations
    this._layoutDeclarations = {};
    if (this.ref) {
        this._layoutDeclarations = refLayer._layoutDeclarations;
    } else {
        for (name in layer.layout) {
            this.setLayoutProperty(name, layer.layout[name]);
        }
    }
}

StyleLayer.prototype = {

    setLayoutProperty: function(name, value) {
        if (value == null) {
            delete this._layoutDeclarations[name];
        } else {
            this._layoutDeclarations[name] = new StyleDeclaration(this._layoutSpecifications[name], value);
        }
    },

    getLayoutProperty: function(name) {
        return (
            this._layoutDeclarations[name] &&
            this._layoutDeclarations[name].value
        );
    },

    getLayoutValue: function(name, zoom, zoomHistory) {
        var specification = this._layoutSpecifications[name];
        var declaration = this._layoutDeclarations[name];

        if (declaration) {
            return declaration.calculate(zoom, zoomHistory);
        } else {
            return specification.default;
        }
    },

    setPaintProperty: function(name, value, klass) {
        if (endsWith(name, TRANSITION_SUFFIX)) {
            if (!this._paintTransitions[klass || '']) {
                this._paintTransitions[klass || ''] = {};
            }
            if (value == null) {
                delete this._paintTransitions[klass || ''][name];
            } else {
                this._paintTransitions[klass || ''][name] = value;
            }
        } else {
            if (!this._paintDeclarations[klass || '']) {
                this._paintDeclarations[klass || ''] = {};
            }
            if (value == null) {
                delete this._paintDeclarations[klass || ''][name];
            } else {
                this._paintDeclarations[klass || ''][name] = new StyleDeclaration(this._paintSpecifications[name], value);
            }
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

        if (this.getLayoutValue('visibility') === 'none') return true;

        var opacityProperty = this.type + '-opacity';
        if (this._paintSpecifications[opacityProperty] && this.getPaintValue(opacityProperty) === 0) return true;

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

        this.layout = {};
        for (name in this._layoutSpecifications) {
            this.layout[name] = this.getLayoutValue(name, zoom, zoomHistory);
        }
    },

    serialize: function() {
        var output = {
            'id': this.id,
            'ref': this.ref,
            'metadata': this.metadata,
            'type': this.type,
            'source': this.source,
            'source-layer': this.sourceLayer,
            'minzoom': this.minzoom,
            'maxzoom': this.maxzoom,
            'filter': this.filter,
            'interactive': this.interactive,
            'layout': mapObject(this._layoutDeclarations, function(declaration) {
                return declaration.value;
            })
        };

        for (var klass in this._paintDeclarations) {
            var key = klass === '' ? 'paint' : 'paint.' + key;
            output[key] = mapObject(this._paintDeclarations[klass], function(declaration) {
                return declaration.value;
            });
        }

        return output;
    }
};

// TODO move to util
function endsWith(string, suffix) {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
}

// TODO move to util
function mapObject(input, iterator) {
    var output = {};
    for (var key in input) {
        output[key] = iterator(input[key], key, input);
    }
    return output;
}
