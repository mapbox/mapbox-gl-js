import assert from 'assert';
import {mat4} from 'gl-matrix';
import {isFQID} from '../util/fqid';

import type Point from '@mapbox/point-geometry';
import type SourceCache from './source_cache';
import type StyleLayer from '../style/style_layer';
import type CollisionIndex from '../symbol/collision_index';
import type Transform from '../geo/transform';
import type Feature from '../util/vectortile_to_geojson';
import type {OverscaledTileID} from './tile_id';
import type {RetainedQueryData} from '../symbol/placement';
import type {QueryGeometry, TilespaceQueryGeometry} from '../style/query_geometry';
import type {FilterSpecification} from '../style-spec/types';

export type QueryResult = {
    [_: string]: Array<{
        featureIndex: number;
        feature: Feature;
        intersectionZ: number;
    }>;
};

export type RenderedFeatureLayers = Array<{
    wrappedTileID: number;
    queryResults: QueryResult;
}>;

/*
 * Returns a matrix that can be used to convert from tile coordinates to viewport pixel coordinates.
 */
function getPixelPosMatrix(transform: Transform, tileID: OverscaledTileID) {
    const t = mat4.identity([] as any);
    mat4.scale(t, t, [transform.width * 0.5, -transform.height * 0.5, 1]);
    mat4.translate(t, t, [1, -1, 0]);
    mat4.multiply(t, t, transform.calculateProjMatrix(tileID.toUnwrapped()));
    return Float32Array.from(t);
}

export function queryRenderedFeatures(
    sourceCache: SourceCache,
    styleLayers: Record<string, StyleLayer>,
    queryGeometry: QueryGeometry,
    filter: FilterSpecification,
    layers: string[],
    availableImages: Array<string>,
    transform: Transform,
    use3DQuery: boolean,
    visualizeQueryGeometry: boolean = false,
): QueryResult {
    const tileResults = sourceCache.tilesIn(queryGeometry, use3DQuery, visualizeQueryGeometry);
    tileResults.sort(sortTilesIn);
    const renderedFeatureLayers: RenderedFeatureLayers = [];
    for (const tileResult of tileResults) {
        renderedFeatureLayers.push({
            wrappedTileID: tileResult.tile.tileID.wrapped().key,
            queryResults: tileResult.tile.queryRenderedFeatures(
                styleLayers,
                sourceCache._state,
                tileResult,
                filter,
                layers,
                availableImages,
                transform,
                getPixelPosMatrix(sourceCache.transform, tileResult.tile.tileID),
                visualizeQueryGeometry)
        });
    }

    const result = mergeRenderedFeatureLayers(renderedFeatureLayers);

    // Merge state from SourceCache into the results
    for (const layerID in result) {
        result[layerID].forEach((featureWrapper) => {
            const feature = featureWrapper.feature;
            const layer = feature.layer;

            if (!layer || layer.type === 'background' || layer.type === 'sky' || layer.type === 'slot') return;

            if (!isFQID(layerID)) {
                feature.source = layer.source;
                if (layer['source-layer']) {
                    feature.sourceLayer = layer['source-layer'];
                }
            }
            feature.state = feature.id !== undefined ? sourceCache.getFeatureState(layer['source-layer'], feature.id) : {};
        });
    }
    return result;
}

export function queryRenderedSymbols(
    styleLayers: {
        [_: string]: StyleLayer;
    },
    getLayerSourceCache: (layer: StyleLayer) => SourceCache | void,
    queryGeometry: Array<Point>,
    filter: FilterSpecification,
    layers: string[],
    availableImages: Array<string>,
    collisionIndex: CollisionIndex,
    retainedQueryData: {
        [_: number]: RetainedQueryData;
    },
): QueryResult {
    const result: Record<string, any> = {};
    const renderedSymbols = collisionIndex.queryRenderedSymbols(queryGeometry);
    const bucketQueryData = [];
    for (const bucketInstanceId of Object.keys(renderedSymbols).map(Number)) {
        bucketQueryData.push(retainedQueryData[bucketInstanceId]);
    }
    bucketQueryData.sort(sortTilesIn);

    for (const queryData of bucketQueryData) {
        const bucketSymbols = queryData.featureIndex.lookupSymbolFeatures(
                renderedSymbols[queryData.bucketInstanceId],
                queryData.bucketIndex,
                queryData.sourceLayerIndex,
                filter,
                layers,
                availableImages,
                styleLayers);

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

    // Merge state from SourceCache into the results
    for (const layerName in result) {
        result[layerName].forEach((featureWrapper) => {
            const feature = featureWrapper.feature;
            const layer = styleLayers[layerName];
            const sourceCache = getLayerSourceCache(layer);
            if (!sourceCache) return;

            const state = sourceCache.getFeatureState(feature.layer['source-layer'], feature.id);
            feature.state = state;

            if (!isFQID(layer.id)) {
                feature.source = feature.layer.source;
                if (feature.layer['source-layer']) {
                    feature.sourceLayer = feature.layer['source-layer'];
                }
            }
        });
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
    const wrappedIDLayerMap: Record<string, any> = {};
    for (const tile of tiles) {
        const queryResults = tile.queryResults;
        const wrappedID = tile.wrappedTileID;
        const wrappedIDLayers = wrappedIDLayerMap[wrappedID] = wrappedIDLayerMap[wrappedID] || {};
        for (const layerID in queryResults) {
            const tileFeatures = queryResults[layerID];
            const wrappedIDFeatures = wrappedIDLayers[layerID] = wrappedIDLayers[layerID] || {};
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
