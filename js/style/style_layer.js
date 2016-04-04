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

    // Resolve paint declarations
    for (var key in layer) {
        var match = key.match(/^paint(?:\.(.*))?$/);
        if (match) {
            var klass = match[1] || '';
            for (var paintName in layer[key]) {
                this.setPaintProperty(paintName, layer[key][paintName], klass);
            }
        }
    }

    // Resolve layout declarations
    if (this.ref) {
        this._layoutDeclarations = refLayer._layoutDeclarations;
    } else {
        for (var layoutName in layer.layout) {
            this.setLayoutProperty(layoutName, layer.layout[layoutName]);
        }
    }

    this.updateConstantValues();
}

StyleLayer.prototype = util.inherit(Evented, {

    setLayoutProperty: function(name, value) {

        if (value == null) {
            delete this._layoutDeclarations[name];
        } else {
            if (validateStyle.emitErrors(this, validateStyle.layoutProperty({
                key: 'layers.' + this.id + '.layout.' + name,
                layerType: this.type,
                objectKey: name,
                value: value,
                styleSpec: styleSpec
            }))) return;
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
        var validateStyleKey = 'layers.' + this.id + (klass ? '["paint.' + klass + '"].' : '.paint.') + name;

        if (util.endsWith(name, TRANSITION_SUFFIX)) {
            if (!this._paintTransitionOptions[klass || '']) {
                this._paintTransitionOptions[klass || ''] = {};
            }
            if (value === null || value === undefined) {
                delete this._paintTransitionOptions[klass || ''][name];
            } else {
                if (validateStyle.emitErrors(this, validateStyle.paintProperty({
                    key: validateStyleKey,
                    layerType: this.type,
                    objectKey: name,
                    value: value,
                    styleSpec: styleSpec
                }))) return;
                this._paintTransitionOptions[klass || ''][name] = value;
            }
        } else {
            if (!this._paintDeclarations[klass || '']) {
                this._paintDeclarations[klass || ''] = {};
            }
            if (value === null || value === undefined) {
                delete this._paintDeclarations[klass || ''][name];
            } else {
                if (validateStyle.emitErrors(this, validateStyle.paintProperty({
                    key: validateStyleKey,
                    layerType: this.type,
                    objectKey: name,
                    value: value,
                    styleSpec: styleSpec
                }))) return;
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
        if (this.layout['visibility'] === 'none') return true;
        if (this.paint[this.type + '-opacity'] === 0) return true;
        return false;
    },

    // update all paint transitions and layout/paint constant values
    cascade: function(classes, options, globalOptions, animationLoop) {
        var declarations = util.extend({}, this._paintDeclarations['']);
        for (var i = 0; i < classes.length; i++) {
            util.extend(declarations, this._paintDeclarations[classes[i]]);
        }

        var name;
        for (name in declarations) { // apply new declarations
            this.updatePaintTransition(name, declarations[name], options, globalOptions, animationLoop);
        }
        for (name in this._paintTransitions) {
            if (!(name in declarations)) // apply removed declarations
                this.updatePaintTransition(name, null, options, globalOptions, animationLoop);
        }

        this.updateConstantValues();
    },

    updatePaintTransition: function (name, declaration, options, globalOptions, animationLoop) {
        var oldTransition = options.transition ? this._paintTransitions[name] : undefined;

        if (declaration === null) {
            var spec = this._paintSpecifications[name];
            declaration = new StyleDeclaration(spec, spec.default);
        }

        if (oldTransition && oldTransition.declaration.json === declaration.json) return;

        var transitionOptions = util.extend({
            duration: 300,
            delay: 0
        }, globalOptions, this.getPaintProperty(name + TRANSITION_SUFFIX));

        var newTransition = this._paintTransitions[name] =
                new StyleTransition(declaration, oldTransition, transitionOptions);

        if (!newTransition.instant()) {
            newTransition.loopID = animationLoop.set(newTransition.endTime - Date.now());
        }
        if (oldTransition) {
            animationLoop.cancel(oldTransition.loopID);
        }
    },

    // update all constant layout/paint values
    updateConstantValues: function() {
        for (var paintName in this._paintSpecifications) {
            if (!(paintName in this._paintTransitions))
                this.paint[paintName] = this.getPaintValue(paintName);
        }
        this._layoutFunctions = {};
        for (var layoutName in this._layoutSpecifications) {
            var declaration = this._layoutDeclarations[layoutName];
            if (declaration && declaration.isFunction) {
                this._layoutFunctions[layoutName] = true;
            } else {
                this.layout[layoutName] = this.getLayoutValue(layoutName);
            }
        }
    },

    // update all zoom-dependent layout/paint values
    recalculate: function(zoom, zoomHistory) {
        for (var paintName in this._paintTransitions) {
            this.paint[paintName] = this.getPaintValue(paintName, zoom, zoomHistory);
        }
        for (var layoutName in this._layoutFunctions) {
            this.layout[layoutName] = this.getLayoutValue(layoutName, zoom, zoomHistory);
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
    }
});

function getDeclarationValue(declaration) {
    return declaration.value;
}
