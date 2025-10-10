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
import Feature from '../../../src/util/vectortile_to_geojson';
import {type Feature as ExpressionEvalFeature, type FeatureState} from '../../../src/style-spec/expression/index';
import ModelSource from '../../source/model_source';

import type {Layout, Transitionable, Transitioning, PossiblyEvaluated, PropertyValue, ConfigOptions} from '../../../src/style/properties';
import type Point from '@mapbox/point-geometry';
import type {LayerSpecification, ModelLayerSpecification} from '../../../src/style-spec/types';
import type {PaintProps, LayoutProps} from './model_style_layer_properties';
import type {BucketParameters, Bucket} from '../../../src/data/bucket';
import type {QueryGeometry, TilespaceQueryGeometry} from '../../../src/style/query_geometry';
import type Transform from '../../../src/geo/transform';
import type ModelManager from '../../render/model_manager';
import type {ModelNode} from '../../data/model';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {CanonicalTileID} from '../../../src/source/tile_id';
import type {LUT} from "../../../src/util/lut";
import type {EvaluationFeature} from '../../../src/data/evaluation_feature';
import type {ProgramName} from '../../../src/render/program';
import type {QueryResult} from '../../../src/source/query_features';
import type SourceCache from '../../../src/source/source_cache';

class ModelStyleLayer extends StyleLayer {
    override type: 'model';

    override _unevaluatedLayout: Layout<LayoutProps>;
    override layout: PossiblyEvaluated<LayoutProps>;

    override _transitionablePaint: Transitionable<PaintProps>;
    override _transitioningPaint: Transitioning<PaintProps>;
    override paint: PossiblyEvaluated<PaintProps>;

    modelManager: ModelManager;
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

    createBucket(parameters: BucketParameters<ModelStyleLayer>): ModelBucket {
        return new ModelBucket(parameters);
    }

    override getProgramIds(): ProgramName[] {
        return ['model'];
    }

    override is3D(terrainEnabled?: boolean): boolean {
        return true;
    }

    override hasShadowPass(): boolean {
        return true;
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
        return (bucket instanceof Tiled3dModelBucket) ? EXTENT - 1 : 0;
    }

    override queryRenderedFeatures(
        queryGeometry: QueryGeometry,
        sourceCache: SourceCache,
        transform: Transform
    ): QueryResult {
        const source = sourceCache.getSource<ModelSource>();
        if (!source || !(source instanceof ModelSource)) return {};
        const modelSource: ModelSource = source;

        const result: QueryResult = {};
        result[this.id] = [];
        const layerResult = result[this.id];

        let modelFeatureIndex = 0;
        for (const model of modelSource.models) {
            const modelFeatureState = sourceCache.getFeatureState(this.sourceLayer, model.id);

            const modelFeatureForEval: ExpressionEvalFeature = {
                type: 'Unknown',
                id: model.id,
                properties: model.featureProperties
            };
            const rotation = this.paint.get('model-rotation').evaluate(modelFeatureForEval, modelFeatureState);
            const scale = this.paint.get('model-scale').evaluate(modelFeatureForEval, modelFeatureState);
            const translation = this.paint.get('model-translation').evaluate(modelFeatureForEval, modelFeatureState);
            const elevationReference = this.paint.get('model-elevation-reference');
            const shouldFollowTerrainSlope = elevationReference === 'ground';
            const shouldApplyElevation = elevationReference === 'ground';

            let matrix: mat4 = [];
            calculateModelMatrix(matrix,
                                         model,
                                         transform,
                                         model.position,
                                         rotation,
                                         scale,
                                         translation,
                                         shouldApplyElevation,
                                         shouldFollowTerrainSlope,
                                         false);

            if (transform.projection.name === 'globe') {
                matrix = convertModelMatrixForGlobe(matrix, transform);
            }
            const worldViewProjection = mat4.multiply([], transform.projMatrix, matrix);

            const projectedQueryGeometry = queryGeometry.isPointQuery() ? queryGeometry.screenBounds : queryGeometry.screenGeometry;

            const depth = queryGeometryIntersectsProjectedAabb(projectedQueryGeometry, transform, worldViewProjection, model.aabb);
            if (depth != null) {
                const modelFeature: Feature = new Feature(undefined, 0, 0, 0, model.id);
                modelFeature.layer = this.layer;
                // Use unsafe assignment for now, due to restriction of GeoJSON/Feature properties to number, string and boolean.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                modelFeature.properties = structuredClone(model.featureProperties) as any;
                modelFeature.properties['layer'] = this.id;
                modelFeature.properties['uri'] = model.uri;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                modelFeature.properties['orientation'] = model.orientation as any;
                modelFeature.sourceLayer = this.sourceLayer;
                modelFeature.geometry = {
                    type: 'Point',
                    coordinates: [model.position.lng, model.position.lat]
                };
                modelFeature.state = modelFeatureState;
                modelFeature.source = this.source;
                layerResult.push({featureIndex: modelFeatureIndex, feature: modelFeature, intersectionZ: depth});
            }

            ++modelFeatureIndex;
        }

        return result;
    }

    override queryIntersectsFeature(
        queryGeometry: TilespaceQueryGeometry,
        feature: VectorTileFeature,
        featureState: FeatureState,
        geometry: Array<Array<Point>>,
        zoom: number,
        transform: Transform,
    ): number | boolean {
        if (!this.modelManager) return false;
        const modelManager = this.modelManager;
        const bucket = queryGeometry.tile.getBucket(this);
        if (!bucket || !(bucket instanceof ModelBucket)) return false;

        for (const modelId in bucket.instancesPerModel) {
            const instances = bucket.instancesPerModel[modelId];
            const featureId = feature.id !== undefined ? feature.id :
                (feature.properties && feature.properties.hasOwnProperty("id")) ? (feature.properties["id"] as string | number) : undefined;
            if (instances.idToFeaturesIndex.hasOwnProperty(featureId)) {
                const modelFeature = instances.features[instances.idToFeaturesIndex[featureId]];
                const model = modelManager.getModel(modelId, this.scope);
                if (!model) return false;

                let matrix: mat4 = [];
                const position = new LngLat(0, 0);
                const id = bucket.canonical;
                let minDepth = Number.MAX_VALUE;
                for (let i = 0; i < modelFeature.instancedDataCount; ++i) {
                    const instanceOffset = modelFeature.instancedDataOffset + i;
                    const offset = instanceOffset * 16;

                    const va = instances.instancedDataArray.float32;
                    const translation: [number, number, number] = [va[offset + 4], va[offset + 5], va[offset + 6]];
                    const pointX = Math.floor(va[offset]); // point.x stored in integer part
                    const pointY = Math.floor(va[offset + 1]); // point.y stored in integer part

                    tileToLngLat(id, position, pointX, pointY);

                    calculateModelMatrix(matrix,
                                         model,
                                         transform,
                                         position,
                                         modelFeature.rotation,
                                         modelFeature.scale,
                                         translation,
                                         false,
                                         false,
                                         false);
                    if (transform.projection.name === 'globe') {
                        matrix = convertModelMatrixForGlobe(matrix, transform);
                    }
                    const worldViewProjection = mat4.multiply([], transform.projMatrix, matrix);
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

export function tileToLngLat(id: CanonicalTileID, position: LngLat, pointX: number, pointY: number) {
    const tileCount = 1 << id.z;
    position.lat = latFromMercatorY((pointY / EXTENT + id.y) / tileCount);
    position.lng = lngFromMercatorX((pointX / EXTENT + id.x) / tileCount);
}

export function loadMatchingModelFeature(bucket: Tiled3dModelBucket, featureIndex: number, tilespaceGeometry: TilespaceQueryGeometry, transform: Transform): {feature: EvaluationFeature, intersectionZ: number, position: LngLat} | undefined {
    const nodeInfo = bucket.getNodesInfo()[featureIndex];

    if (!nodeInfo || nodeInfo.hiddenByReplacement || !nodeInfo.node.meshes) return;

    let intersectionZ = Number.MAX_VALUE;

    // AABB check
    const node = nodeInfo.node;
    const tile = tilespaceGeometry.tile;
    const tileMatrix = transform.calculatePosMatrix(tile.tileID.toUnwrapped(), transform.worldSize);
    const modelMatrix = tileMatrix;
    const scale = nodeInfo.evaluatedScale;
    let elevation = 0;
    if (transform.elevation && node.elevation) {
        elevation = node.elevation * transform.elevation.exaggeration();
    }
    const anchorX = node.anchor ? node.anchor[0] : 0;
    const anchorY = node.anchor ? node.anchor[1] : 0;

    mat4.translate(modelMatrix, modelMatrix, [anchorX * (scale[0] - 1), anchorY * (scale[1] - 1), elevation]);
    mat4.scale(modelMatrix, modelMatrix, scale);

    // Collision checks are performed in screen space. Corners are in ndc space.
    const screenQuery = tilespaceGeometry.queryGeometry;
    const projectedQueryGeometry = screenQuery.isPointQuery() ? screenQuery.screenBounds : screenQuery.screenGeometry;

    const checkNode = function (n: ModelNode) {
        const worldViewProjectionForNode = mat4.multiply([] as unknown as mat4, modelMatrix, n.globalMatrix);
        mat4.multiply(worldViewProjectionForNode, transform.expandedFarZProjMatrix, worldViewProjectionForNode);
        for (let i = 0; i < n.meshes.length; ++i) {
            const mesh = n.meshes[i];
            if (i === n.lightMeshIndex) {
                continue;
            }
            const depth = queryGeometryIntersectsProjectedAabb(projectedQueryGeometry, transform, worldViewProjectionForNode, mesh.aabb);
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
    if (intersectionZ === Number.MAX_VALUE) return;

    const position = new LngLat(0, 0);
    tileToLngLat(tile.tileID.canonical, position, nodeInfo.node.anchor[0], nodeInfo.node.anchor[1]);

    return {intersectionZ, position, feature: nodeInfo.feature};
}

export default ModelStyleLayer;
