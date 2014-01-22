'use strict';

var Datasource = require('./datasource.js');
var Tile = require('./tile.js');
var Transform = require('./transform.js');
var Geometry = require('../geometry/geometry.js');
var util = require('../util/util.js');

var GeoJSONTile = require('./geojsontile.js');


var GeoJSONDatasource = module.exports = function(geojson, map) {
    this.map = map;
    this.painter = map.painter;

    this.tiles = {};
    this.alltiles = {};
    this.enabled = true;

    this.zooms = [13];
    this.geojson = geojson;

    this._tileGeoJSON(geojson);
};

GeoJSONDatasource.prototype = Object.create(Datasource.prototype);

GeoJSONDatasource.prototype._addTile = function(id) {
    var tile = this.alltiles[id];
    if (tile) {
        tile._load();
        this.tiles[id] = tile;
        this.fire('tile.add', tile);
    }
    return tile || {};
};

GeoJSONDatasource.prototype._tileGeoJSON = function(geojson) {
    if (geojson.type === 'FeatureCollection') {
        for (var i = 0; i < geojson.features.length; i++) {
            this._tileFeature(geojson.features[i]);
        }

    } else if (geojson.type === 'Feature') {
        this._tileFeature(geojson);

    } else {
        throw('Unrecognized geojson type');
    }

    for (var id in this.alltiles) {
        this.alltiles[id] = new GeoJSONTile(this.map, this.alltiles[id], 13);
    }
};


GeoJSONDatasource.prototype._tileFeature = function(feature) {
    var coords = feature.geometry.coordinates[0];

    var tilesize = 512;
    var tileExtent = 4096;
    var padding = 0.01;

    var transform = new Transform(tilesize);
    transform.zoom = 13;

    var line = [];

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

                var tileID = Tile.toID(13, x, y),
                    tile = tiles[tileID],
                    point;

                // segments starts outside the tile, add entry point
                if (0 <= enter && enter < 1) {
                    point = {
                        x: ((prevCoord.column + enter * dx) - x) * tileExtent,
                        y: ((prevCoord.row + enter * dy) - y) * tileExtent
                    };

                    if (!tile) tiles[tileID] = tile = [];
                    tile.push([point]);
                }

                // segments ends outside the tile, add exit point
                if (0 <= exit && exit < 1) {
                    point = {
                        x: ((prevCoord.column + exit * dx) - x) * tileExtent,
                        y: ((prevCoord.row + exit * dy) - y) * tileExtent
                    };
                    tile[tile.length - 1].push(point);

                // add the point itself
                } else {
                    point = {
                        x: (coord.column - x) * tileExtent,
                        y: (coord.row - y) * tileExtent,
                        inside: true
                    };
                    if (!tile) tiles[tileID] = tile = [[point]];
                    else tile[tile.length - 1].push(point);
                }
            }
        }
    }

    for (var id in tiles) {

        var fillable = true; // todo unhardcode

        var segments = tiles[id];
        var ring = [];

        if (fillable) {
            // join all segments so we can draw the feature as an area

            if (segments[0][0].inside && segments.length > 1) {
                // if there is more than one segment, combine the last
                // and first so that all start and end on tile edges
                var last = segments.pop();
                Array.prototype.unshift.apply(segments[0], last.slice(0, last.length - 1));
            }

            var start = edgeDist(segments[0][0], tileExtent, padding);

            for (var k = 0; k < segments.length; k++) {
                var thisExit = edgeDist(segments[k][segments[k].length - 1], tileExtent, padding);
                var nextEntry = edgeDist(segments[(k + 1) % segments.length][0], tileExtent, padding);

                var startToExit = (thisExit - start + 4) % 4;
                var startToNextEntry = (nextEntry - start + 4) % 4;
                var direction = startToExit < startToNextEntry ? 1 : -1;
                if (startToNextEntry === 0) direction = 1;

                var round = direction > 0 ? Math.ceil : Math.floor;
                for (var c = round(thisExit) % 4; c != round(nextEntry) % 4; c = (c + direction + 4) % 4) {
                    var corner = corners[c];
                    segments[k].push({
                        x: (corner.x + (corner.x - 0.5 > 0 ? 1 : -1) * padding) * tileExtent,
                        y: (corner.y + (corner.y - 0.5 > 0 ? 1 : -1) * padding) * tileExtent
                    });
                }
            }

            for (var m = 0; m < segments.length; m++) {
                ring = ring.concat(segments[m]);
            }
        }

        this.alltiles[id] = this.alltiles[id] || [];
        this.alltiles[id].push({
            properties: feature.properties,
            coords: [ring],
            type: typeMapping[feature.geometry.type]
        });
    }

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


// convert a point in the tile to distance along the edge from the top left
function edgeDist(point, tileExtent, padding) {
    var extent = tileExtent + padding * 2;
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
