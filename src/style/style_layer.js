// @flow

import {endsWith, filterObject} from '../util/util.js';

import {Evented} from '../util/evented.js';
import {Layout, Transitionable, Transitioning, Properties, PossiblyEvaluated, PossiblyEvaluatedPropertyValue} from './properties.js';
import {supportsPropertyExpression} from '../style-spec/util/properties.js';
import featureFilter from '../style-spec/feature_filter/index.js';
import {makeFQID} from '../util/fqid.js';

import type {FeatureState} from '../style-spec/expression/index.js';
import type {Bucket} from '../data/bucket.js';
import type Point from '@mapbox/point-geometry';
import type {FeatureFilter, FilterExpression} from '../style-spec/feature_filter/index.js';
import type {TransitionParameters, PropertyValue, ConfigOptions} from './properties.js';
import type EvaluationParameters from './evaluation_parameters.js';
import type Transform from '../geo/transform.js';
import type {
    LayerSpecification,
    FilterSpecification,
    TransitionSpecification,
    PropertyValueSpecification
} from '../style-spec/types.js';
import type {CustomLayerInterface} from './style_layer/custom_style_layer.js';
import type MapboxMap from '../ui/map.js';
import type {TilespaceQueryGeometry} from './query_geometry.js';
import type {DEMSampler} from '../terrain/elevation.js';
import type {IVectorTileFeature} from '@mapbox/vector-tile';
import type {CreateProgramParams} from "../render/painter.js";
import type SourceCache from '../source/source_cache.js';
import type Painter from '../render/painter.js';
import type {QueryFeature} from '../util/vectortile_to_geojson.js';

const TRANSITION_SUFFIX = '-transition';

type LayerRenderingStats = {
    numRenderedVerticesInTransparentPass: number;
    numRenderedVerticesInShadowPass: number;
};

class StyleLayer extends Evented {
    id: string;
    fqid: string;
    scope: string;
    metadata: mixed;
    type: string;
    source: string;
    sourceLayer: ?string;
    slot: ?string;
    minzoom: ?number;
    maxzoom: ?number;
    filter: FilterSpecification | void;
    visibility: 'visible' | 'none' | void;
    isConfigDependent: boolean;

    _unevaluatedLayout: Layout<any>;
    +layout: mixed;

    _transitionablePaint: Transitionable<any>;
    _transitioningPaint: Transitioning<any>;
    +paint: mixed;

    _featureFilter: FeatureFilter;
    _filterCompiled: boolean;

    options: ?ConfigOptions;
    _stats: ?LayerRenderingStats;

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
    +queryIntersectsMatchingFeature: (queryGeometry: TilespaceQueryGeometry,
                                      featureIndex: number,
                                      filter: FeatureFilter,
                                      transform: Transform) => {queryFeature: ?QueryFeature, intersectionZ: number};

    +onAdd: ?(map: MapboxMap) => void;
    +onRemove: ?(map: MapboxMap) => void;
    +isLayerDraped: ?(sourceCache: ?SourceCache) => boolean;

    constructor(layer: LayerSpecification | CustomLayerInterface, properties: $ReadOnly<{layout?: Properties<*>, paint?: Properties<*>}>, scope: string, options?: ?ConfigOptions) {
        super();

        this.id = layer.id;
        this.fqid = makeFQID(this.id, scope);
        this.type = layer.type;
        this.scope = scope;
        this.options = options;

        this._featureFilter = {filter: () => true, needGeometry: false, needFeature: false};
        this._filterCompiled = false;
        this.isConfigDependent = false;

        if (layer.type === 'custom') return;

        layer = ((layer: any): LayerSpecification);

        this.metadata = layer.metadata;
        this.minzoom = layer.minzoom;
        this.maxzoom = layer.maxzoom;

        if (layer.type !== 'background' && layer.type !== 'sky' && layer.type !== 'slot') {
            this.source = layer.source;
            this.sourceLayer = layer['source-layer'];
            this.filter = layer.filter;
        }

        if (layer.slot) this.slot = layer.slot;

        if (properties.layout) {
            this._unevaluatedLayout = new Layout(properties.layout, this.scope, options);
            this.isConfigDependent = this.isConfigDependent || this._unevaluatedLayout.isConfigDependent;
        }

        if (properties.paint) {
            this._transitionablePaint = new Transitionable(properties.paint, this.scope, options);

            for (const property in layer.paint) {
                this.setPaintProperty(property, layer.paint[property]);
            }
            for (const property in layer.layout) {
                this.setLayoutProperty(property, layer.layout[property]);
            }
            this.isConfigDependent = this.isConfigDependent || this._transitionablePaint.isConfigDependent;

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

    setLayoutProperty(name: string, value: any) {
        if (this.type === 'custom' && name === 'visibility') {
            this.visibility = value;
            return;
        }

        const layout = this._unevaluatedLayout;
        const specProps = layout._properties.properties;
        if (!specProps[name]) return; // skip unrecognized properties

        layout.setValue(name, value);
        this.isConfigDependent = this.isConfigDependent || layout.isConfigDependent;

        if (name === 'visibility') {
            this.possiblyEvaluateVisibility();
        }
    }

    possiblyEvaluateVisibility() {
        this.visibility = this._unevaluatedLayout._values.visibility.possiblyEvaluate({zoom: 0});
    }

    getPaintProperty(name: string): void | TransitionSpecification | PropertyValueSpecification<mixed> {
        if (endsWith(name, TRANSITION_SUFFIX)) {
            return this._transitionablePaint.getTransition(name.slice(0, -TRANSITION_SUFFIX.length));
        } else {
            return this._transitionablePaint.getValue(name);
        }
    }

    setPaintProperty(name: string, value: mixed): boolean {
        const paint = this._transitionablePaint;
        const specProps = paint._properties.properties;

        if (endsWith(name, TRANSITION_SUFFIX)) {
            const propName = name.slice(0, -TRANSITION_SUFFIX.length);
            if (specProps[propName]) { // skip unrecognized properties
                paint.setTransition(propName, (value: any) || undefined);
            }
            return false;

        }

        if (!specProps[name]) return false; // skip unrecognized properties

        const transitionable = paint._values[name];
        const wasDataDriven = transitionable.value.isDataDriven();
        const oldValue = transitionable.value;

        paint.setValue(name, value);
        this.isConfigDependent = this.isConfigDependent || paint.isConfigDependent;
        this._handleSpecialPaintPropertyUpdate(name);

        const newValue = paint._values[name].value;
        const isDataDriven = newValue.isDataDriven();
        const isPattern = endsWith(name, 'pattern') || name === 'line-dasharray';

        // if a pattern value is changed, we need to make sure the new icons get added to each tile's iconAtlas
        // so a call to _updateLayer is necessary, and we return true from this function so it gets called in
        // Style#setPaintProperty
        return isDataDriven || wasDataDriven || isPattern || this._handleOverridablePaintPropertyUpdate(name, oldValue, newValue);
    }

    _handleSpecialPaintPropertyUpdate(_: string) {
        // No-op; can be overridden by derived classes.
    }

    getProgramIds(): string[] | null {
        // No-op; can be overridden by derived classes.
        return null;
    }

    // eslint-disable-next-line no-unused-vars
    getDefaultProgramParams(name: string, zoom: number): CreateProgramParams | null {
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
        const output = {
            'id': this.id,
            'type': this.type,
            'slot': this.slot,
            'source': this.source,
            'source-layer': this.sourceLayer,
            'metadata': this.metadata,
            'minzoom': this.minzoom,
            'maxzoom': this.maxzoom,
            'filter': this.filter,
            'layout': this._unevaluatedLayout && this._unevaluatedLayout.serialize(),
            'paint': this._transitionablePaint && this._transitionablePaint.serialize()
        };

        return filterObject(output, (value, key) => {
            return value !== undefined &&
                !(key === 'layout' && !Object.keys(value).length) &&
                !(key === 'paint' && !Object.keys(value).length);
        });
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

    hasShadowPass(): boolean {
        return false;
    }

    canCastShadows(): boolean {
        return false;
    }

    hasLightBeamPass(): boolean {
        return false;
    }

    cutoffRange(): number {
        return 0.0;
    }

    tileCoverLift(): number {
        return 0.0;
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

    getLayerRenderingStats(): ?LayerRenderingStats {
        return this._stats;
    }

    resetLayerRenderingStats(painter: Painter) {
        if (this._stats) {
            if (painter.renderPass === 'shadow') {
                this._stats.numRenderedVerticesInShadowPass = 0;
            } else {
                this._stats.numRenderedVerticesInTransparentPass = 0;
            }
        }
    }
}

export default StyleLayer;
