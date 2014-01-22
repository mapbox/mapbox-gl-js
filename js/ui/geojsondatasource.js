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
    var coords = feature.geometry.coordinates;

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
                    // TODO add extra points for polygons

                // add the point itself
                } else {
                    point = {
                        x: (coord.column - x) * tileExtent,
                        y: (coord.row - y) * tileExtent
                    };
                    if (!tile) tiles[tileID] = tile = [[point]];
                    else tile[tile.length - 1].push(point);
                }
            }
        }
    }

};

var typeMapping = {
    'Point': 'point',
    'LineString': 'line',
    'Polygon': 'fill'
};
