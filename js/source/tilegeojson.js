'use strict';

var rewind = require('geojson-rewind');

var TileCoord = require('./tilecoord.js');
var Transform = require('../geo/transform.js');
var Point = require('point-geometry');
var LatLng = require('../geo/latlng.js');

module.exports = tileGeoJSON;

function tileGeoJSON(geojson, zoom, tileSize, tileExtent) {

    var tiles = {};

    tileSize = tileSize || 512;
    tileExtent = tileExtent || 4096;

    var transform = new Transform(tileSize);
    transform.zoom = zoom;

    geojson = rewind(geojson);

    if (geojson.type === 'FeatureCollection') {
        for (var i = 0; i < geojson.features.length; i++) {
            tileFeature(geojson.features[i], transform, tiles, tileExtent);
        }

    } else if (geojson.type === 'Feature') {
        tileFeature(geojson, transform, tiles, tileExtent);

    } else {
        throw('Unrecognized geojson type');
    }

    return tiles;
}

function tileFeature(feature, transform, tiles, tileExtent) {
    var coords = feature.geometry.coordinates;
    var type = feature.geometry.type;

    var tiled;
    if (type === 'Point') {
        tiled = tileLineString([coords], transform, tileExtent);

    } else if (type === 'LineString' || type === 'MultiPoint') {
        tiled = tileLineString(coords, transform, tileExtent);

    } else if (type === 'Polygon' || type === 'MultiLineString') {
        tiled = {};
        for (var i = 0; i < coords.length; i++) {
            var tiled_ = tileLineString(coords[i], transform, tileExtent, type === 'Polygon');
            for (var tileID in tiled_) {
                if (!tiled[tileID]) tiled[tileID] = [];
                tiled[tileID] = (tiled[tileID] || []).concat(tiled_[tileID]);
            }
        }

    } else if (type === 'MultiPolygon') {
        throw("todo");
    } else {
        throw("unrecognized geometry type");
    }

    for (var id in tiled) {
        tiles[id] = tiles[id] || [];
        tiles[id].push({
            properties: feature.properties,
            coords: tiled[id],
            type: feature.geometry.type
        });
    }
}

function tileLineString(coords, transform, tileExtent, rejoin) {

    var padding = 0.01;
    var paddedExtent = tileExtent * (1 + 2 * padding);
    var coord = transform.locationCoordinate(new LatLng(coords[0][1], coords[0][0]));
    var prevCoord;

    var tiles = {};

    for (var i = 0; i < coords.length; i++) {
        prevCoord = coord;
        coord = transform.locationCoordinate(new LatLng(coords[i][1], coords[i][0]));

        var dx = coord.column - prevCoord.column || Number.MIN_VALUE,
            dy = coord.row - prevCoord.row || Number.MIN_VALUE,
            dirX = dx / Math.abs(dx),
            dirY = dy / Math.abs(dy);

        // Find the rectangular bounding box, in tiles, of the polygon
        var startTileX = Math.floor(prevCoord.column - dirX * padding);
        var endTileX = Math.floor(coord.column + dirX * padding);
        var startTileY = Math.floor(prevCoord.row - dirY * padding);
        var endTileY = Math.floor(coord.row + dirY * padding);

        // Iterate over all tiles the segment might intersect
        // and split the segment across those tiles
        for (var x = startTileX; (x - endTileX) * dirX <= 0; x += dirX) {
            var leftX = (x - padding - prevCoord.column) / dx;
            var rightX = (x + 1 + padding - prevCoord.column) / dx;

            for (var y = startTileY; (y - endTileY) * dirY <= 0; y += dirY) {
                var topY = (y - padding - prevCoord.row) / dy;
                var bottomY = (y + 1 + padding - prevCoord.row) / dy;

                // fraction of the distance along the segment at which the segment
                // enters or exits the tile
                var enter = Math.max(Math.min(leftX, rightX), Math.min(topY, bottomY));
                var exit = Math.min(Math.max(leftX, rightX), Math.max(topY, bottomY));

                var tileID = TileCoord.toID(transform.tileZoom, x, y),
                    tile = tiles[tileID],
                    point;

                // segments starts outside the tile, add entry point
                if (0 <= enter && enter < 1) {
                    point = new Point(
                        ((prevCoord.column + enter * dx) - x) * tileExtent,
                        ((prevCoord.row + enter * dy) - y) * tileExtent);

                    point.continues = true;

                    if (!tile) tiles[tileID] = tile = [];
                    tile.push([point]);
                }

                // segments ends outside the tile, add exit point
                if (0 <= exit && exit < 1) {
                    point = new Point(
                        ((prevCoord.column + exit * dx) - x) * tileExtent,
                        ((prevCoord.row + exit * dy) - y) * tileExtent);

                    point.continues = true;

                    tile[tile.length - 1].push(point);

                // add the point itself
                } else {
                    point = new Point(
                        (coord.column - x) * tileExtent,
                        (coord.row - y) * tileExtent);

                    if (!tile) tiles[tileID] = tile = [[point]];
                    else tile[tile.length - 1].push(point);
                }
            }
        }
    }

    if (rejoin) {
        // reassemble the disconnected segments into a linestring
        // sections of the linestring outside the tile are replaced with segments
        // that follow the tile's edge
        for (var id in tiles) {

            var segments = tiles[id];

            if (!segments[0][0].continues && segments.length > 1) {
                // if the first segment is the beginning of the linestring
                // then join it with the last so that all segments start and
                // end at tile boundaries
                var last = segments.pop();
                Array.prototype.unshift.apply(segments[0], last.slice(0, last.length - 1));
            }

            var start = edgeDist(segments[0][0], tileExtent, padding);

            for (var k = 0; k < segments.length; k++) {
                // Add all tile corners along the path between the current segment's exit point
                // and the next segment's entry point

                var thisExit = edgeDist(segments[k][segments[k].length - 1], paddedExtent);
                var nextEntry = edgeDist(segments[(k + 1) % segments.length][0], paddedExtent);

                var startToExit = (thisExit - start + 4) % 4;
                var startToNextEntry = (nextEntry - start + 4) % 4;
                var direction = (thisExit === nextEntry || startToExit < startToNextEntry) ? 1 : -1;
                var roundFn = direction > 0 ? Math.ceil : Math.floor;

                for (var c = roundFn(thisExit) % 4; c != roundFn(nextEntry) % 4; c = (c + direction + 4) % 4) {
                    var corner = corners[c];
                    segments[k].push(new Point(
                        (corner.x + (corner.x - 0.5 > 0 ? 1 : -1) * padding) * tileExtent,
                        (corner.y + (corner.y - 0.5 > 0 ? 1 : -1) * padding) * tileExtent));
                }
            }

            // Join all segments
            tiles[id] = [Array.prototype.concat.apply([], segments)];
        }
    }

    return tiles;

}

var corners = [
    new Point(0, 0),
    new Point(1, 0),
    new Point(1, 1),
    new Point(0, 1)];

/*
 * Converts to a point to the distance along the edge of the tile (out of 4).
 *
 *         0.5
 *     0 _______ 1
 *      |       |
 *  3.5 |       | 1.5
 *      |       |
 *      |_______|
 *     3   2.5   2
 */
function edgeDist(point, extent) {
    var x = point.x / extent;
    var y = point.y / extent;
    var d;
    if (Math.abs(y - 0.5) >= Math.abs(x - 0.5)) {
        d = Math.round(y) * 2 + (y < 0.5 ? x : 1 - x);
    } else {
        d = Math.round(1 - x) * 2 + (x > 0.5 ? y : 1 - y) + 1;
    }

    return d % 4;
}
