import StyleLayer from '../../../src/style/style_layer';
import {getLayoutProperties, getPaintProperties} from './model_style_layer_properties';
import {ZoomDependentExpression} from '../../../src/style-spec/expression/index';
import EXTENT from '../../../src/style-spec/data/extent';
import {ModelBucket, prepareStandard} from '../../../modules/standard_worker';
import {Standard} from '../../../modules/standard_registry';

import type Tiled3dModelBucket from '../../data/bucket/tiled_3d_model_bucket';
import type {Layout, Transitionable, Transitioning, PossiblyEvaluated, PropertyValue, ConfigOptions} from '../../../src/style/properties';
import type Point from '@mapbox/point-geometry';
import type {LayerSpecification, ModelLayerSpecification} from '../../../src/style-spec/types';
import type {PaintProps, LayoutProps} from './model_style_layer_properties';
import type {BucketParameters, Bucket} from '../../../src/data/bucket';
import type {QueryGeometry, TilespaceQueryGeometry} from '../../../src/style/query_geometry';
import type Transform from '../../../src/geo/transform';
import type ModelManager from '../../render/model_manager';
import type {FeatureState} from '../../../src/style-spec/expression/index';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {RuntimeModuleType} from '../../../src/style/style_layer';
import type {LUT} from "../../../src/util/lut";
import type {ProgramName} from '../../../src/render/program';
import type {QueryResult} from '../../../src/source/query_features';
import type SourceCache from '../../../src/source/source_cache';
import type {DEMSampler} from '../../../src/terrain/elevation';

class ModelStyleLayer extends StyleLayer {
    override type!: 'model';

    override _unevaluatedLayout!: Layout<LayoutProps>;
    override layout!: PossiblyEvaluated<LayoutProps>;

    override _transitionablePaint!: Transitionable<PaintProps>;
    override _transitioningPaint!: Transitioning<PaintProps>;
    override paint!: PossiblyEvaluated<PaintProps>;

    modelManager!: ModelManager;
    layer: ModelLayerSpecification;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            layout: getLayoutProperties(),
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
        this.layer = layer as ModelLayerSpecification;
        this._stats = {numRenderedVerticesInShadowPass: 0, numRenderedVerticesInTransparentPass: 0};
    }

    override mayUse(type: RuntimeModuleType): boolean {
        return type === 'Standard';
    }

    override prepare(): Promise<void> {
        return prepareStandard();
    }

    override createBucket(parameters: BucketParameters<this>): ModelBucket {
        return new ModelBucket(parameters);
    }

    override getProgramIds(): ProgramName[] {
        return ['model'];
    }

    override is3D(terrainEnabled?: boolean): boolean {
        return true;
    }

    override hasShadowPass(): boolean {
        return this.paint.get('model-cast-shadows');
    }

    override canCastShadows(): boolean {
        return true;
    }

    override hasLightBeamPass(): boolean {
        return true;
    }

    override cutoffRange(): number {
        return this.paint.get('model-cutoff-fade-range');
    }

    override queryRadius(bucket: Bucket): number {
        // Uses the discriminator tag rather than `instanceof`: in the ESM build the
        // `Tiled3dModelBucket` live binding is undefined until the Standard module loads.
        return (bucket as Tiled3dModelBucket).isTiled3dModelBucket ? EXTENT - 1 : 0;
    }

    override queryRenderedFeatures(
        queryGeometry: QueryGeometry,
        sourceCache: SourceCache,
        transform: Transform
    ): QueryResult {
        if (!Standard.queryModelLayerRendered) return {};
        return Standard.queryModelLayerRendered(this, queryGeometry, sourceCache, transform);
    }

    override queryIntersectsFeature(
        queryGeometry: TilespaceQueryGeometry,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: Transform,
        pixelPosMatrix: Float32Array,
        elevationHelper: DEMSampler | null | undefined,
        layoutVertexArrayOffset: number,
        scope: string | undefined
    ): number | boolean {
        if (!Standard.queryModelLayerIntersectsFeature) return false;
        return Standard.queryModelLayerIntersectsFeature(this, queryGeometry, feature, featureState, transform, scope);
    }

    override _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean {
        if (!this.layout || oldValue.isDataDriven() || newValue.isDataDriven()) {
            return false;
        }
        // relayout on programatically setPaintProperty for all non-data-driven properties that get baked into vertex data.
        // Buckets could be updated without relayout later, if needed to optimize.
        return name === "model-color" || name === "model-color-mix-intensity" || name === "model-rotation" || name === "model-scale" || name === "model-translation" || name === "model-emissive-strength";
    }

    _isPropertyZoomDependent(name: string): boolean {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const prop = this._transitionablePaint._values[name];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return prop != null && prop.value != null &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            prop.value.expression != null &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            prop.value.expression instanceof ZoomDependentExpression;
    }

    isZoomDependent(): boolean {
        return this._isPropertyZoomDependent('model-scale') ||
            this._isPropertyZoomDependent('model-rotation') ||
            this._isPropertyZoomDependent('model-translation');
    }
}

export default ModelStyleLayer;
