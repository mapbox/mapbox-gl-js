// @flow

import {endsWith, filterObject} from '../util/util.js';

import styleSpec from '../style-spec/reference/latest.js';
import {
    validateStyle,
    validateLayoutProperty,
    validatePaintProperty,
    emitValidationErrors
} from './validate_style.js';
import {Evented} from '../util/evented.js';
import {Layout, Transitionable, Transitioning, Properties, PossiblyEvaluated, PossiblyEvaluatedPropertyValue} from './properties.js';
import {supportsPropertyExpression} from '../style-spec/util/properties.js';
import ProgramConfiguration from '../data/program_configuration.js';
import featureFilter from '../style-spec/feature_filter/index.js';

import type {FeatureState} from '../style-spec/expression/index.js';
import type {Bucket} from '../data/bucket.js';
import type Point from '@mapbox/point-geometry';
import type {FeatureFilter, FilterExpression} from '../style-spec/feature_filter/index.js';
import type {TransitionParameters, PropertyValue} from './properties.js';
import type EvaluationParameters from './evaluation_parameters.js';
import type Transform from '../geo/transform.js';
import type {
    LayerSpecification,
    FilterSpecification,
    TransitionSpecification,
    PropertyValueSpecification
} from '../style-spec/types.js';
import type {CustomLayerInterface} from './style_layer/custom_style_layer.js';
import type Map from '../ui/map.js';
import type {StyleSetterOptions} from './style.js';
import type {TilespaceQueryGeometry} from './query_geometry.js';
import type {DEMSampler} from '../terrain/elevation.js';
import type {IVectorTileFeature} from '@mapbox/vector-tile';

const TRANSITION_SUFFIX = '-transition';

class StyleLayer extends Evented {
    id: string;
    metadata: mixed;
    type: string;
    source: string;
    sourceLayer: ?string;
    minzoom: ?number;
    maxzoom: ?number;
    filter: FilterSpecification | void;
    visibility: 'visible' | 'none' | void;

    _unevaluatedLayout: Layout<any>;
    +layout: mixed;

    _transitionablePaint: Transitionable<any>;
    _transitioningPaint: Transitioning<any>;
    +paint: mixed;

    _featureFilter: FeatureFilter;
    _filterCompiled: boolean;

    +queryRadius: (bucket: Bucket) => number;
    +queryIntersectsFeature: (queryGeometry: TilespaceQueryGeometry,
                              feature: IVectorTileFeature,
                              featureState: FeatureState,
                              geometry: Array<Array<Point>>,
                              zoom: number,
                              transform: Transform,
                              pixelPosMatrix: Float32Array,
                              elevationHelper: ?DEMSampler,
                              layoutVertexArrayOffset: number) => boolean | number;

    +onAdd: ?(map: Map) => void;
    +onRemove: ?(map: Map) => void;

    constructor(layer: LayerSpecification | CustomLayerInterface, properties: $ReadOnly<{layout?: Properties<*>, paint?: Properties<*>}>) {
        super();

        this.id = layer.id;
        this.type = layer.type;
        this._featureFilter = {filter: () => true, needGeometry: false, needFeature: false};
        this._filterCompiled = false;

        if (layer.type === 'custom') return;

        layer = ((layer: any): LayerSpecification);

        this.metadata = layer.metadata;
        this.minzoom = layer.minzoom;
        this.maxzoom = layer.maxzoom;

        if (layer.type !== 'background' && layer.type !== 'sky') {
            this.source = layer.source;
            this.sourceLayer = layer['source-layer'];
            this.filter = layer.filter;
        }

        if (properties.layout) {
            this._unevaluatedLayout = new Layout(properties.layout);
        }

        if (properties.paint) {
            this._transitionablePaint = new Transitionable(properties.paint);

            for (const property in layer.paint) {
                this.setPaintProperty(property, layer.paint[property], {validate: false});
            }
            for (const property in layer.layout) {
                this.setLayoutProperty(property, layer.layout[property], {validate: false});
            }

            this._transitioningPaint = this._transitionablePaint.untransitioned();
            //$FlowFixMe
            this.paint = new PossiblyEvaluated(properties.paint);
        }
    }

    getLayoutProperty(name: string): PropertyValueSpecification<mixed> {
        if (name === 'visibility') {
            return this.visibility;
        }

        return this._unevaluatedLayout.getValue(name);
    }

    setLayoutProperty(name: string, value: any, options: StyleSetterOptions = {}) {
        if (value !== null && value !== undefined) {
            const key = `layers.${this.id}.layout.${name}`;
            if (this._validate(validateLayoutProperty, key, name, value, options)) {
                return;
            }
        }

        if (name === 'visibility') {
            this.visibility = value;
            return;
        }

        this._unevaluatedLayout.setValue(name, value);
    }

    getPaintProperty(name: string): void | TransitionSpecification | PropertyValueSpecification<mixed> {
        if (endsWith(name, TRANSITION_SUFFIX)) {
            return this._transitionablePaint.getTransition(name.slice(0, -TRANSITION_SUFFIX.length));
        } else {
            return this._transitionablePaint.getValue(name);
        }
    }

    setPaintProperty(name: string, value: mixed, options: StyleSetterOptions = {}): boolean {
        if (value !== null && value !== undefined) {
            const key = `layers.${this.id}.paint.${name}`;
            if (this._validate(validatePaintProperty, key, name, value, options)) {
                return false;
            }
        }

        if (endsWith(name, TRANSITION_SUFFIX)) {
            this._transitionablePaint.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), (value: any) || undefined);
            return false;
        } else {
            const transitionable = this._transitionablePaint._values[name];
            const wasDataDriven = transitionable.value.isDataDriven();
            const oldValue = transitionable.value;

            this._transitionablePaint.setValue(name, value);
            this._handleSpecialPaintPropertyUpdate(name);

            const newValue = this._transitionablePaint._values[name].value;
            const isDataDriven = newValue.isDataDriven();
            const isPattern = endsWith(name, 'pattern') || name === 'line-dasharray';

            // if a pattern value is changed, we need to make sure the new icons get added to each tile's iconAtlas
            // so a call to _updateLayer is necessary, and we return true from this function so it gets called in
            // Style#setPaintProperty
            return isDataDriven || wasDataDriven || isPattern || this._handleOverridablePaintPropertyUpdate(name, oldValue, newValue);
        }
    }

    _handleSpecialPaintPropertyUpdate(_: string) {
        // No-op; can be overridden by derived classes.
    }

    getProgramIds(): string[] | null {
        // No-op; can be overridden by derived classes.
        return null;
    }

    getProgramConfiguration(_: number): ProgramConfiguration | null {
        // No-op; can be overridden by derived classes.
        return null;
    }

    // eslint-disable-next-line no-unused-vars
    _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean {
        // No-op; can be overridden by derived classes.
        return false;
    }

    isHidden(zoom: number): boolean {
        if (this.minzoom && zoom < this.minzoom) return true;
        if (this.maxzoom && zoom >= this.maxzoom) return true;
        return this.visibility === 'none';
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioningPaint = this._transitionablePaint.transitioned(parameters, this._transitioningPaint);
    }

    hasTransition(): boolean {
        return this._transitioningPaint.hasTransition();
    }

    recalculate(parameters: EvaluationParameters, availableImages: Array<string>) {
        if (this._unevaluatedLayout) {
            (this: any).layout = this._unevaluatedLayout.possiblyEvaluate(parameters, undefined, availableImages);
        }

        (this: any).paint = this._transitioningPaint.possiblyEvaluate(parameters, undefined, availableImages);
    }

    serialize(): LayerSpecification {
        const output: any = {
            'id': this.id,
            'type': this.type,
            'source': this.source,
            'source-layer': this.sourceLayer,
            'metadata': this.metadata,
            'minzoom': this.minzoom,
            'maxzoom': this.maxzoom,
            'filter': this.filter,
            'layout': this._unevaluatedLayout && this._unevaluatedLayout.serialize(),
            'paint': this._transitionablePaint && this._transitionablePaint.serialize()
        };

        if (this.visibility) {
            output.layout = output.layout || {};
            output.layout.visibility = this.visibility;
        }

        return filterObject(output, (value, key) => {
            return value !== undefined &&
                !(key === 'layout' && !Object.keys(value).length) &&
                !(key === 'paint' && !Object.keys(value).length);
        });
    }

    _validate(validate: Function, key: string, name: string, value: mixed, options: StyleSetterOptions = {}): boolean {
        if (options && options.validate === false) {
            return false;
        }
        return emitValidationErrors(this, validate.call(validateStyle, {
            key,
            layerType: this.type,
            objectKey: name,
            value,
            styleSpec,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true}
        }));
    }

    is3D(): boolean {
        return false;
    }

    isSky(): boolean {
        return false;
    }

    isTileClipped(): boolean {
        return false;
    }

    hasOffscreenPass(): boolean {
        return false;
    }

    resize() {
        // noop
    }

    isStateDependent(): boolean {
        for (const property in (this: any).paint._values) {
            const value = (this: any).paint.get(property);
            if (!(value instanceof PossiblyEvaluatedPropertyValue) || !supportsPropertyExpression(value.property.specification)) {
                continue;
            }

            if ((value.value.kind === 'source' || value.value.kind === 'composite') &&
                value.value.isStateDependent) {
                return true;
            }
        }
        return false;
    }

    compileFilter() {
        if (!this._filterCompiled) {
            this._featureFilter = featureFilter(this.filter);
            this._filterCompiled = true;
        }
    }

    invalidateCompiledFilter() {
        this._filterCompiled = false;
    }

    dynamicFilter(): ?FilterExpression {
        return this._featureFilter.dynamicFilter;
    }

    dynamicFilterNeedsFeature(): boolean {
        return this._featureFilter.needFeature;
    }
}

export default StyleLayer;
