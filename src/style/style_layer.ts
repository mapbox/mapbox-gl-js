import {filterObject} from '../util/util';
import {Evented} from '../util/evented';
import {Layout, Transitionable, PossiblyEvaluated, PossiblyEvaluatedPropertyValue} from './properties';
import {supportsPropertyExpression} from '../style-spec/util/properties';
import featureFilter from '../style-spec/feature_filter/index';
import {makeFQID} from '../util/fqid';
import {createExpression, type FeatureState} from '../style-spec/expression/index';
import latest from '../style-spec/reference/latest';
import assert from 'assert';

import type {Bucket} from '../data/bucket';
import type Point from '@mapbox/point-geometry';
import type {FeatureFilter, FilterExpression} from '../style-spec/feature_filter/index';
import type {TransitionParameters, PropertyValue, ConfigOptions, Transitioning, Properties} from './properties';
import type EvaluationParameters from './evaluation_parameters';
import type Transform from '../geo/transform';
import type {
    LayerSpecification,
    LayoutSpecification,
    PaintSpecification,
    FilterSpecification,
    PropertyValueSpecification
} from '../style-spec/types';
import type {CustomLayerInterface} from './style_layer/custom_style_layer';
import type {Map as MapboxMap} from '../ui/map';
import type {TilespaceQueryGeometry} from './query_geometry';
import type {DEMSampler} from '../terrain/elevation';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {CreateProgramParams} from '../render/painter';
import type SourceCache from '../source/source_cache';
import type Painter from '../render/painter';
import type {LUT} from '../util/lut';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {ProgramName} from '../render/program';

const TRANSITION_SUFFIX = '-transition';

type LayerRenderingStats = {
    numRenderedVerticesInTransparentPass: number;
    numRenderedVerticesInShadowPass: number;
};

// Symbols are draped only on native and for certain cases only
const drapedLayers = new Set(['fill', 'line', 'background', 'hillshade', 'raster']);

class StyleLayer extends Evented {
    id: string;
    fqid: string;
    scope: string;
    lut: LUT | null;
    metadata: unknown;
    type: LayerSpecification['type'] | 'custom';
    source: string;
    sourceLayer: string | null | undefined;
    slot: string | null | undefined;
    minzoom: number | null | undefined;
    maxzoom: number | null | undefined;
    filter: FilterSpecification | undefined;
    visibility: 'visible' | 'none' | undefined;
    configDependencies: Set<string>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _unevaluatedLayout: Layout<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly layout: PossiblyEvaluated<any>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _transitionablePaint: Transitionable<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _transitioningPaint: Transitioning<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly paint: PossiblyEvaluated<any>;

    _featureFilter: FeatureFilter;
    _filterCompiled: boolean;

    options: ConfigOptions | null | undefined;
    _stats: LayerRenderingStats | null | undefined;

    constructor(
        layer: LayerSpecification | CustomLayerInterface,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: Readonly<{layout?: Properties<any>; paint?: Properties<any>;}>,
        scope: string,
        lut: LUT | null,
        options?: ConfigOptions | null
    ) {
        super();

        this.id = layer.id;
        this.fqid = makeFQID(this.id, scope);
        this.type = layer.type;
        this.scope = scope;
        this.lut = lut;
        this.options = options;

        this._featureFilter = {filter: () => true, needGeometry: false, needFeature: false};
        this._filterCompiled = false;
        this.configDependencies = new Set();

        if (layer.type === 'custom') return;

        this.metadata = layer.metadata;
        this.minzoom = layer.minzoom;
        this.maxzoom = layer.maxzoom;

        if (layer.type && layer.type !== 'background' && layer.type !== 'sky' && layer.type !== 'slot') {
            this.source = layer.source;
            this.sourceLayer = layer['source-layer'];
            this.filter = layer.filter;

            const filterSpec = latest[`filter_${layer.type}`];
            assert(filterSpec);
            const compiledStaticFilter = createExpression(this.filter, filterSpec);
            if (compiledStaticFilter.result !== 'error') {
                this.configDependencies = new Set([...this.configDependencies, ...compiledStaticFilter.value.configDependencies]);
            }
        }

        if (layer.slot) this.slot = layer.slot;

        if (properties.layout) {
            this._unevaluatedLayout = new Layout(properties.layout, this.scope, options);
            this.configDependencies = new Set([...this.configDependencies, ...this._unevaluatedLayout.configDependencies]);
        }

        if (properties.paint) {
            this._transitionablePaint = new Transitionable(properties.paint, this.scope, options);

            for (const property in layer.paint) {
                this.setPaintProperty(property as keyof PaintSpecification, layer.paint[property]);
            }
            for (const property in layer.layout) {
                this.setLayoutProperty(property as keyof LayoutSpecification, layer.layout[property]);
            }
            this.configDependencies = new Set([...this.configDependencies, ...this._transitionablePaint.configDependencies]);

            this._transitioningPaint = this._transitionablePaint.untransitioned();
            this.paint = new PossiblyEvaluated(properties.paint);
        }
    }

    // No-op in the StyleLayer class, must be implemented by each concrete StyleLayer
    onAdd(_map: MapboxMap): void {}

    // No-op in the StyleLayer class, must be implemented by each concrete StyleLayer
    onRemove(_map: MapboxMap): void {}

    isDraped(_sourceCache?: SourceCache): boolean {
        return !this.is3D(true) && drapedLayers.has(this.type);
    }

    getLayoutProperty<T extends keyof LayoutSpecification>(name: T): LayoutSpecification[T] | undefined {
        if (name === 'visibility') {
            // @ts-expect-error - TS2590 - Expression produces a union type that is too complex to represent.
            return this.visibility;
        }

        return this._unevaluatedLayout.getValue(name);
    }

    setLayoutProperty<T extends keyof LayoutSpecification>(name: string, value: LayoutSpecification[T]): void {
        if (this.type === 'custom' && name === 'visibility') {
            // @ts-expect-error - TS2590 - Expression produces a union type that is too complex to represent.
            this.visibility = value;
            return;
        }

        const layout = this._unevaluatedLayout;
        const specProps = layout._properties.properties;
        if (!specProps[name]) return; // skip unrecognized properties

        layout.setValue(name, value);
        this.configDependencies = new Set([...this.configDependencies, ...layout.configDependencies]);

        if (name === 'visibility') {
            this.possiblyEvaluateVisibility();
        }
    }

    possiblyEvaluateVisibility() {
        if (!this._unevaluatedLayout._values.visibility) {
            // Early return for layers which don't have a visibility property, like clip-layer
            return;
        }
        // @ts-expect-error - TS2322 - Type 'unknown' is not assignable to type '"none" | "visible"'. | TS2345 - Argument of type '{ zoom: number; }' is not assignable to parameter of type 'EvaluationParameters'.
        this.visibility = this._unevaluatedLayout._values.visibility.possiblyEvaluate({zoom: 0});
    }

    getPaintProperty<T extends keyof PaintSpecification>(name: T): PaintSpecification[T] | undefined {
        if (name.endsWith(TRANSITION_SUFFIX)) {
            return this._transitionablePaint.getTransition(name.slice(0, -TRANSITION_SUFFIX.length)) as PaintSpecification[T];
        } else {
            return this._transitionablePaint.getValue(name) as PaintSpecification[T];
        }
    }

    setPaintProperty<T extends keyof PaintSpecification>(name: T, value: PaintSpecification[T]): boolean {
        const paint = this._transitionablePaint;
        const specProps = paint._properties.properties;

        if (name.endsWith(TRANSITION_SUFFIX)) {
            const propName = name.slice(0, -TRANSITION_SUFFIX.length);
            if (specProps[propName]) { // skip unrecognized properties
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                paint.setTransition(propName, (value as any) || undefined);
            }
            return false;

        }

        if (!specProps[name]) return false; // skip unrecognized properties

        const transitionable = paint._values[name];
        const wasDataDriven = transitionable.value.isDataDriven();
        const oldValue = transitionable.value;

        paint.setValue(name, value as PropertyValueSpecification<unknown>);
        this.configDependencies = new Set([...this.configDependencies, ...paint.configDependencies]);
        this._handleSpecialPaintPropertyUpdate(name);

        const newValue = paint._values[name].value;
        const isDataDriven = newValue.isDataDriven();
        const isPattern = name.endsWith('pattern') || name === 'line-dasharray';

        // if a pattern value is changed, we need to make sure the new icons get added to each tile's iconAtlas
        // so a call to _updateLayer is necessary, and we return true from this function so it gets called in
        // Style#setPaintProperty
        return isDataDriven || wasDataDriven || isPattern || this._handleOverridablePaintPropertyUpdate(name, oldValue, newValue);
    }

    _handleSpecialPaintPropertyUpdate(_: string) {
        // No-op; can be overridden by derived classes.
    }

    getProgramIds(): ProgramName[] | null {
        // No-op; can be overridden by derived classes.
        return null;
    }

    getDefaultProgramParams(name: string, zoom: number, lut: LUT | null): CreateProgramParams | null {
        // No-op; can be overridden by derived classes.
        return null;
    }

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

    recalculate(parameters: EvaluationParameters, availableImages: ImageId[]) {
        if (this._unevaluatedLayout) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this as any).layout = this._unevaluatedLayout.possiblyEvaluate(parameters, undefined, availableImages);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).paint = this._transitioningPaint.possiblyEvaluate(parameters, undefined, availableImages);
    }

    serialize(): LayerSpecification {
        assert(this.type !== 'custom', 'Custom layers cannot be serialized');

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
        } as LayerSpecification;

        return filterObject(output, (value, key) => {
            return value !== undefined &&
                !(key === 'layout' && !Object.keys(value).length) &&
                !(key === 'paint' && !Object.keys(value).length);
        });
    }

    // Determines if the layer is 3D based on whether terrain is enabled.
    // If 'terrainEnabled' parameter is not provided, then the function
    // should return true if the layer is potentially 3D.
    is3D(terrainEnabled?: boolean): boolean {
        return false;
    }

    hasElevation(): boolean {
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

    _clear() {
        // noop
    }

    isStateDependent(): boolean {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const property in (this as any).paint._values) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const value = (this as any).paint.get(property);
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

    compileFilter(options?: ConfigOptions | null) {
        if (!this._filterCompiled) {
            this._featureFilter = featureFilter(this.filter, this.scope, options);
            this._filterCompiled = true;
        }
    }

    invalidateCompiledFilter() {
        this._filterCompiled = false;
    }

    dynamicFilter(): FilterExpression | null | undefined {
        return this._featureFilter.dynamicFilter;
    }

    dynamicFilterNeedsFeature(): boolean {
        return this._featureFilter.needFeature;
    }

    getLayerRenderingStats(): LayerRenderingStats | null | undefined {
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

    // @ts-expect-error - TS2355 - A function whose declared type is neither 'undefined', 'void', nor 'any' must return a value.
    queryRadius(_bucket: Bucket): number {}

    queryIntersectsFeature(
        _queryGeometry: TilespaceQueryGeometry,
        _feature: VectorTileFeature,
        _featureState: FeatureState,
        _geometry: Array<Array<Point>>,
        _zoom: number,
        _transform: Transform,
        _pixelPosMatrix: Float32Array,
        _elevationHelper: DEMSampler | null | undefined,
        _layoutVertexArrayOffset: number,
        // @ts-expect-error - TS2355 - A function whose declared type is neither 'undefined', 'void', nor 'any' must return a value.
    ): boolean | number {}
}

export default StyleLayer;
