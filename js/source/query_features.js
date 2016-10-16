'use strict';
var TileCoord = require('./tile_coord');

exports.rendered = function(sourceCache, styleLayers, queryGeometry, params, zoom, bearing) {
    var tilesIn = sourceCache.tilesIn(queryGeometry);

    tilesIn.sort(sortTilesIn);

    var renderedFeatureLayers = [];
    for (var r = 0; r < tilesIn.length; r++) {
        var tileIn = tilesIn[r];
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
    var tiles = sourceCache.getRenderableIds().map(function(id) {
        return sourceCache.getTileByID(id);
    });

    var result = [];

    var dataTiles = {};
    for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        var dataID = new TileCoord(Math.min(tile.sourceMaxZoom, tile.coord.z), tile.coord.x, tile.coord.y, 0).id;
        if (!dataTiles[dataID]) {
            dataTiles[dataID] = true;
            tile.querySourceFeatures(result, params);
        }
    }

    return result;
};

function sortTilesIn(a, b) {
    var coordA = a.coord;
    var coordB = b.coord;
    return (coordA.z - coordB.z) || (coordA.y - coordB.y) || (coordA.w - coordB.w) || (coordA.x - coordB.x);
}

function mergeRenderedFeatureLayers(tiles) {
    var result = tiles[0] || {};
    for (var i = 1; i < tiles.length; i++) {
        var tile = tiles[i];
        for (var layerID in tile) {
            var tileFeatures = tile[layerID];
            var resultFeatures = result[layerID];
            if (resultFeatures === undefined) {
                resultFeatures = result[layerID] = tileFeatures;
            } else {
                for (var f = 0; f < tileFeatures.length; f++) {
                    resultFeatures.push(tileFeatures[f]);
                }
            }
        }
    }
    return result;
}

