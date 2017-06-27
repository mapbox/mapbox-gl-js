const TileCoord = require('./tile_coord');

exports.rendered = function(sourceCache, styleLayers, queryGeometry, params, zoom, bearing) {
    const tilesIn = sourceCache.tilesIn(queryGeometry);

    tilesIn.sort(sortTilesIn);

    const renderedFeatureLayers = [];
    for (let r = 0; r < tilesIn.length; r++) {
        const tileIn = tilesIn[r];
        if (!tileIn.tile.featureIndex) continue;

        renderedFeatureLayers.push({
            wrappedTileID: tileIn.coord.wrapped().id,
            queryResults: tileIn.tile.featureIndex.query({
                queryGeometry: tileIn.queryGeometry,
                scale: tileIn.scale,
                tileSize: tileIn.tile.tileSize,
                bearing: bearing,
                params: params
            }, styleLayers)});
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
