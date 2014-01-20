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
};


GeoJSONDatasource.prototype._tileFeature = function(feature) {
    var coords = feature.geometry.coordinates;

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
                if (!this.alltiles[tileID]) this.alltiles[tileID] = [];
                this.alltiles[tileID].push(line);
            }

            line = [point];
        }

        prevCoord = coord;
    }

    if (line.length) {
        // todo this won't get run on last coord
        // todo unhardcode zoom
        tileID = Tile.toID(13, Math.floor(prevCoord.column), Math.floor(prevCoord.row));
        if (!this.alltiles[tileID]) this.alltiles[tileID] = [];
        this.alltiles[tileID].push(line);
    }

    for (var id in this.alltiles) {
        this.alltiles[id] = new GeoJSONTile(this.map, this.alltiles[id], 13);
    }
};
