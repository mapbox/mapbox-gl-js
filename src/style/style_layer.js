// @flow

const util = require('../util/util');
const StyleTransition = require('./style_transition');
const StyleDeclaration = require('./style_declaration');
const styleSpec = require('../style-spec/reference/latest');
const validateStyle = require('./validate_style');
const parseColor = require('./../style-spec/util/parse_color');
const Evented = require('../util/evented');

import type {Bucket, BucketParameters} from '../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {Feature, GlobalProperties} from '../style-spec/expression';
import type RenderTexture from '../render/render_texture';
import type AnimationLoop from './animation_loop';
import type {FeatureFilter} from '../style-spec/feature_filter';

const TRANSITION_SUFFIX = '-transition';

class StyleLayer extends Evented {
    static create: (layer: LayerSpecification) => StyleLayer;

    id: string;
    metadata: mixed;
    type: string;
    source: string;
    sourceLayer: ?string;
    minzoom: ?number;
    maxzoom: ?number;
    filter: mixed;
    paint: { [string]: any };
    layout: { [string]: any };

    viewportFrame: ?RenderTexture;
    _featureFilter: FeatureFilter;

    _paintSpecifications: any;
    _layoutSpecifications: any;
    _paintTransitions: {[string]: StyleTransition};
    _paintTransitionOptions: {[string]: TransitionSpecification};
    _paintDeclarations: {[string]: StyleDeclaration};
    _layoutDeclarations: {[string]: StyleDeclaration};
    _layoutFunctions: {[string]: boolean};

    +createBucket: (parameters: BucketParameters) => Bucket;
    +queryRadius: (bucket: Bucket) => number;
    +queryIntersectsFeature: (queryGeometry: Array<Array<Point>>,
                              feature: VectorTileFeature,
                              geometry: Array<Array<Point>>,
                              zoom: number,
                              bearing: number,
                              pixelsToTileUnits: number) => boolean;

    constructor(layer: LayerSpecification) {
        super();

        this.id = layer.id;
        this.metadata = layer.metadata;
        this.type = layer.type;
        this.minzoom = layer.minzoom;
        this.maxzoom = layer.maxzoom;

        if (layer.type !== 'background') {
            this.source = layer.source;
            this.sourceLayer = layer['source-layer'];
            this.filter = layer.filter;
        }

        this.paint = {};
        this.layout = {};

        this._featureFilter = () => true;

        this._paintSpecifications = styleSpec[`paint_${this.type}`];
        this._layoutSpecifications = styleSpec[`layout_${this.type}`];

        this._paintTransitions = {}; // {[propertyName]: StyleTransition}
        this._paintTransitionOptions = {}; // {[propertyName]: { duration:Number, delay:Number }}
        this._paintDeclarations = {}; // {[propertyName]: StyleDeclaration}
        this._layoutDeclarations = {}; // {[propertyName]: StyleDeclaration}
        this._layoutFunctions = {}; // {[propertyName]: Boolean}

        let paintName, layoutName;
        const options = {validate: false};

        // Resolve paint declarations
        for (paintName in layer.paint) {
            this.setPaintProperty(paintName, layer.paint[paintName], options);
        }

        // Resolve layout declarations
        for (layoutName in layer.layout) {
            this.setLayoutProperty(layoutName, layer.layout[layoutName], options);
        }

        // set initial layout/paint values
        for (paintName in this._paintSpecifications) {
            this.paint[paintName] = this.getPaintValue(paintName, {zoom: 0});
        }
        for (layoutName in this._layoutSpecifications) {
            this._updateLayoutValue(layoutName);
        }
    }

    setLayoutProperty(name: string, value: mixed, options: {validate: boolean}) {
        if (value == null) {
            delete this._layoutDeclarations[name];
        } else {
            const key = `layers.${this.id}.layout.${name}`;
            if (this._validate(validateStyle.layoutProperty, key, name, value, options)) return;
            this._layoutDeclarations[name] = new StyleDeclaration(this._layoutSpecifications[name], value, name);
        }
        this._updateLayoutValue(name);
    }

    getLayoutProperty(name: string) {
        return (
            this._layoutDeclarations[name] &&
            this._layoutDeclarations[name].value
        );
    }

    getLayoutValue(name: string, globals: GlobalProperties, feature?: Feature): any {
        const specification = this._layoutSpecifications[name];
        const declaration = this._layoutDeclarations[name];

        // Avoid attempting to calculate a value for data-driven properties if `feature` is undefined.
        if (declaration && (declaration.expression.isFeatureConstant || feature)) {
            return declaration.calculate(globals, feature);
        } else {
            return specification.default;
        }
    }

    setPaintProperty(name: string, value: any, options: any) {
        const validateStyleKey = `layers.${this.id}.paint.${name}`;

        if (util.endsWith(name, TRANSITION_SUFFIX)) {
            if (value === null || value === undefined) {
                delete this._paintTransitionOptions[name];
            } else {
                if (this._validate(validateStyle.paintProperty, validateStyleKey, name, value, options)) return;
                this._paintTransitionOptions[name] = value;
            }
        } else if (value === null || value === undefined) {
            delete this._paintDeclarations[name];
        } else {
            if (this._validate(validateStyle.paintProperty, validateStyleKey, name, value, options)) return;
            this._paintDeclarations[name] = new StyleDeclaration(this._paintSpecifications[name], value, name);
        }
    }

    getPaintProperty(name: string) {
        if (util.endsWith(name, TRANSITION_SUFFIX)) {
            return (
                this._paintTransitionOptions[name]
            );
        } else {
            return (
                this._paintDeclarations[name] &&
                this._paintDeclarations[name].value
            );
        }
    }

    getPaintValue(name: string, globals: GlobalProperties, feature?: Feature): any {
        const specification = this._paintSpecifications[name];
        const transition = this._paintTransitions[name];

        // Avoid attempting to calculate a value for data-driven properties if `feature` is undefined.
        if (transition && (transition.declaration.expression.isFeatureConstant || feature)) {
            return transition.calculate(globals, feature);
        } else if (specification.type === 'color' && specification.default) {
            return parseColor(specification.default);
        } else {
            return specification.default;
        }
    }

    getPaintInterpolationFactor(name: string, input: number, lower: number, upper: number) {
        const declaration = this._paintDeclarations[name];
        return declaration ? declaration.interpolationFactor(input, lower, upper) : 0;
    }

    isPaintValueFeatureConstant(name: string) {
        const declaration = this._paintDeclarations[name];
        return !declaration || declaration.expression.isFeatureConstant;
    }

    isPaintValueZoomConstant(name: string) {
        const declaration = this._paintDeclarations[name];
        return !declaration || declaration.expression.isZoomConstant;
    }

    isHidden(zoom: number) {
        if (this.minzoom && zoom < this.minzoom) return true;
        if (this.maxzoom && zoom >= this.maxzoom) return true;
        if (this.layout['visibility'] === 'none') return true;

        return false;
    }

    updatePaintTransitions(options: {transition?: boolean},
                           globalOptions?: TransitionSpecification,
                           animationLoop?: AnimationLoop,
                           zoomHistory?: any) {
        let name;
        for (name in this._paintDeclarations) { // apply new declarations
            this._applyPaintDeclaration(name, this._paintDeclarations[name], options, globalOptions, animationLoop, zoomHistory);
        }
        for (name in this._paintTransitions) {
            if (!(name in this._paintDeclarations)) // apply removed declarations
                this._applyPaintDeclaration(name, null, options, globalOptions, animationLoop, zoomHistory);
        }
    }

    updatePaintTransition(name: string,
                          options: {transition?: boolean},
                          globalOptions: TransitionSpecification,
                          animationLoop: AnimationLoop,
                          zoomHistory: any) {
        const declaration = this._paintDeclarations[name];
        this._applyPaintDeclaration(name, declaration, options, globalOptions, animationLoop, zoomHistory);
    }

    // update all zoom-dependent layout/paint values
    recalculate(zoom: number) {
        for (const paintName in this._paintTransitions) {
            this.paint[paintName] = this.getPaintValue(paintName, {zoom: zoom});
        }
        for (const layoutName in this._layoutFunctions) {
            this.layout[layoutName] = this.getLayoutValue(layoutName, {zoom: zoom});
        }
    }

    serialize() {
        const output : any = {
            'id': this.id,
            'type': this.type,
            'source': this.source,
            'source-layer': this.sourceLayer,
            'metadata': this.metadata,
            'minzoom': this.minzoom,
            'maxzoom': this.maxzoom,
            'filter': this.filter,
            'layout': util.mapObject(this._layoutDeclarations, getDeclarationValue),
            'paint': util.mapObject(this._paintDeclarations, getDeclarationValue)
        };

        return util.filterObject(output, (value, key) => {
            return value !== undefined &&
                !(key === 'layout' && !Object.keys(value).length) &&
                !(key === 'paint' && !Object.keys(value).length);
        });
    }

    // set paint transition based on a given paint declaration
    _applyPaintDeclaration(name: string,
                           declaration: StyleDeclaration | null | void,
                           options: {transition?: boolean},
                           globalOptions?: TransitionSpecification,
                           animationLoop?: AnimationLoop,
                           zoomHistory?: any) {
        const oldTransition = options.transition ? this._paintTransitions[name] : undefined;
        const spec = this._paintSpecifications[name];

        if (declaration === null || declaration === undefined) {
            declaration = new StyleDeclaration(spec, spec.default, name);
        }

        if (oldTransition && oldTransition.declaration.json === declaration.json) return;

        const transitionOptions = util.extend({
            duration: 300,
            delay: 0
        }, globalOptions, this.getPaintProperty(name + TRANSITION_SUFFIX));

        const newTransition = this._paintTransitions[name] =
            new StyleTransition(spec, declaration, oldTransition, transitionOptions, zoomHistory);

        if (!animationLoop) {
            return;
        }
        if (!newTransition.instant()) {
            newTransition.loopID = animationLoop.set(newTransition.endTime - Date.now());
        }
        if (oldTransition) {
            animationLoop.cancel(oldTransition.loopID);
        }
    }

    // update layout value if it's constant, or mark it as zoom-dependent
    _updateLayoutValue(name: string) {
        const declaration = this._layoutDeclarations[name];
        if (!declaration || (declaration.expression.isZoomConstant && declaration.expression.isFeatureConstant)) {
            delete this._layoutFunctions[name];
            this.layout[name] = this.getLayoutValue(name, {zoom: 0});
        } else {
            this._layoutFunctions[name] = true;
        }
    }

    _validate(validate: Function, key: string, name: string, value: mixed, options: {validate: boolean}) {
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

    has3DPass() {
        return false;
    }

    resize(gl: WebGLRenderingContext) { // eslint-disable-line
        // noop
    }
}

module.exports = StyleLayer;

const subclasses = {
    'circle': require('./style_layer/circle_style_layer'),
    'heatmap': require('./style_layer/heatmap_style_layer'),
    'fill': require('./style_layer/fill_style_layer'),
    'fill-extrusion': require('./style_layer/fill_extrusion_style_layer'),
    'line': require('./style_layer/line_style_layer'),
    'symbol': require('./style_layer/symbol_style_layer'),
    'background': require('./style_layer/background_style_layer'),
    'raster': require('./style_layer/raster_style_layer')
};

StyleLayer.create = function(layer: LayerSpecification) {
    return new subclasses[layer.type](layer);
};

function getDeclarationValue(declaration) {
    return declaration.value;
}
