import loadGeometry from './load_geometry';
import toEvaluationFeature from './evaluation_feature';
import EvaluationParameters from '../style/evaluation_parameters';
import EXTENT from '../style-spec/data/extent';
import Grid from 'grid-index';
import DictionaryCoder from '../util/dictionary_coder';
import {VectorTile} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import Feature from '../util/vectortile_to_geojson';
import {arraysIntersect, mapObject, extend, warnOnce} from '../util/util';
import {register} from '../util/web_worker_transfer';
import {polygonIntersectsBox} from '../util/intersection_tests';
import {PossiblyEvaluated} from '../style/properties';
import {FeatureIndexArray} from './array_types';
import {DEMSampler} from '../terrain/elevation';
import Tiled3dModelBucket from '../../3d-style/data/bucket/tiled_3d_model_bucket';
import {loadMatchingModelFeature} from '../../3d-style/style/style_layer/model_style_layer';
import {createExpression} from '../style-spec/expression/index';
import EvaluationContext from '../style-spec/expression/evaluation_context';

import type {OverscaledTileID} from '../source/tile_id';
import type Point from '@mapbox/point-geometry';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type {QrfQuery, QrfTarget, QueryResult} from '../source/query_features';
import type Transform from '../geo/transform';
import type {PromoteIdSpecification, LayerSpecification} from '../style-spec/types';
import type {TilespaceQueryGeometry} from '../style/query_geometry';
import type {FeatureIndex as FeatureIndexStruct} from './array_types';
import type {TileTransform} from '../geo/projection/tile_transform';
import type {VectorTileLayer, VectorTileFeature} from '@mapbox/vector-tile';
import type {GridIndex} from '../types/grid-index';
import type {FeatureState, StyleExpression} from '../style-spec/expression/index';
import type {FeatureVariant} from '../util/vectortile_to_geojson';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {PossiblyEvaluatedPropertyValue} from '../style/properties';

type QueryParameters = {
    pixelPosMatrix: Float32Array;
    transform: Transform;
    tilespaceGeometry: TilespaceQueryGeometry;
    tileTransform: TileTransform;
    availableImages: ImageId[];
    worldview: string | undefined;
};

type FeatureIndices = FeatureIndexStruct | {
    bucketIndex: number;
    sourceLayerIndex: number;
    featureIndex: number;
    layoutVertexArrayOffset: number;
};

type IntersectionTest = (feature: VectorTileFeature, styleLayer: TypedStyleLayer, featureState: FeatureState, layoutVertexArrayOffset: number) => boolean | number;

class FeatureIndex {
    tileID: OverscaledTileID;
    x: number;
    y: number;
    z: number;
    grid: GridIndex;
    featureIndexArray: FeatureIndexArray;
    promoteId?: PromoteIdSpecification;
    promoteIdExpression?: StyleExpression;

    rawTileData: ArrayBuffer;
    bucketLayerIDs: Array<Array<string>>;

    vtLayers: Record<string, VectorTileLayer>;
    vtFeatures: Record<string, VectorTileFeature[]>;
    sourceLayerCoder: DictionaryCoder;
    is3DTile: boolean; // 3D tile has no vector source layers
    serializedLayersCache: Map<string, LayerSpecification>;

    constructor(tileID: OverscaledTileID, promoteId?: PromoteIdSpecification | null) {
        this.tileID = tileID;
        this.x = tileID.canonical.x;
        this.y = tileID.canonical.y;
        this.z = tileID.canonical.z;
        this.grid = new Grid(EXTENT, 16, 0);
        this.featureIndexArray = new FeatureIndexArray();
        this.promoteId = promoteId;
        this.is3DTile = false;
        this.serializedLayersCache = new Map();
    }

    insert(feature: VectorTileFeature, geometry: Array<Array<Point>>, featureIndex: number, sourceLayerIndex: number, bucketIndex: number, layoutVertexArrayOffset: number = 0, envelopePadding: number = 0) {
        const key = this.featureIndexArray.length;
        this.featureIndexArray.emplaceBack(featureIndex, sourceLayerIndex, bucketIndex, layoutVertexArrayOffset);

        const grid = this.grid;

        for (let r = 0; r < geometry.length; r++) {
            const ring = geometry[r];

            const bbox = [Infinity, Infinity, -Infinity, -Infinity];
            for (let i = 0; i < ring.length; i++) {
                const p = ring[i];
                bbox[0] = Math.min(bbox[0], p.x);
                bbox[1] = Math.min(bbox[1], p.y);
                bbox[2] = Math.max(bbox[2], p.x);
                bbox[3] = Math.max(bbox[3], p.y);
            }

            if (envelopePadding !== 0) {
                bbox[0] -= envelopePadding;
                bbox[1] -= envelopePadding;
                bbox[2] += envelopePadding;
                bbox[3] += envelopePadding;
            }

            if (bbox[0] < EXTENT &&
                bbox[1] < EXTENT &&
                bbox[2] >= 0 &&
                bbox[3] >= 0) {
                grid.insert(key, bbox[0], bbox[1], bbox[2], bbox[3]);
            }
        }
    }

    loadVTLayers(): Record<string, VectorTileLayer> {
        if (!this.vtLayers) {
            this.vtLayers = new VectorTile(new Protobuf(this.rawTileData)).layers;
            this.sourceLayerCoder = new DictionaryCoder(this.vtLayers ? Object.keys(this.vtLayers).sort() : ['_geojsonTileLayer']);
            this.vtFeatures = {};
            for (const layer in this.vtLayers) {
                this.vtFeatures[layer] = [];
            }
        }
        return this.vtLayers;
    }

    // Finds non-symbol features in this tile at a particular position.
    query(query: QrfQuery, params: QueryParameters): QueryResult {
        const {tilespaceGeometry, transform, tileTransform, pixelPosMatrix, availableImages, worldview} = params;

        this.loadVTLayers();
        this.serializedLayersCache.clear();

        const bounds = tilespaceGeometry.bufferedTilespaceBounds;
        const queryPredicate = (bx1: number, by1: number, bx2: number, by2: number) => {
            return polygonIntersectsBox(tilespaceGeometry.bufferedTilespaceGeometry, bx1, by1, bx2, by2);
        };

        const matching = this.grid.query(bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y, queryPredicate);
        matching.sort(topDownFeatureComparator);

        let elevationHelper = null;
        if (transform.elevation && matching.length > 0) {
            elevationHelper = DEMSampler.create(transform.elevation, this.tileID);
        }

        const result: QueryResult = {};
        let previousIndex;
        for (let k = 0; k < matching.length; k++) {
            const index = matching[k];

            // don't check the same feature more than once
            if (index === previousIndex) continue;
            previousIndex = index;

            const match = this.featureIndexArray.get(index);
            let featureGeometry = null;

            if (this.is3DTile) {
                this.loadMatchingModelFeature(result, match, query, tilespaceGeometry, transform, worldview);
                continue;
            }

            const intersectionTest = (feature: VectorTileFeature, styleLayer: TypedStyleLayer, featureState: FeatureState, layoutVertexArrayOffset: number = 0) => {
                if (!featureGeometry) {
                    featureGeometry = loadGeometry(feature, this.tileID.canonical, tileTransform);
                }

                return styleLayer.queryIntersectsFeature(tilespaceGeometry, feature, featureState, featureGeometry, this.z, transform, pixelPosMatrix, elevationHelper, layoutVertexArrayOffset);
            };

            this.loadMatchingFeature(
                result,
                match,
                query,
                availableImages,
                worldview,
                intersectionTest
            );
        }

        return result;
    }

    loadMatchingFeature(
        result: QueryResult,
        featureIndexData: FeatureIndices,
        query: QrfQuery,
        availableImages: ImageId[],
        worldview: string | undefined,
        intersectionTest?: IntersectionTest
    ): void {
        const {featureIndex, bucketIndex, sourceLayerIndex, layoutVertexArrayOffset} = featureIndexData;

        const layerIDs = this.bucketLayerIDs[bucketIndex];
        const queryLayers = query.layers;
        const queryLayerIDs = Object.keys(queryLayers);
        if (queryLayerIDs.length && !arraysIntersect(queryLayerIDs, layerIDs)) {
            return;
        }

        const querySourceCache = query.sourceCache;
        const sourceLayerName = this.sourceLayerCoder.decode(sourceLayerIndex);
        const sourceLayer = this.vtLayers[sourceLayerName];
        const feature = sourceLayer.feature(featureIndex);

        const id = this.getId(feature, sourceLayerName);
        for (let l = 0; l < layerIDs.length; l++) {
            const layerId = layerIDs[l];

            if (!queryLayers[layerId]) continue;
            const {styleLayer, targets} = queryLayers[layerId];

            let featureState: FeatureState = {};
            if (id !== undefined) {
                // `feature-state` expression evaluation requires feature state to be available
                featureState = querySourceCache.getFeatureState(styleLayer.sourceLayer, id);
            }

            const intersectionZ = (!intersectionTest || intersectionTest(feature, styleLayer, featureState, layoutVertexArrayOffset)) as number;
            if (!intersectionZ) {
                // Only applied for non-symbol features
                continue;
            }

            const geojsonFeature = new Feature(feature, this.z, this.x, this.y, id);
            geojsonFeature.tile = this.tileID.canonical;
            geojsonFeature.state = featureState;

            let serializedLayer = this.serializedLayersCache.get(layerId);
            if (!serializedLayer) {
                serializedLayer = styleLayer.serialize();
                serializedLayer.id = layerId;
                this.serializedLayersCache.set(layerId, serializedLayer);
            }

            geojsonFeature.source = serializedLayer.source;
            geojsonFeature.sourceLayer = serializedLayer['source-layer'];

            geojsonFeature.layer = extend({}, serializedLayer);
            geojsonFeature.layer.paint = evaluateProperties(serializedLayer.paint, styleLayer.paint, feature, featureState, availableImages);
            geojsonFeature.layer.layout = evaluateProperties(serializedLayer.layout, styleLayer.layout, feature, featureState, availableImages);

            // Iterate over all targets to check if the feature should be included and add feature variants if necessary
            let shouldInclude = false;
            for (const target of targets) {
                this.updateFeatureProperties(geojsonFeature, target);
                const {filter} = target;
                if (filter) {
                    feature.properties = geojsonFeature.properties;
                    if (filter.needGeometry) {
                        const evaluationFeature = toEvaluationFeature(feature, true);
                        if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ, {worldview}), evaluationFeature, this.tileID.canonical)) {
                            continue;
                        }
                    } else if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ, {worldview}), feature)) {
                        continue;
                    }
                }

                // Feature passes at least one target filter
                shouldInclude = true;

                // If the target has associated interaction id, add a feature variant for it
                if (target.targetId) {
                    this.addFeatureVariant(geojsonFeature, target);
                }
            }

            if (shouldInclude) {
                this.appendToResult(result, layerId, featureIndex, geojsonFeature, intersectionZ);
            }
        }
    }

    loadMatchingModelFeature(
        result: QueryResult,
        featureIndexData: FeatureIndices,
        query: QrfQuery,
        tilespaceGeometry: TilespaceQueryGeometry,
        transform: Transform,
        worldview: string | undefined,
    ): void {
        // 3D tile is a single bucket tile.
        const layerId = this.bucketLayerIDs[0][0];
        const queryLayers = query.layers;
        if (!queryLayers[layerId]) return;

        const {styleLayer, targets} = queryLayers[layerId];
        if (styleLayer.type !== 'model') return;

        const tile = tilespaceGeometry.tile;
        const featureIndex = featureIndexData.featureIndex;

        const bucket = tile.getBucket(styleLayer);
        if (!bucket || !(bucket instanceof Tiled3dModelBucket)) return;

        const model = loadMatchingModelFeature(bucket, featureIndex, tilespaceGeometry, transform);
        if (!model) return;

        const {z, x, y} = tile.tileID.canonical;
        const {feature, intersectionZ, position} = model;

        let featureState: FeatureState = {};
        if (feature.id !== undefined) {
            featureState = query.sourceCache.getFeatureState(styleLayer.sourceLayer, feature.id);
        }

        const geojsonFeature = new Feature({} as unknown as VectorTileFeature, z, x, y, feature.id);
        geojsonFeature.tile = this.tileID.canonical;
        geojsonFeature.state = featureState;

        geojsonFeature.properties = feature.properties;
        geojsonFeature.geometry = {type: 'Point', coordinates: [position.lng, position.lat]};

        let serializedLayer = this.serializedLayersCache.get(layerId);
        if (!serializedLayer) {
            serializedLayer = styleLayer.serialize();
            serializedLayer.id = layerId;
            this.serializedLayersCache.set(layerId, serializedLayer);
        }

        geojsonFeature.source = serializedLayer.source;
        geojsonFeature.sourceLayer = serializedLayer['source-layer'];

        geojsonFeature.layer = extend({}, serializedLayer);

        // Iterate over all targets to check if the feature should be included and add feature variants if necessary
        let shouldInclude = false;
        for (const target of targets) {
            this.updateFeatureProperties(geojsonFeature, target);
            const {filter} = target;
            if (filter) {
                feature.properties = geojsonFeature.properties;
                if (filter.needGeometry) {
                    if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ, {worldview}), feature, this.tileID.canonical)) {
                        continue;
                    }
                } else if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ, {worldview}), feature)) {
                    continue;
                }
            }

            // Feature passes at least one target filter
            shouldInclude = true;

            // If the target has associated interaction id, add a feature variant for it
            if (target.targetId) {
                this.addFeatureVariant(geojsonFeature, target);
            }
        }

        if (shouldInclude) {
            this.appendToResult(result, layerId, featureIndex, geojsonFeature, intersectionZ);
        }
    }

    updateFeatureProperties(feature: Feature, target: QrfTarget, availableImages?: ImageId[]) {
        if (target.properties) {
            const transformedProperties = {};
            for (const name in target.properties) {
                const expression = target.properties[name];
                const value = expression.evaluate(
                    {zoom: this.z},
                    feature._vectorTileFeature,
                    feature.state,
                    feature.tile,
                    availableImages
                );
                if (value != null) transformedProperties[name] = value;
            }
            feature.properties = transformedProperties;
        }
    }

    /**
     * Create a feature variant for a query target and add it to the original feature.
     *
     * @param {Feature} feature The original feature.
     * @param {QrfTarget} target The target to derive the feature for.
     * @returns {Feature} The derived feature.
     */
    addFeatureVariant(feature: Feature, target: QrfTarget, availableImages?: ImageId[]) {
        const variant: FeatureVariant = {
            target: target.target,
            namespace: target.namespace,
            uniqueFeatureID: target.uniqueFeatureID,
        };

        if (target.properties) {
            variant.properties = feature.properties;
        }

        feature.variants = feature.variants || {};
        feature.variants[target.targetId] = feature.variants[target.targetId] || [];
        feature.variants[target.targetId].push(variant);
    }

    appendToResult(result: QueryResult, layerID: string, featureIndex: number, geojsonFeature: Feature, intersectionZ?: number) {
        let layerResult = result[layerID];
        if (layerResult === undefined) {
            layerResult = result[layerID] = [];
        }

        layerResult.push({featureIndex, feature: geojsonFeature, intersectionZ});
    }

    // Given a set of symbol indexes that have already been looked up,
    // return a matching set of GeoJSONFeatures
    lookupSymbolFeatures(
        symbolFeatureIndexes: Array<number>,
        bucketIndex: number,
        sourceLayerIndex: number,
        query: QrfQuery,
        availableImages: ImageId[],
        worldview: string | undefined
    ): QueryResult {
        const result: QueryResult = {};
        this.loadVTLayers();

        for (const symbolFeatureIndex of symbolFeatureIndexes) {
            const featureIndexData = {bucketIndex, sourceLayerIndex, featureIndex: symbolFeatureIndex, layoutVertexArrayOffset: 0};
            this.loadMatchingFeature(result, featureIndexData, query, availableImages, worldview);
        }

        return result;
    }

    loadFeature(featureIndexData: FeatureIndices): VectorTileFeature {
        const {featureIndex, sourceLayerIndex} = featureIndexData;

        this.loadVTLayers();
        const sourceLayerName = this.sourceLayerCoder.decode(sourceLayerIndex);

        const featureCache = this.vtFeatures[sourceLayerName];
        if (featureCache[featureIndex]) {
            return featureCache[featureIndex];
        }
        const sourceLayer = this.vtLayers[sourceLayerName];
        const feature = sourceLayer.feature(featureIndex);
        featureCache[featureIndex] = feature;

        return feature;
    }

    hasLayer(id: string): boolean {
        for (const layerIDs of this.bucketLayerIDs) {
            for (const layerID of layerIDs) {
                if (id === layerID) return true;
            }
        }

        return false;
    }

    getId(feature: VectorTileFeature, sourceLayerId: string): string | number {
        let id: string | number = feature.id;
        if (this.promoteId) {
            const propName = !Array.isArray(this.promoteId) && typeof this.promoteId === 'object' ? this.promoteId[sourceLayerId] : this.promoteId;
            if (propName != null) {
                if (Array.isArray(propName)) {
                    if (!this.promoteIdExpression) {
                        const expression = createExpression(propName);
                        if (expression.result === 'success') {
                            this.promoteIdExpression = expression.value;
                        } else {
                            const error = expression.value.map(err => `${err.key}: ${err.message}`).join(', ');
                            warnOnce(`Failed to create expression for promoteId: ${error}`);
                            return undefined;
                        }
                    }
                    // _evaluator is explicitly omitted from serialization here https://github.com/mapbox/mapbox-gl-js-internal/blob/internal/src/util/web_worker_transfer.ts#L112
                    // and promoteIdExpression is first created in worker thread and will later be used in main thread, so a reinitialize will be needed.
                    if (!this.promoteIdExpression._evaluator) {
                        this.promoteIdExpression._evaluator = new EvaluationContext();
                    }
                    id = this.promoteIdExpression.evaluate({zoom: 0}, feature) as string | number;
                } else {
                    id = feature.properties[propName] as string | number;
                }
            }
            if (typeof id === 'boolean') id = Number(id);
        }
        return id;
    }
}

register(FeatureIndex, 'FeatureIndex', {omit: ['rawTileData', 'sourceLayerCoder']});

export default FeatureIndex;

function evaluateProperties(serializedProperties: Record<PropertyKey, unknown>, styleLayerProperties: unknown, feature: VectorTileFeature, featureState: FeatureState, availableImages: ImageId[]) {
    return mapObject(serializedProperties, (_, key) => {
        const prop = styleLayerProperties instanceof PossiblyEvaluated ?
            styleLayerProperties.get(key) as PossiblyEvaluatedPropertyValue<unknown> :
            null;

        return prop && prop.evaluate ? prop.evaluate(feature, featureState, undefined, availableImages) : prop;
    });
}

function topDownFeatureComparator(a: number, b: number) {
    return b - a;
}
