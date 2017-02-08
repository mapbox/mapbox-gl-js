'use strict';
const TileCoord = require('./tile_coord');

exports.rendered = function(sourceCache, styleLayers, queryGeometry, params, zoom, bearing) {
    const tilesIn = sourceCache.tilesIn(queryGeometry);

    tilesIn.sort(sortTilesIn);

    const renderedFeatureLayers = [];
    for (let r = 0; r < tilesIn.length; r++) {
        const tileIn = tilesIn[r];
        if (!tileIn.tile.featureIndex) continue;

        renderedFeatureLayers.push(tileIn.tile.featureIndex.query({
            queryGeometry: tileIn.queryGeometry,
            scale: tileIn.scale,
            tileSize: tileIn.tile.tileSize,
            bearing: bearing,
            params: params
        }, styleLayers));
    }
    return mergeRenderedFeatureLayers(renderedFeatureLayers);
};

exports.source = function(sourceCache, params) {
    const tiles = sourceCache.getRenderableIds().map((id) => {
        return sourceCache.getTileByID(id);
    });

    const result = [];

    const dataTiles = {};
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const dataID = new TileCoord(Math.min(tile.sourceMaxZoom, tile.coord.z), tile.coord.x, tile.coord.y, 0).id;
        if (!dataTiles[dataID]) {
            dataTiles[dataID] = true;
            tile.querySourceFeatures(result, params);
        }
    }

    return result;
};

function sortTilesIn(a, b) {
    const coordA = a.coord;
    const coordB = b.coord;
    return (coordA.z - coordB.z) || (coordA.y - coordB.y) || (coordA.w - coordB.w) || (coordA.x - coordB.x);
}

function mergeRenderedFeatureLayers(tiles) {
    const result = tiles[0] || {};
    for (let i = 1; i < tiles.length; i++) {
        const tile = tiles[i];
        for (const layerID in tile) {
            const tileFeatures = tile[layerID];
            let resultFeatures = result[layerID];
            if (resultFeatures === undefined) {
                resultFeatures = result[layerID] = tileFeatures;
            } else {
                for (let f = 0; f < tileFeatures.length; f++) {
                    resultFeatures.push(tileFeatures[f]);
                }
            }
        }
    }
    return result;
}

