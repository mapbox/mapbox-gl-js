import assert from 'assert';

import type Point from '@mapbox/point-geometry';
import type SourceCache from './source_cache';
import type StyleLayer from '../style/style_layer';
import type CollisionIndex from '../symbol/collision_index';
import type Transform from '../geo/transform';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {default as Feature, TargetDescriptor, FeatureVariant} from '../util/vectortile_to_geojson';
import type {FeatureFilter} from '../style-spec/feature_filter/index';
import type {RetainedQueryData} from '../symbol/placement';
import type {QueryGeometry, TilespaceQueryGeometry} from '../style/query_geometry';
import type {StyleExpression} from '../style-spec/expression/index';
import type {FilterSpecification} from '../style-spec/types';

/**
 * Internal type that represents a QRF query.
 */
export type QrfQuery = {
    layers: QrfLayers;
    sourceCache: SourceCache;
};

/**
 * List of layers with their query targets grouped by layer ID.
 */
export type QrfLayers = Record<string, QrfLayer>;

export type QrfLayer = {
    targets?: QrfTarget[];
    styleLayer: StyleLayer;
};

export type QrfTarget = {
    targetId?: string;
    target?: TargetDescriptor;
    namespace?: string;
    properties?: Record<string, StyleExpression>;
    filter?: FeatureFilter;
    uniqueFeatureID?: boolean;
};

export type QueryResult = {
    [layerId: string]: Array<{
        featureIndex: number;
        feature: Feature;
        intersectionZ: number;
    }>;
};

export type RenderedFeatureLayers = Array<{
    wrappedTileID: number;
    queryResults: QueryResult;
}>;

function generateTargetKey(target: TargetDescriptor): string {
    if ("layerId" in target) {
        // Handle the case where target is { layerId: string }
        return `layer:${target.layerId}`;
    } else {
        // Handle the case where target is FeaturesetDescriptor
        const {featuresetId, importId} = target;
        return `featureset:${featuresetId}${importId ? `:import:${importId}` : ""}`;
    }
}

export function getFeatureTargetKey(variant: FeatureVariant, feature: Feature, targetId: string = ''): string {
    return `${targetId}:${feature.id || ''}:${feature.layer.id}:${generateTargetKey(variant.target)}`;
}

export function shouldSkipFeatureVariant(variant: FeatureVariant, feature: Feature, uniqueFeatureSet: Set<string>, targetId: string = ''): boolean {
    if (variant.uniqueFeatureID) {
        const key = getFeatureTargetKey(variant, feature, targetId);
        // skip the feature that has the same featureID in the same interaction with uniqueFeatureID turned on
        if (uniqueFeatureSet.has(key)) {
            return true;
        }
        // Add the key to the map
        uniqueFeatureSet.add(key);
    }
    return false;
}

export function queryRenderedFeatures(
    queryGeometry: QueryGeometry,
    query: QrfQuery & {has3DLayers?: boolean},
    availableImages: ImageId[],
    transform: Transform,
    visualizeQueryGeometry: boolean = false,
): QueryResult {
    const sourceCacheTransform = query.sourceCache.transform;
    const tileResults = query.sourceCache.tilesIn(queryGeometry, query.has3DLayers, visualizeQueryGeometry);
    tileResults.sort(sortTilesIn);

    const renderedFeatureLayers: RenderedFeatureLayers = [];
    for (const tileResult of tileResults) {
        const queryResults = tileResult.tile.queryRenderedFeatures(
            query,
            tileResult,
            availableImages,
            transform,
            sourceCacheTransform,
            visualizeQueryGeometry,
        );

        if (Object.keys(queryResults).length) {
            renderedFeatureLayers.push({wrappedTileID: tileResult.tile.tileID.wrapped().key, queryResults});
        }
    }

    if (renderedFeatureLayers.length === 0) {
        return {};
    }

    return mergeRenderedFeatureLayers(renderedFeatureLayers);
}

export function queryRenderedSymbols(
    queryGeometry: Array<Point>,
    query: QrfQuery,
    availableImages: ImageId[],
    collisionIndex: CollisionIndex,
    retainedQueryData: Record<number, RetainedQueryData>,
): QueryResult {
    const result: QueryResult = {};
    const renderedSymbols = collisionIndex.queryRenderedSymbols(queryGeometry);
    const bucketQueryData: RetainedQueryData[] = [];
    for (const bucketInstanceId of Object.keys(renderedSymbols).map(Number)) {
        bucketQueryData.push(retainedQueryData[bucketInstanceId]);
    }
    bucketQueryData.sort(sortTilesIn);

    for (const queryData of bucketQueryData) {
        const bucketSymbols = queryData.featureIndex.lookupSymbolFeatures(
            renderedSymbols[queryData.bucketInstanceId],
            queryData.bucketIndex,
            queryData.sourceLayerIndex,
            query,
            availableImages
        );

        for (const layerID in bucketSymbols) {
            const resultFeatures = result[layerID] = result[layerID] || [];
            const layerSymbols = bucketSymbols[layerID];
            layerSymbols.sort((a, b) => {
                // Match topDownFeatureComparator from FeatureIndex, but using
                // most recent sorting of features from bucket.sortFeatures
                const featureSortOrder = queryData.featureSortOrder;
                if (featureSortOrder) {
                    // queryRenderedSymbols documentation says we'll return features in
                    // "top-to-bottom" rendering order (aka last-to-first).
                    // Actually there can be multiple symbol instances per feature, so
                    // we sort each feature based on the first matching symbol instance.
                    const sortedA = featureSortOrder.indexOf(a.featureIndex);
                    const sortedB = featureSortOrder.indexOf(b.featureIndex);
                    assert(sortedA >= 0);
                    assert(sortedB >= 0);
                    return sortedB - sortedA;
                } else {
                    // Bucket hasn't been re-sorted based on angle, so use the
                    // reverse of the order the features appeared in the data.
                    return b.featureIndex - a.featureIndex;
                }
            });
            for (const symbolFeature of layerSymbols) {
                resultFeatures.push(symbolFeature);
            }
        }
    }

    return result;
}

export function querySourceFeatures(sourceCache: SourceCache, params?: {
    sourceLayer?: string;
    filter?: FilterSpecification;
    validate?: boolean;
}): Array<Feature> {
    const tiles = sourceCache.getRenderableIds().map((id) => {
        return sourceCache.getTileByID(id);
    });

    const result = [];

    const dataTiles: Record<string, any> = {};
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const dataID = tile.tileID.canonical.key;
        if (!dataTiles[dataID]) {
            dataTiles[dataID] = true;
            tile.querySourceFeatures(result, params);
        }
    }

    return result;
}

function sortTilesIn(a: TilespaceQueryGeometry | RetainedQueryData, b: TilespaceQueryGeometry | RetainedQueryData) {
    const idA = a.tileID;
    const idB = b.tileID;
    return (idA.overscaledZ - idB.overscaledZ) || (idA.canonical.y - idB.canonical.y) || (idA.wrap - idB.wrap) || (idA.canonical.x - idB.canonical.x);
}

function mergeRenderedFeatureLayers(tiles: RenderedFeatureLayers): QueryResult {
    // Merge results from all tiles, but if two tiles share the same
    // wrapped ID, don't duplicate features between the two tiles
    const result: QueryResult = {};
    const wrappedIDLayerMap: Record<string, Record<number, boolean>> = {};
    for (const tile of tiles) {
        const queryResults = tile.queryResults;
        const wrappedID = tile.wrappedTileID;
        const wrappedIDLayers = wrappedIDLayerMap[wrappedID] = wrappedIDLayerMap[wrappedID] || {};
        for (const layerID in queryResults) {
            const tileFeatures = queryResults[layerID];
            const wrappedIDFeatures: Record<number, boolean> = wrappedIDLayers[layerID] = wrappedIDLayers[layerID] || {};
            const resultFeatures = result[layerID] = result[layerID] || [];
            for (const tileFeature of tileFeatures) {
                if (!wrappedIDFeatures[tileFeature.featureIndex]) {
                    wrappedIDFeatures[tileFeature.featureIndex] = true;
                    resultFeatures.push(tileFeature);
                }
            }
        }
    }
    return result;
}
