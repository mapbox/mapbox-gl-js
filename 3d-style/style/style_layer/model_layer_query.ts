import {mat4} from 'gl-matrix';
import {calculateModelMatrix} from '../../data/model';
import LngLat from '../../../src/geo/lng_lat';
import {latFromMercatorY, lngFromMercatorX} from '../../../src/geo/mercator_coordinate';
import EXTENT from '../../../src/style-spec/data/extent';
import {convertModelMatrixForGlobe, queryGeometryIntersectsProjectedAabb} from '../../util/model_util';
import Feature from '../../../src/util/vectortile_to_geojson';
import ModelBucket from '../../data/bucket/model_bucket';

import type ModelSource from '../../source/model_source';
import type Tiled3dModelBucket from '../../data/bucket/tiled_3d_model_bucket';
import type ModelStyleLayer from './model_style_layer';
import type Transform from '../../../src/geo/transform';
import type SourceCache from '../../../src/source/source_cache';
import type {QueryGeometry, TilespaceQueryGeometry} from '../../../src/style/query_geometry';
import type {QueryResult} from '../../../src/source/query_features';
import type {Feature as ExpressionEvalFeature, FeatureState} from '../../../src/style-spec/expression/index';
import type {EvaluationFeature} from '../../../src/data/evaluation_feature';
import type {ModelNode} from '../../data/model';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {CanonicalTileID} from '../../../src/source/tile_id';

export function tileToLngLat(id: CanonicalTileID, position: LngLat, pointX: number, pointY: number) {
    const tileCount = 1 << id.z;
    position.lat = latFromMercatorY((pointY / EXTENT + id.y) / tileCount);
    position.lng = lngFromMercatorX((pointX / EXTENT + id.x) / tileCount);
}

export function queryModelLayerRendered(
    layer: ModelStyleLayer,
    queryGeometry: QueryGeometry,
    sourceCache: SourceCache,
    transform: Transform
): QueryResult {
    const source = sourceCache.getSource<ModelSource>();
    if (!source || source.type !== 'model') return {};
    const modelSource = source;

    const result: QueryResult = {};
    result[layer.id] = [];
    const layerResult = result[layer.id];

    let modelFeatureIndex = 0;
    for (const model of modelSource.models) {
        const modelFeatureState = sourceCache.getFeatureState(layer.sourceLayer, model.id);

        const modelFeatureForEval: ExpressionEvalFeature = {
            type: 'Unknown',
            id: model.id,
            properties: model.featureProperties
        };
        const rotation = layer.paint.get('model-rotation').evaluate(modelFeatureForEval, modelFeatureState);
        const scale = layer.paint.get('model-scale').evaluate(modelFeatureForEval, modelFeatureState);
        const translation = layer.paint.get('model-translation').evaluate(modelFeatureForEval, modelFeatureState);
        const elevationReference = layer.paint.get('model-elevation-reference');
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
            modelFeature.layer = layer.layer;
            // Use unsafe assignment for now, due to restriction of GeoJSON/Feature properties to number, string and boolean.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
            modelFeature.properties = structuredClone(model.featureProperties) as any;
            modelFeature.properties['layer'] = layer.id;
            modelFeature.properties['uri'] = model.uri;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
            modelFeature.properties['orientation'] = model.orientation as any;
            modelFeature.sourceLayer = layer.sourceLayer;
            modelFeature.geometry = {
                type: 'Point',
                coordinates: [model.position.lng, model.position.lat]
            };
            modelFeature.state = modelFeatureState;
            modelFeature.source = layer.source;
            layerResult.push({featureIndex: modelFeatureIndex, feature: modelFeature, intersectionZ: depth});
        }

        ++modelFeatureIndex;
    }

    return result;
}

export function queryModelLayerIntersectsFeature(
    layer: ModelStyleLayer,
    queryGeometry: TilespaceQueryGeometry,
    feature: VectorTileFeature,
    featureState: FeatureState,
    transform: Transform,
    scope: string | undefined
): number | boolean {
    if (!layer.modelManager) return false;
    const modelManager = layer.modelManager;
    const bucket = queryGeometry.tile.getBucket(layer);
    if (!bucket || !(bucket instanceof ModelBucket)) return false;

    for (const modelId in bucket.instancesPerModel) {
        const instances = bucket.instancesPerModel[modelId];
        const featureId = feature.id !== undefined ? feature.id :
            (feature.properties && Object.hasOwn(feature.properties, "id")) ? (feature.properties["id"] as string | number) : undefined;
        if (Object.hasOwn(instances.idToFeaturesIndex, featureId)) {
            const modelFeature = instances.features[instances.idToFeaturesIndex[featureId]];
            const model = modelManager.getModel(modelId, scope || layer.scope);
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

export function loadMatchingModelFeature(bucket: Tiled3dModelBucket, featureIndex: number, tilespaceGeometry: TilespaceQueryGeometry, transform: Transform): {feature: EvaluationFeature, intersectionZ: number, position: LngLat} | undefined {
    const nodeInfo = bucket.getNodesInfo()[featureIndex];

    if (!nodeInfo || nodeInfo.hiddenByReplacement || !nodeInfo.node.meshes) return;

    let intersectionZ = Number.MAX_VALUE;

    // AABB check
    const node = nodeInfo.node;
    const tile = tilespaceGeometry.tile;
    const tileMatrix = transform.calculatePosMatrix(tile.tileID.toUnwrapped());
    const scale = nodeInfo.evaluatedScale;
    let elevation = 0;
    if (transform.elevation && node.elevation) {
        elevation = node.elevation * transform.elevation.exaggeration();
    }
    const anchorX = node.anchor ? node.anchor[0] : 0;
    const anchorY = node.anchor ? node.anchor[1] : 0;

    const modelMatrix = mat4.translate(new Float64Array(16), tileMatrix, [anchorX * (scale[0] - 1), anchorY * (scale[1] - 1), elevation]);
    mat4.scale(modelMatrix, modelMatrix, scale);

    // Collision checks are performed in screen space. Corners are in ndc space.
    const screenQuery = tilespaceGeometry.queryGeometry;
    const projectedQueryGeometry = screenQuery.isPointQuery() ? screenQuery.screenBounds : screenQuery.screenGeometry;

    const checkNode = function (n: ModelNode) {
        const worldViewProjectionForNode = mat4.multiply([], modelMatrix, n.globalMatrix);
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
