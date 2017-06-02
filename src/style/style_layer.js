'use strict';

const util = require('../util/util');
const StyleTransition = require('./style_transition');
const StyleDeclaration = require('./style_declaration');
const styleSpec = require('../style-spec/reference/latest');
const validateStyle = require('./validate_style');
const parseColor = require('./../style-spec/util/parse_color');
const Evented = require('../util/evented');

const TRANSITION_SUFFIX = '-transition';

class StyleLayer extends Evented {
    constructor(layer) {
        super();

        this.id = layer.id;
        this.metadata = layer.metadata;
        this.type = layer.type;
        this.source = layer.source;
        this.sourceLayer = layer['source-layer'];
        this.minzoom = layer.minzoom;
        this.maxzoom = layer.maxzoom;
        this.filter = layer.filter;

        this.paint = {};
        this.layout = {};

        this._paintSpecifications = styleSpec[`paint_${this.type}`];
        this._layoutSpecifications = styleSpec[`layout_${this.type}`];

        this._paintTransitions = {}; // {[propertyName]: StyleTransition}
        this._paintTransitionOptions = {}; // {[className]: {[propertyName]: { duration:Number, delay:Number }}}
        this._paintDeclarations = {}; // {[className]: {[propertyName]: StyleDeclaration}}
        this._layoutDeclarations = {}; // {[propertyName]: StyleDeclaration}
        this._layoutFunctions = {}; // {[propertyName]: Boolean}

        let paintName, layoutName;
        const options = {validate: false};

        // Resolve paint declarations
        for (const key in layer) {
            const match = key.match(/^paint(?:\.(.*))?$/);
            if (match) {
                const klass = match[1] || '';
                for (paintName in layer[key]) {
                    this.setPaintProperty(paintName, layer[key][paintName], klass, options);
                }
            }
        }

        // Resolve layout declarations
        for (layoutName in layer.layout) {
            this.setLayoutProperty(layoutName, layer.layout[layoutName], options);
        }

        // set initial layout/paint values
        for (paintName in this._paintSpecifications) {
            this.paint[paintName] = this.getPaintValue(paintName);
        }
        for (layoutName in this._layoutSpecifications) {
            this._updateLayoutValue(layoutName);
        }
    }

    setLayoutProperty(name, value, options) {

        if (value == null) {
            delete this._layoutDeclarations[name];
        } else {
            const key = `layers.${this.id}.layout.${name}`;
            if (this._validate(validateStyle.layoutProperty, key, name, value, options)) return;
            this._layoutDeclarations[name] = new StyleDeclaration(this._layoutSpecifications[name], value);
        }
        this._updateLayoutValue(name);
    }

    getLayoutProperty(name) {
        return (
            this._layoutDeclarations[name] &&
            this._layoutDeclarations[name].value
        );
    }

    getLayoutValue(name, globalProperties, featureProperties) {
        const specification = this._layoutSpecifications[name];
        const declaration = this._layoutDeclarations[name];

        if (declaration) {
            return declaration.calculate(globalProperties, featureProperties);
        } else {
            return specification.default;
        }
    }

    setPaintProperty(name, value, klass, options) {
        const validateStyleKey = `layers.${this.id}${klass ? `["paint.${klass}"].` : '.paint.'}${name}`;

        if (util.endsWith(name, TRANSITION_SUFFIX)) {
            if (!this._paintTransitionOptions[klass || '']) {
                this._paintTransitionOptions[klass || ''] = {};
            }
            if (value === null || value === undefined) {
                delete this._paintTransitionOptions[klass || ''][name];
            } else {
                if (this._validate(validateStyle.paintProperty, validateStyleKey, name, value, options)) return;
                this._paintTransitionOptions[klass || ''][name] = value;
            }
        } else {
            if (!this._paintDeclarations[klass || '']) {
                this._paintDeclarations[klass || ''] = {};
            }
            if (value === null || value === undefined) {
                delete this._paintDeclarations[klass || ''][name];
            } else {
                if (this._validate(validateStyle.paintProperty, validateStyleKey, name, value, options)) return;
                this._paintDeclarations[klass || ''][name] = new StyleDeclaration(this._paintSpecifications[name], value);
            }
        }
    }

    getPaintProperty(name, klass) {
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
    }

    getPaintValue(name, globalProperties, featureProperties) {
        const specification = this._paintSpecifications[name];
        const transition = this._paintTransitions[name];

        if (transition) {
            return transition.calculate(globalProperties, featureProperties);
        } else if (specification.type === 'color' && specification.default) {
            return parseColor(specification.default);
        } else {
            return specification.default;
        }
    }

    getPaintValueStopZoomLevels(name) {
        const transition = this._paintTransitions[name];
        if (transition) {
            return transition.declaration.stopZoomLevels;
        } else {
            return [];
        }
    }

    getLayoutValueStopZoomLevels(name) {
        const declaration = this._layoutDeclarations[name];

        if (declaration) {
            return declaration.stopZoomLevels;
        } else {
            return [];
        }
    }

    getPaintInterpolationT(name, globalProperties) {
        const transition = this._paintTransitions[name];
        return transition.declaration.calculateInterpolationT(globalProperties);
    }

    getLayoutInterpolationT(name, globalProperties) {
        const declaration = this._layoutDeclarations[name];
        return declaration.calculateInterpolationT(globalProperties);
    }

    isPaintValueFeatureConstant(name) {
        const transition = this._paintTransitions[name];

        if (transition) {
            return transition.declaration.isFeatureConstant;
        } else {
            return true;
        }
    }

    isLayoutValueFeatureConstant(name) {
        const declaration = this._layoutDeclarations[name];

        if (declaration) {
            return declaration.isFeatureConstant;
        } else {
            return true;
        }
    }

    isPaintValueZoomConstant(name) {
        const transition = this._paintTransitions[name];

        if (transition) {
            return transition.declaration.isZoomConstant;
        } else {
            return true;
        }
    }

    isLayoutValueZoomConstant(name) {
        const declaration = this._layoutDeclarations[name];

        if (declaration) {
            return declaration.isZoomConstant;
        } else {
            return true;
        }
    }

    isHidden(zoom) {
        if (this.minzoom && zoom < this.minzoom) return true;
        if (this.maxzoom && zoom >= this.maxzoom) return true;
        if (this.layout['visibility'] === 'none') return true;

        return false;
    }

    updatePaintTransitions(classes, options, globalOptions, animationLoop, zoomHistory) {
        const declarations = util.extend({}, this._paintDeclarations['']);
        for (let i = 0; i < classes.length; i++) {
            util.extend(declarations, this._paintDeclarations[classes[i]]);
        }

        let name;
        for (name in declarations) { // apply new declarations
            this._applyPaintDeclaration(name, declarations[name], options, globalOptions, animationLoop, zoomHistory);
        }
        for (name in this._paintTransitions) {
            if (!(name in declarations)) // apply removed declarations
                this._applyPaintDeclaration(name, null, options, globalOptions, animationLoop, zoomHistory);
        }
    }

    updatePaintTransition(name, classes, options, globalOptions, animationLoop, zoomHistory) {
        let declaration = this._paintDeclarations[''][name];
        for (let i = 0; i < classes.length; i++) {
            const classPaintDeclarations = this._paintDeclarations[classes[i]];
            if (classPaintDeclarations && classPaintDeclarations[name]) {
                declaration = classPaintDeclarations[name];
            }
        }
        this._applyPaintDeclaration(name, declaration, options, globalOptions, animationLoop, zoomHistory);
    }

    // update all zoom-dependent layout/paint values
    recalculate(zoom) {
        for (const paintName in this._paintTransitions) {
            this.paint[paintName] = this.getPaintValue(paintName, {zoom: zoom});
        }
        for (const layoutName in this._layoutFunctions) {
            this.layout[layoutName] = this.getLayoutValue(layoutName, {zoom: zoom});
        }
    }

    serialize() {
        const output = {
            'id': this.id,
            'type': this.type,
            'source': this.source,
            'source-layer': this.sourceLayer,
            'metadata': this.metadata,
            'minzoom': this.minzoom,
            'maxzoom': this.maxzoom,
            'filter': this.filter,
            'layout': util.mapObject(this._layoutDeclarations, getDeclarationValue)
        };

        for (const klass in this._paintDeclarations) {
            const key = klass === '' ? 'paint' : `paint.${klass}`;
            output[key] = util.mapObject(this._paintDeclarations[klass], getDeclarationValue);
        }

        return util.filterObject(output, (value, key) => {
            return value !== undefined && !(key === 'layout' && !Object.keys(value).length);
        });
    }

    // set paint transition based on a given paint declaration
    _applyPaintDeclaration(name, declaration, options, globalOptions, animationLoop, zoomHistory) {
        const oldTransition = options.transition ? this._paintTransitions[name] : undefined;
        const spec = this._paintSpecifications[name];

        if (declaration === null || declaration === undefined) {
            declaration = new StyleDeclaration(spec, spec.default);
        }

        if (oldTransition && oldTransition.declaration.json === declaration.json) return;

        const transitionOptions = util.extend({
            duration: 300,
            delay: 0
        }, globalOptions, this.getPaintProperty(name + TRANSITION_SUFFIX));

        const newTransition = this._paintTransitions[name] =
            new StyleTransition(spec, declaration, oldTransition, transitionOptions, zoomHistory);

        if (!newTransition.instant()) {
            newTransition.loopID = animationLoop.set(newTransition.endTime - Date.now());
        }
        if (oldTransition) {
            animationLoop.cancel(oldTransition.loopID);
        }
    }

    // update layout value if it's constant, or mark it as zoom-dependent
    _updateLayoutValue(name) {
        const declaration = this._layoutDeclarations[name];

        if (declaration && declaration.isFunction) {
            this._layoutFunctions[name] = true;
        } else {
            delete this._layoutFunctions[name];
            this.layout[name] = this.getLayoutValue(name);
        }
    }

    _validate(validate, key, name, value, options) {
        if (options && options.validate === false) {
            return false;
        }
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
}

module.exports = StyleLayer;

const subclasses = {
    'circle': require('./style_layer/circle_style_layer'),
    'fill': require('./style_layer/fill_style_layer'),
    'fill-extrusion': require('./style_layer/fill_extrusion_style_layer'),
    'line': require('./style_layer/line_style_layer'),
    'symbol': require('./style_layer/symbol_style_layer')
};

StyleLayer.create = function(layer) {
    const LayerClass = subclasses[layer.type] || StyleLayer;
    return new LayerClass(layer);
};

function getDeclarationValue(declaration) {
    return declaration.value;
}
