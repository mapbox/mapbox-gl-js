'use strict';

var Datasource = require('./datasource.js');
var Tile = require('./tile.js');
var Transform = require('./transform.js');
var Geometry = require('../geometry/geometry.js');
var util = require('../util/util.js');


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
        this.tiles[id] = tile;
        this.fire('tile.add', tile);
    }
    return tile || {};
};

GeoJSONDatasource.prototype._tileGeoJSON = function(geometry) {
    var coords = geometry.coordinates;

    var tilesize = 512;
    var tileExtent = 4096;
    var transform = new Transform(tilesize);
    transform.zoom = 13;
    var prevCoord, coord;

    var line = [];
    var tileID;

    for (var i = 0; i < coords.length; i++) {
        coord = transform.locationCoordinate({ lon: coords[i][0], lat: coords[i][1] });

        var point = {
                x: Math.round((coord.column % 1) * tileExtent),
                y: Math.round((coord.row % 1) * tileExtent)
        };


        if (prevCoord && Math.floor(prevCoord.column) === Math.floor(coord.column) && prevCoord) {
            line.push(point);

        } else {

            if (line.length) {
                // todo this won't get run on last coord
                // todo unhardcode zoom
                tileID = Tile.toID(13, Math.floor(prevCoord.column), Math.floor(prevCoord.row));
                if (!this.alltiles[tileID]) {
                    this.alltiles[tileID] = new GeoJSONTile(this.map, prevCoord.z);
                    this.alltiles[tileID].layers = { everything: startBucket(this.alltiles[tileID]) };
                }
                this.alltiles[tileID].geometry.addLine(line);
                console.log(line);
            }

            line = [point];
        }

        prevCoord = coord;
    }

    if (line.length) {
        // todo this won't get run on last coord
        // todo unhardcode zoom
        tileID = Tile.toID(13, ~~prevCoord.column, ~~prevCoord.row);
        if (!this.alltiles[tileID]) {
            this.alltiles[tileID] = new GeoJSONTile(this.map, prevCoord.z);
            this.alltiles[tileID].layers = { everything: startBucket(this.alltiles[tileID]) };
        }
        this.alltiles[tileID].geometry.addLine(line);
                console.log(line);
    }

    for (var id in this.alltiles) {
        endBucket(this.alltiles[id].layers.everything, this.alltiles[id]);
    }
};

var GeoJSONTile = function(map, zoom) {
    var tile = this;
    tile.loaded = true;
    tile.geometry = new Geometry();
};

GeoJSONTile.prototype = Object.create(Tile.prototype);

// noops
GeoJSONTile.prototype._load = function() { };
GeoJSONTile.prototype.abort = function() { };
GeoJSONTile.prototype.remove = function() { };

function startBucket(tile) {
    var geometry = tile.geometry;
    var bucket = {
        lineVertexIndex: geometry.lineVertex.index,

        fillBufferIndex: geometry.fillBufferIndex,
        fillVertexIndex: geometry.fillVertex.index,
        fillElementsIndex: geometry.fillElements.index,

        glyphVertexIndex: geometry.glyphVertex.index
    };
    return bucket;
}


function endBucket(bucket, tile) {
    var geometry = tile.geometry;

    bucket.lineVertexIndexEnd = geometry.lineVertex.index;

    bucket.fillBufferIndexEnd = geometry.fillBufferIndex;
    bucket.fillVertexIndexEnd = geometry.fillVertex.index;
    bucket.fillElementsIndexEnd = geometry.fillElements.index;

    bucket.glyphVertexIndexEnd = geometry.glyphVertex.index;

    return bucket;
}
