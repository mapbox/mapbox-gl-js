import StyleLayer from '../../../src/style/style_layer';
import ModelBucket from '../../data/bucket/model_bucket';
import {getLayoutProperties, getPaintProperties} from './model_style_layer_properties';
import {ZoomDependentExpression} from '../../../src/style-spec/expression/index';
import {mat4} from 'gl-matrix';
import {calculateModelMatrix} from '../../data/model';
import LngLat from '../../../src/geo/lng_lat';
import {latFromMercatorY, lngFromMercatorX} from '../../../src/geo/mercator_coordinate';
import EXTENT from '../../../src/style-spec/data/extent';
import {convertModelMatrixForGlobe, queryGeometryIntersectsProjectedAabb} from '../../util/model_util';
import Tiled3dModelBucket from '../../data/bucket/tiled_3d_model_bucket';
import EvaluationParameters from '../../../src/style/evaluation_parameters';

import type {Transitionable, Transitioning, PossiblyEvaluated, PropertyValue, ConfigOptions} from '../../../src/style/properties';
import type Point from '@mapbox/point-geometry';
import type {LayerSpecification} from '../../../src/style-spec/types';
import type {PaintProps, LayoutProps} from './model_style_layer_properties';
import type {BucketParameters, Bucket} from '../../../src/data/bucket';
import type {TilespaceQueryGeometry} from '../../../src/style/query_geometry';
import type {FeatureState} from '../../../src/style-spec/expression/index';
import type Transform from '../../../src/geo/transform';
import type ModelManager from '../../render/model_manager';
import type {Node} from '../../data/model';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {FeatureFilter} from '../../../src/style-spec/feature_filter/index';
import type {GeoJSONFeature} from '../../../src/util/vectortile_to_geojson';
import type {CanonicalTileID} from '../../../src/source/tile_id';
import type {LUT} from "../../../src/util/lut";

class ModelStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<PaintProps>;
    _transitioningPaint: Transitioning<PaintProps>;
    paint: PossiblyEvaluated<PaintProps>;
    layout: PossiblyEvaluated<LayoutProps>;
    modelManager: ModelManager;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            layout: getLayoutProperties(),
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
        this._stats = {numRenderedVerticesInShadowPass : 0, numRenderedVerticesInTransparentPass: 0};
    }

    createBucket(parameters: BucketParameters<ModelStyleLayer>): ModelBucket {
        return new ModelBucket(parameters);
    }

    getProgramIds(): Array<string> {
        return ['model'];
    }

    is3D(): boolean {
        return true;
    }

    hasShadowPass(): boolean {
        return true;
    }

    canCastShadows(): boolean {
        return true;
    }

    hasLightBeamPass(): boolean {
        return true;
    }

    cutoffRange(): number {

        return this.paint.get('model-cutoff-fade-range');
    }

    queryRadius(bucket: Bucket): number {
        return (bucket instanceof Tiled3dModelBucket) ? EXTENT - 1 : 0;
    }

    queryIntersectsFeature(
        queryGeometry: TilespaceQueryGeometry,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: Transform,
    ): number | boolean {
        if (!this.modelManager) return false;
        const modelManager = this.modelManager;
        const b = queryGeometry.tile.getBucket(this);
        if (!b || !(b instanceof ModelBucket)) return false;
        const bucket: ModelBucket = (b as any);

        for (const modelId in bucket.instancesPerModel) {
            const instances = bucket.instancesPerModel[modelId];
            const featureId = feature.id !== undefined ? feature.id :
                (feature.properties && feature.properties.hasOwnProperty("id")) ? feature.properties["id"] : undefined;
            if (instances.idToFeaturesIndex.hasOwnProperty(featureId)) {
                const modelFeature = instances.features[instances.idToFeaturesIndex[featureId]];
                const model = modelManager.getModel(modelId, this.scope);
                if (!model) return false;

                let matrix: mat4 = mat4.create();
                const position = new LngLat(0, 0);
                const id = bucket.canonical;
                let minDepth = Number.MAX_VALUE;
                for (let i = 0; i < modelFeature.instancedDataCount; ++i) {
                    const instanceOffset = modelFeature.instancedDataOffset + i;
                    const offset = instanceOffset * 16;

                    const va = instances.instancedDataArray.float32;
                    const translation = [va[offset + 4], va[offset + 5], va[offset + 6]];
                    const pointX = va[offset];
                    const pointY = va[offset + 1] | 0; // point.y stored in integer part

                    tileToLngLat(id, position, pointX, pointY);

                    calculateModelMatrix(matrix,
                                         model,
                                         transform,
                                         position,
                                         modelFeature.rotation,
                                         modelFeature.scale,
                                         // @ts-expect-error - TS2345 - Argument of type 'any[]' is not assignable to parameter of type 'vec3'.
                                         translation,
                                         false,
                                         false,
                                         false);
                    if (transform.projection.name === 'globe') {
                        matrix = convertModelMatrixForGlobe(matrix, transform);
                    }
                    // @ts-expect-error - TS2345 - Argument of type 'number[] | Float32Array | Float64Array' is not assignable to parameter of type 'ReadonlyMat4'.
                    const worldViewProjection = mat4.multiply([] as any, transform.projMatrix, matrix);
                    // Collision checks are performed in screen space. Corners are in ndc space.
                    const screenQuery = queryGeometry.queryGeometry;
                    const projectedQueryGeometry = screenQuery.isPointQuery() ? screenQuery.screenBounds : screenQuery.screenGeometry;
                    const depth = queryGeometryIntersectsProjectedAabb(projectedQueryGeometry, transform, worldViewProjection, model.aabb);
                    if (depth != null) {
                        minDepth = Math.min(depth, minDepth);
                    }
                }
                if (minDepth !== Number.MAX_VALUE) {
                    return minDepth;
                }
                return false;
            }
        }
        return false;
    }

    _handleOverridablePaintPropertyUpdate<T, R>(name: string, oldValue: PropertyValue<T, R>, newValue: PropertyValue<T, R>): boolean {
        if (!this.layout || oldValue.isDataDriven() || newValue.isDataDriven()) {
            return false;
        }
        // relayout on programatically setPaintProperty for all non-data-driven properties that get baked into vertex data.
        // Buckets could be updated without relayout later, if needed to optimize.
        return name === "model-color" || name === "model-color-mix-intensity" || name === "model-rotation" || name === "model-scale" || name === "model-translation" || name === "model-emissive-strength";
    }

    _isPropertyZoomDependent(name: string): boolean {
        const prop = this._transitionablePaint._values[name];
        return prop != null && prop.value != null &&
            prop.value.expression != null &&
            prop.value.expression instanceof ZoomDependentExpression;
    }

    isZoomDependent(): boolean {
        return this._isPropertyZoomDependent('model-scale') ||
            this._isPropertyZoomDependent('model-rotation') ||
            this._isPropertyZoomDependent('model-translation');
    }

    queryIntersectsMatchingFeature(
        queryGeometry: TilespaceQueryGeometry,
        featureIndex: number,
        filter: FeatureFilter,
        transform: Transform,
    ): {
        queryFeature: GeoJSONFeature | null | undefined;
        intersectionZ: number;
    } {

        const tile = queryGeometry.tile;
        const b = tile.getBucket(this);
        let queryFeature = null;
        let intersectionZ = Number.MAX_VALUE;
        if (!b || !(b instanceof Tiled3dModelBucket)) return {queryFeature, intersectionZ};
        const bucket: Tiled3dModelBucket = (b as any);

        const nodeInfo = bucket.getNodesInfo()[featureIndex];

        if (nodeInfo.hiddenByReplacement ||
            !nodeInfo.node.meshes ||
            !filter.filter(new EvaluationParameters(tile.tileID.overscaledZ), nodeInfo.feature, tile.tileID.canonical)) {
            return {queryFeature, intersectionZ};
        }

        // AABB check
        const node = nodeInfo.node;
        const tileMatrix = transform.calculatePosMatrix(tile.tileID.toUnwrapped(), transform.worldSize);
        const modelMatrix = tileMatrix;
        const scale = nodeInfo.evaluatedScale;
        let elevation = 0;
        if (transform.elevation && node.elevation) {
            elevation = node.elevation * transform.elevation.exaggeration();
        }
        const anchorX = node.anchor ? node.anchor[0] : 0;
        const anchorY = node.anchor ? node.anchor[1] : 0;

        // @ts-expect-error - TS2345 - Argument of type 'Float64Array' is not assignable to parameter of type 'mat4'.
        mat4.translate(modelMatrix, modelMatrix, [anchorX * (scale[0] - 1),
            anchorY * (scale[1] - 1),
            elevation]);
        // @ts-expect-error - TS2345 - Argument of type 'Float64Array' is not assignable to parameter of type 'mat4'.
        mat4.scale(modelMatrix, modelMatrix, scale);

        // @ts-expect-error - TS2345 - Argument of type 'Float64Array' is not assignable to parameter of type 'mat4'.
        mat4.multiply(modelMatrix, modelMatrix, node.matrix);

        // Collision checks are performed in screen space. Corners are in ndc space.
        const screenQuery = queryGeometry.queryGeometry;
        const projectedQueryGeometry = screenQuery.isPointQuery() ? screenQuery.screenBounds : screenQuery.screenGeometry;

        const checkNode = function(n: Node) {
            // @ts-expect-error - TS2345 - Argument of type 'Float64Array' is not assignable to parameter of type 'ReadonlyMat4'.
            const nodeModelMatrix = mat4.multiply([] as any, modelMatrix, n.matrix);
            // @ts-expect-error - TS2345 - Argument of type 'number[] | Float32Array | Float64Array' is not assignable to parameter of type 'ReadonlyMat4'.
            const worldViewProjection = mat4.multiply(nodeModelMatrix, transform.expandedFarZProjMatrix, nodeModelMatrix);
            for (let i = 0; i < n.meshes.length; ++i) {
                const mesh = n.meshes[i];
                if (i === n.lightMeshIndex) {
                    continue;
                }
                const depth = queryGeometryIntersectsProjectedAabb(projectedQueryGeometry, transform, worldViewProjection, mesh.aabb);
                if (depth != null) {
                    intersectionZ = Math.min(depth, intersectionZ);
                }
            }
            if (n.children) {
                for (const child of n.children) {
                    checkNode(child);
                }
            }
        };

        checkNode(node);
        if (intersectionZ === Number.MAX_VALUE) {
            return {queryFeature, intersectionZ};
        }

        const position = new LngLat(0, 0);
        tileToLngLat(tile.tileID.canonical, position, nodeInfo.node.anchor[0], nodeInfo.node.anchor[1]);
        queryFeature = {
            type: 'Feature',
            geometry: {type: "Point", coordinates: [position.lng, position.lat]},
            properties: nodeInfo.feature.properties,
            id: nodeInfo.feature.id,
            state: {}, // append later
            layer: this.serialize()
        };
        return {queryFeature, intersectionZ};
    }
}

export default ModelStyleLayer;

function tileToLngLat(id: CanonicalTileID, position: LngLat, pointX: number, pointY: number) {
    const tileCount = 1 << id.z;
    position.lat = latFromMercatorY((pointY / EXTENT + id.y) / tileCount);
    position.lng = lngFromMercatorX((pointX / EXTENT + id.x) / tileCount);
}
