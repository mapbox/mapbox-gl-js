'use strict';

var util = require('../util/util');
var StyleTransition = require('./style_transition');
var StyleDeclaration = require('./style_declaration');
var styleSpec = require('./style_spec');
var validateStyle = require('./validate_style');
var parseColor = require('./parse_color');
var Evented = require('../util/evented');

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
    this.set(layer, refLayer);
}

StyleLayer.prototype = util.inherit(Evented, {

    set: function(layer, refLayer) {
        this.id = layer.id;
        this.ref = layer.ref;
        this.metadata = layer.metadata;
        this.type = (refLayer || layer).type;
        this.source = (refLayer || layer).source;
        this.sourceLayer = (refLayer || layer)['source-layer'];
        this.minzoom = (refLayer || layer).minzoom;
        this.maxzoom = (refLayer || layer).maxzoom;
        this.filter = (refLayer || layer).filter;

        this.paint = {};
        this.layout = {};

        this._paintSpecifications = styleSpec['paint_' + this.type];
        this._layoutSpecifications = styleSpec['layout_' + this.type];

        this._paintTransitions = {}; // {[propertyName]: StyleTransition}
        this._paintTransitionOptions = {}; // {[className]: {[propertyName]: { duration:Number, delay:Number }}}
        this._paintDeclarations = {}; // {[className]: {[propertyName]: StyleDeclaration}}
        this._layoutDeclarations = {}; // {[propertyName]: StyleDeclaration}
        this._layoutFunctions = {}; // {[propertyName]: Boolean}

        var paintName, layoutName;

        // Resolve paint declarations
        for (var key in layer) {
            var match = key.match(/^paint(?:\.(.*))?$/);
            if (match) {
                var klass = match[1] || '';
                for (paintName in layer[key]) {
                    this.setPaintProperty(paintName, layer[key][paintName], klass);
                }
            }
        }

        // Resolve layout declarations
        if (this.ref) {
            this._layoutDeclarations = refLayer._layoutDeclarations;
        } else {
            for (layoutName in layer.layout) {
                this.setLayoutProperty(layoutName, layer.layout[layoutName]);
            }
        }

        // set initial layout/paint values
        for (paintName in this._paintSpecifications) {
            this.paint[paintName] = this.getPaintValue(paintName);
        }
        for (layoutName in this._layoutSpecifications) {
            this._updateLayoutValue(layoutName);
        }
    },

    setLayoutProperty: function(name, value) {

        if (value == null) {
            delete this._layoutDeclarations[name];
        } else {
            var key = 'layers.' + this.id + '.layout.' + name;
            if (this._handleErrors(validateStyle.layoutProperty, key, name, value)) return;
            this._layoutDeclarations[name] = new StyleDeclaration(this._layoutSpecifications[name], value);
        }
        this._updateLayoutValue(name);
    },

    getLayoutProperty: function(name) {
        return (
            this._layoutDeclarations[name] &&
            this._layoutDeclarations[name].value
        );
    },

    getLayoutValue: function(name, globalProperties, featureProperties) {
        var specification = this._layoutSpecifications[name];
        var declaration = this._layoutDeclarations[name];

        if (declaration) {
            return declaration.calculate(globalProperties, featureProperties);
        } else {
            return specification.default;
        }
    },

    setPaintProperty: function(name, value, klass) {
        var validateStyleKey = 'layers.' + this.id + (klass ? '["paint.' + klass + '"].' : '.paint.') + name;

        if (util.endsWith(name, TRANSITION_SUFFIX)) {
            if (!this._paintTransitionOptions[klass || '']) {
                this._paintTransitionOptions[klass || ''] = {};
            }
            if (value === null || value === undefined) {
                delete this._paintTransitionOptions[klass || ''][name];
            } else {
                if (this._handleErrors(validateStyle.paintProperty, validateStyleKey, name, value)) return;
                this._paintTransitionOptions[klass || ''][name] = value;
            }
        } else {
            if (!this._paintDeclarations[klass || '']) {
                this._paintDeclarations[klass || ''] = {};
            }
            if (value === null || value === undefined) {
                delete this._paintDeclarations[klass || ''][name];
            } else {
                if (this._handleErrors(validateStyle.paintProperty, validateStyleKey, name, value)) return;
                this._paintDeclarations[klass || ''][name] = new StyleDeclaration(this._paintSpecifications[name], value);
            }
        }
    },

    getPaintProperty: function(name, klass) {
        klass = klass || '';
        if (util.endsWith(name, TRANSITION_SUFFIX)) {
            return (
                this._paintTransitionOptions[klass] &&
                this._paintTransitionOptions[klass][name]
            );
        } else {
            return (
                this._paintDeclarations[klass] &&
                this._paintDeclarations[klass][name] &&
                this._paintDeclarations[klass][name].value
            );
        }
    },

    getPaintValue: function(name, globalProperties, featureProperties) {
        var specification = this._paintSpecifications[name];
        var transition = this._paintTransitions[name];

        if (transition) {
            return transition.calculate(globalProperties, featureProperties);
        } else if (specification.type === 'color' && specification.default) {
            return parseColor(specification.default);
        } else {
            return specification.default;
        }
    },

    getPaintValueStopZoomLevels: function(name) {
        var transition = this._paintTransitions[name];
        if (transition) {
            return transition.declaration.stopZoomLevels;
        } else {
            return [];
        }
    },

    getPaintInterpolationT: function(name, zoom) {
        var transition = this._paintTransitions[name];
        return transition.declaration.calculateInterpolationT({ zoom: zoom });
    },

    isPaintValueFeatureConstant: function(name) {
        var transition = this._paintTransitions[name];

        if (transition) {
            return transition.declaration.isFeatureConstant;
        } else {
            return true;
        }
    },

    isLayoutValueFeatureConstant: function(name) {
        var declaration = this._layoutDeclarations[name];

        if (declaration) {
            return declaration.isFeatureConstant;
        } else {
            return true;
        }
    },

    isPaintValueZoomConstant: function(name) {
        var transition = this._paintTransitions[name];

        if (transition) {
            return transition.declaration.isZoomConstant;
        } else {
            return true;
        }
    },


    isHidden: function(zoom) {
        if (this.minzoom && zoom < this.minzoom) return true;
        if (this.maxzoom && zoom >= this.maxzoom) return true;
        if (this.layout['visibility'] === 'none') return true;
        if (this.paint[this.type + '-opacity'] === 0) return true;
        return false;
    },

    updatePaintTransitions: function(classes, options, globalOptions, animationLoop) {
        var declarations = util.extend({}, this._paintDeclarations['']);
        for (var i = 0; i < classes.length; i++) {
            util.extend(declarations, this._paintDeclarations[classes[i]]);
        }

        var name;
        for (name in declarations) { // apply new declarations
            this._applyPaintDeclaration(name, declarations[name], options, globalOptions, animationLoop);
        }
        for (name in this._paintTransitions) {
            if (!(name in declarations)) // apply removed declarations
                this._applyPaintDeclaration(name, null, options, globalOptions, animationLoop);
        }
    },

    updatePaintTransition: function(name, classes, options, globalOptions, animationLoop) {
        var declaration = this._paintDeclarations[''][name];
        for (var i = 0; i < classes.length; i++) {
            var classPaintDeclarations = this._paintDeclarations[classes[i]];
            if (classPaintDeclarations && classPaintDeclarations[name]) {
                declaration = classPaintDeclarations[name];
            }
        }
        this._applyPaintDeclaration(name, declaration, options, globalOptions, animationLoop);
    },

    // update all zoom-dependent layout/paint values
    recalculate: function(zoom, zoomHistory) {
        for (var paintName in this._paintTransitions) {
            this.paint[paintName] = this.getPaintValue(paintName, {zoom: zoom, zoomHistory: zoomHistory});
        }
        for (var layoutName in this._layoutFunctions) {
            this.layout[layoutName] = this.getLayoutValue(layoutName, {zoom: zoom, zoomHistory: zoomHistory});
        }
    },

    serialize: function(options) {
        var output = {
            'id': this.id,
            'ref': this.ref,
            'metadata': this.metadata,
            'minzoom': this.minzoom,
            'maxzoom': this.maxzoom
        };

        for (var klass in this._paintDeclarations) {
            var key = klass === '' ? 'paint' : 'paint.' + klass;
            output[key] = util.mapObject(this._paintDeclarations[klass], getDeclarationValue);
        }

        if (!this.ref || (options && options.includeRefProperties)) {
            util.extend(output, {
                'type': this.type,
                'source': this.source,
                'source-layer': this.sourceLayer,
                'filter': this.filter,
                'layout': util.mapObject(this._layoutDeclarations, getDeclarationValue)
            });
        }

        return util.filterObject(output, function(value, key) {
            return value !== undefined && !(key === 'layout' && !Object.keys(value).length);
        });
    },

    // set paint transition based on a given paint declaration
    _applyPaintDeclaration: function (name, declaration, options, globalOptions, animationLoop) {
        var oldTransition = options.transition ? this._paintTransitions[name] : undefined;
        var spec = this._paintSpecifications[name];

        if (declaration === null || declaration === undefined) {
            declaration = new StyleDeclaration(spec, spec.default);
        }

        if (oldTransition && oldTransition.declaration.json === declaration.json) return;

        var transitionOptions = util.extend({
            duration: 300,
            delay: 0
        }, globalOptions, this.getPaintProperty(name + TRANSITION_SUFFIX));

        var newTransition = this._paintTransitions[name] =
            new StyleTransition(spec, declaration, oldTransition, transitionOptions);

        if (!newTransition.instant()) {
            newTransition.loopID = animationLoop.set(newTransition.endTime - Date.now());
        }
        if (oldTransition) {
            animationLoop.cancel(oldTransition.loopID);
        }
    },

    // update layout value if it's constant, or mark it as zoom-dependent
    _updateLayoutValue: function(name) {
        var declaration = this._layoutDeclarations[name];

        if (declaration && declaration.isFunction) {
            this._layoutFunctions[name] = true;
        } else {
            delete this._layoutFunctions[name];
            this.layout[name] = this.getLayoutValue(name);
        }
    },

    _handleErrors: function(validate, key, name, value) {
        return validateStyle.emitErrors(this, validate.call(validateStyle, {
            key: key,
            layerType: this.type,
            objectKey: name,
            value: value,
            styleSpec: styleSpec,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true}
        }));
    }
});

function getDeclarationValue(declaration) {
    return declaration.value;
}
