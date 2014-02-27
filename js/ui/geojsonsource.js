'use strict';

var rewind = require('geojson-rewind');

var Source = require('./source.js');
var Tile = require('./tile.js');
var Transform = require('./transform.js');

var GeoJSONTile = require('./geojsontile.js');


var GeoJSONSource = module.exports = function(geojson) {
    this.tiles = {};
    this.alltiles = {};
    this.enabled = true;

    this.tilesize = 512;
    this.tileExtent = 4096;
    this.padding = 0.01;
    this.paddedExtent = this.tileExtent * (1 + 2 * this.padding);

    this.zooms = [1, 5, 9, 13];

    this.geojson = rewind(geojson);

    this.transforms = [];
    for (var i = 0; i < this.zooms.length; i++) {
        this.transforms[i] = new Transform(this.tilesize);
        this.transforms[i].zoom = this.zooms[i];
    }

    this.loadNewTiles = true;

    this._tileGeoJSON(this.geojson);
};

GeoJSONSource.prototype = Object.create(Source.prototype);

GeoJSONSource.prototype._addTile = function(id) {
    var tile = this.alltiles[id];
    if (tile) {
        tile._load();
        this.tiles[id] = tile;
        this.fire('tile.add', tile);
    }
    return tile || {};
};

GeoJSONSource.prototype._tileGeoJSON = function(geojson) {
    for (var k = 0; k < this.transforms.length; k++) {
        var transform = this.transforms[k];

        if (geojson.type === 'FeatureCollection') {
            for (var i = 0; i < geojson.features.length; i++) {
                this._tileFeature(geojson.features[i], transform);
            }

        } else if (geojson.type === 'Feature') {
            this._tileFeature(geojson, transform);

        } else {
            throw('Unrecognized geojson type');
        }
    }

    for (var id in this.alltiles) {
        this.alltiles[id] = new GeoJSONTile(this, this.alltiles[id]);
    }
};


GeoJSONSource.prototype._tileFeature = function(feature, transform) {
    var coords = feature.geometry.coordinates;
    var type = feature.geometry.type;

    var tiled;
    if (type === 'Point') {
        tiled = this._tileLineString([coords], transform);
    } else if (type === 'LineString' || type === 'MultiPoint') {
        tiled = this._tileLineString(coords, transform);
    } else if (type === 'Polygon' || type === 'MultiLineString') {
        tiled = {};
        for (var i = 0; i < coords.length; i++) {
            var tiled_ = this._tileLineString(coords[i], transform, type === 'Polygon');
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
        this.alltiles[id] = this.alltiles[id] || [];
        this.alltiles[id].push({
            properties: feature.properties,
            coords: tiled[id],
            type: typeMapping[feature.geometry.type]
        });
    }
};

GeoJSONSource.prototype._tileLineString = function(coords, transform, rejoin) {

    var padding = this.padding;
    var tileExtent = this.tileExtent;

    var coord = transform.locationCoordinate({ lon: coords[0][0], lat: coords[0][1] });
    var prevCoord;

    var tiles = {};

    for (var i = 0; i < coords.length; i++) {
        prevCoord = coord;
        coord = transform.locationCoordinate({ lon: coords[i][0], lat: coords[i][1] });

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

                var tileID = Tile.toID(transform.zoom, x, y),
                    tile = tiles[tileID],
                    point;

                // segments starts outside the tile, add entry point
                if (0 <= enter && enter < 1) {
                    point = {
                        x: ((prevCoord.column + enter * dx) - x) * tileExtent,
                        y: ((prevCoord.row + enter * dy) - y) * tileExtent,
                        continues: true
                    };

                    if (!tile) tiles[tileID] = tile = [];
                    tile.push([point]);
                }

                // segments ends outside the tile, add exit point
                if (0 <= exit && exit < 1) {
                    point = {
                        x: ((prevCoord.column + exit * dx) - x) * tileExtent,
                        y: ((prevCoord.row + exit * dy) - y) * tileExtent,
                        continues: true
                    };
                    tile[tile.length - 1].push(point);

                // add the point itself
                } else {
                    point = {
                        x: (coord.column - x) * tileExtent,
                        y: (coord.row - y) * tileExtent,
                    };
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

                var thisExit = edgeDist(segments[k][segments[k].length - 1], this.paddedExtent);
                var nextEntry = edgeDist(segments[(k + 1) % segments.length][0], this.paddedExtent);

                var startToExit = (thisExit - start + 4) % 4;
                var startToNextEntry = (nextEntry - start + 4) % 4;
                var direction = (thisExit === nextEntry || startToExit < startToNextEntry) ? 1 : -1;
                var roundFn = direction > 0 ? Math.ceil : Math.floor;

                for (var c = roundFn(thisExit) % 4; c != roundFn(nextEntry) % 4; c = (c + direction + 4) % 4) {
                    var corner = corners[c];
                    segments[k].push({
                        x: (corner.x + (corner.x - 0.5 > 0 ? 1 : -1) * padding) * tileExtent,
                        y: (corner.y + (corner.y - 0.5 > 0 ? 1 : -1) * padding) * tileExtent
                    });
                }
            }

            // Join all segments
            tiles[id] = [Array.prototype.concat.apply([], segments)];
        }
    }

    return tiles;

};

var typeMapping = {
    'Point': 'point',
    'LineString': 'line',
    'Polygon': 'fill'
};

var corners = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 }];

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
