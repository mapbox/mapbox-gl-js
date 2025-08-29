import StyleLayer from '../../../src/style/style_layer';
import ModelBucket from '../../data/bucket/model_bucket';
import {getLayoutProperties, getPaintProperties} from './model_style_layer_properties';
import {ZoomDependentExpression} from '../../../src/style-spec/expression/index';
import {mat4} from 'gl-matrix';
import LngLat from '../../../src/geo/lng_lat';
import {latFromMercatorY, lngFromMercatorX} from '../../../src/geo/mercator_coordinate';
import EXTENT from '../../../src/style-spec/data/extent';
import {queryGeometryIntersectsProjectedAabb, rotationScaleYZFlipMatrix} from '../../util/model_util';
import Tiled3dModelBucket from '../../data/bucket/tiled_3d_model_bucket';

import type {vec3} from 'gl-matrix';
import type {Transitionable, Transitioning, PossiblyEvaluated, PropertyValue, ConfigOptions} from '../../../src/style/properties';
import type Point from '@mapbox/point-geometry';
import type {LayerSpecification} from '../../../src/style-spec/types';
import type {PaintProps, LayoutProps} from './model_style_layer_properties';
import type {BucketParameters, Bucket} from '../../../src/data/bucket';
import type {TilespaceQueryGeometry} from '../../../src/style/query_geometry';
import type {FeatureState} from '../../../src/style-spec/expression/index';
import type Transform from '../../../src/geo/transform';
import type ModelManager from '../../render/model_manager';
import type {ModelNode} from '../../data/model';
import type {VectorTileFeature} from '@mapbox/vector-tile';
import type {CanonicalTileID} from '../../../src/source/tile_id';
import type {LUT} from "../../../src/util/lut";
import type {EvaluationFeature} from '../../../src/data/evaluation_feature';
import type {ProgramName} from '../../../src/render/program';

class ModelStyleLayer extends StyleLayer {
    override type: 'model';

    override _transitionablePaint: Transitionable<PaintProps>;
    override _transitioningPaint: Transitioning<PaintProps>;
    override paint: PossiblyEvaluated<PaintProps>;
    override layout: PossiblyEvaluated<LayoutProps>;
    modelManager: ModelManager;

    constructor(layer: LayerSpecification, scope: string, lut: LUT | null, options?: ConfigOptions | null) {
        const properties = {
            layout: getLayoutProperties(),
            paint: getPaintProperties()
        };
        super(layer, properties, scope, lut, options);
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

                let minDepth = Number.MAX_VALUE;
                for (let i = 0; i < modelFeature.instancedDataCount; ++i) {
                    const instanceOffset = modelFeature.instancedDataOffset + i;
                    const offset = instanceOffset * 16;

                    const va = instances.instancedDataArray.float32;
                    const translation: vec3 = [va[offset + 4], va[offset + 5], va[offset + 6]];

                    const rawPointX = va[offset];
                    const rawPointY = va[offset + 1];
                    const pointX = rawPointX | 0; // Use bitwise OR to match rendering path
                    const pointY = rawPointY | 0; // point.y stored in integer part

                    // Build model matrix in tile space (0-8192 range)
                    const modelMatrix = mat4.create();
                    mat4.identity(modelMatrix);

                    // Calculate scale based on the zoom level and tile size
                    // At zoom 16, EXTENT (8192) represents about 40 meters (depending on latitude)
                    // Scale the model to match its real-world size
                    const pixelsPerMeter = transform.pixelsPerMeter;
                    const tileWorldSize = transform.worldSize / Math.pow(2, queryGeometry.tile.tileID.canonical.z);

                    // Assume the model is in meters (common for 3D models)
                    // Convert from meters to tile units
                    const metersToPixels = pixelsPerMeter;
                    const pixelsToTileUnits = EXTENT / tileWorldSize;
                    const metersToTileUnits = metersToPixels * pixelsToTileUnits;

                    // Convert translation from meters to appropriate units
                    // X and Y need conversion to tile units, but Z stays in meters
                    const translationInTileUnits: vec3 = [
                        translation[0] * metersToTileUnits,  // Convert X translation to tile units
                        translation[1] * metersToTileUnits,  // Convert Y translation to tile units
                        translation[2]                        // Z stays in meters (no conversion needed)
                    ];

                    // First translate to position within tile
                    mat4.translate(modelMatrix, modelMatrix, [
                        pointX + translationInTileUnits[0],  // X position + X translation in tile units
                        pointY + translationInTileUnits[1],  // Y position + Y translation in tile units
                        translationInTileUnits[2]            // Z translation in meters
                    ]);

                    // For proper rotation, we need consistent units
                    // Apply rotation with the original scale, then apply unit conversion
                    const rotationMatrix = mat4.create();

                    // First apply rotation with uniform scale
                    rotationScaleYZFlipMatrix(rotationMatrix, modelFeature.rotation, modelFeature.scale);

                    // Then apply the unit conversion as a separate scale
                    const unitConversionMatrix = mat4.create();
                    mat4.scale(unitConversionMatrix, unitConversionMatrix, [metersToTileUnits, metersToTileUnits, 1]);

                    // Combine: rotation * unitConversion
                    mat4.multiply(modelMatrix, modelMatrix, unitConversionMatrix);
                    mat4.multiply(modelMatrix, modelMatrix, rotationMatrix);
                    // Get the tile matrix for this specific tile
                    const tileID = queryGeometry.tile.tileID;
                    const posMatrix = transform.calculatePosMatrix(tileID.toUnwrapped(), transform.worldSize);

                    // Combine: tile * model
                    const tileModelMatrix = mat4.multiply([] as unknown as mat4, posMatrix, modelMatrix);

                    // Apply projection
                    const worldViewProjection = mat4.multiply([] as unknown as mat4, transform.projMatrix, tileModelMatrix);
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
}

function tileToLngLat(id: CanonicalTileID, position: LngLat, pointX: number, pointY: number) {
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
        const worldViewProjectionForNode = mat4.multiply([] as unknown as mat4, modelMatrix, n.matrix);
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
