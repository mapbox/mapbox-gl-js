// @flow

const Point = require('@mapbox/point-geometry');
const EXTENT = require('../data/extent');

import type SourceCache from './source_cache';
import type StyleLayer from '../style/style_layer';
import type Coordinate from '../geo/coordinate';
import type CollisionIndex from '../symbol/collision_index';
import type {OverscaledTileID} from './tile_id';

exports.rendered = function(sourceCache: SourceCache,
                            styleLayers: {[string]: StyleLayer},
                            queryGeometry: Array<Coordinate>,
                            params: { filter: FilterSpecification, layers: Array<string> },
                            zoom: number,
                            bearing: number,
                            collisionIndex: CollisionIndex) {

    const tiles = [];
    const ids = sourceCache.getIds();

    for (const id of ids) {
        const tile = sourceCache.getTileByID(id);
        const tileID = tile.tileID;

        const tileSpaceQueryGeometry = [];
        for (let j = 0; j < queryGeometry.length; j++) {
            tileSpaceQueryGeometry.push(coordinateToTilePoint(tileID, queryGeometry[j]));
        }

        tiles.push({
            tile: tile,
            tileID: tileID,
            queryGeometry: [tileSpaceQueryGeometry],
            scale: Math.pow(2, zoom - tile.tileID.overscaledZ)
        });
    }

    tiles.sort(sortTiles);

    const renderedFeatureLayers = [];
    for (const tile of tiles) {
        renderedFeatureLayers.push({
            wrappedTileID: tile.tileID.wrapped().key,
            queryResults: tile.tile.queryRenderedFeatures(
                styleLayers,
                tile.queryGeometry,
                tile.scale,
                params,
                bearing,
                sourceCache.id,
                collisionIndex)
        });
    }

    return mergeRenderedFeatureLayers(renderedFeatureLayers);
};

exports.source = function(sourceCache: SourceCache, params: any) {
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
};

/**
 *  * Convert a coordinate to a point in a tile's coordinate space.
 *   * @private
 *    */
function coordinateToTilePoint(tileID: OverscaledTileID, coord: Coordinate): Point {
    const zoomedCoord = coord.zoomTo(tileID.canonical.z);
    return new Point(
            (zoomedCoord.column - (tileID.canonical.x + tileID.wrap * Math.pow(2, tileID.canonical.z))) * EXTENT,
            (zoomedCoord.row - tileID.canonical.y) * EXTENT
    );
}

function sortTiles(a, b) {
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
                    resultFeatures.push(tileFeature.feature);
                }
            }
        }
    }
    return result;
}
