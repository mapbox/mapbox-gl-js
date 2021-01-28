// @flow

import type SourceCache from './source_cache.js';
import type StyleLayer from '../style/style_layer.js';
import type CollisionIndex from '../symbol/collision_index.js';
import type Transform from '../geo/transform.js';
import type {RetainedQueryData} from '../symbol/placement.js';
import type {FilterSpecification} from '../style-spec/types.js';
import type {QueryGeometry} from '../style/query_geometry.js';
import assert from 'assert';
import {mat4} from 'gl-matrix';

/*
 * Returns a matrix that can be used to convert from tile coordinates to viewport pixel coordinates.
 */
function getPixelPosMatrix(transform, tileID) {
    const t = mat4.identity([]);
    mat4.scale(t, t, [transform.width * 0.5, -transform.height * 0.5, 1]);
    mat4.translate(t, t, [1, -1, 0]);
    return mat4.multiply(t, t, transform.calculatePosMatrix(tileID.toUnwrapped()));
}

export function queryRenderedFeatures(sourceCache: SourceCache,
                            styleLayers: {[_: string]: StyleLayer},
                            serializedLayers: {[_: string]: Object},
                            queryGeometry: QueryGeometry,
                            params: { filter: FilterSpecification, layers: Array<string>, availableImages: Array<string> },
                            transform: Transform,
                            use3DQuery: boolean,
                            visualizeQueryGeometry: boolean = false) {
    const tileResults = sourceCache.tilesIn(queryGeometry, use3DQuery, visualizeQueryGeometry);
    tileResults.sort(sortTilesIn);
    const renderedFeatureLayers = [];
    for (const tileResult of tileResults) {
        renderedFeatureLayers.push({
            wrappedTileID: tileResult.tile.tileID.wrapped().key,
            queryResults: tileResult.tile.queryRenderedFeatures(
                styleLayers,
                serializedLayers,
                sourceCache._state,
                tileResult,
                params,
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
            const state = sourceCache.getFeatureState(feature.layer['source-layer'], feature.id);
            feature.source = feature.layer.source;
            if (feature.layer['source-layer']) {
                feature.sourceLayer = feature.layer['source-layer'];
            }
            feature.state = state;
        });
    }
    return result;
}

export function queryRenderedSymbols(styleLayers: {[_: string]: StyleLayer},
                            serializedLayers: {[_: string]: StyleLayer},
                            getLayerSourceCache: (layer: StyleLayer) => SourceCache,
                            queryGeometry: Array<Point>,
                            params: { filter: FilterSpecification, layers: Array<string>, availableImages: Array<string> },
                            collisionIndex: CollisionIndex,
                            retainedQueryData: {[_: number]: RetainedQueryData}) {
    const result = {};
    const renderedSymbols = collisionIndex.queryRenderedSymbols(queryGeometry);
    const bucketQueryData = [];
    for (const bucketInstanceId of Object.keys(renderedSymbols).map(Number)) {
        bucketQueryData.push(retainedQueryData[bucketInstanceId]);
    }
    bucketQueryData.sort(sortTilesIn);

    for (const queryData of bucketQueryData) {
        const bucketSymbols = queryData.featureIndex.lookupSymbolFeatures(
                renderedSymbols[queryData.bucketInstanceId],
                serializedLayers,
                queryData.bucketIndex,
                queryData.sourceLayerIndex,
                params.filter,
                params.layers,
                params.availableImages,
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
            const state = sourceCache.getFeatureState(feature.layer['source-layer'], feature.id);
            feature.source = feature.layer.source;
            if (feature.layer['source-layer']) {
                feature.sourceLayer = feature.layer['source-layer'];
            }
            feature.state = state;
        });
    }
    return result;
}

export function querySourceFeatures(sourceCache: SourceCache, params: any) {
    const tiles = sourceCache.getRenderableIds().map((id) => {
        return sourceCache.getTileByID(id);
    });

    const result = [];

    const dataTiles = {};
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

function sortTilesIn(a, b) {
    const idA = a.tileID;
    const idB = b.tileID;
    return (idA.overscaledZ - idB.overscaledZ) || (idA.canonical.y - idB.canonical.y) || (idA.wrap - idB.wrap) || (idA.canonical.x - idB.canonical.x);
}

function mergeRenderedFeatureLayers(tiles) {
    // Merge results from all tiles, but if two tiles share the same
    // wrapped ID, don't duplicate features between the two tiles
    const result = {};
    const wrappedIDLayerMap = {};
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
