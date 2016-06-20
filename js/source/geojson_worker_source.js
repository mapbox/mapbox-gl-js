'use strict';

var ajax = require('../util/ajax');
var rewind = require('geojson-rewind');
var GeoJSONWrapper = require('./geojson_wrapper');
var vtpbf = require('vt-pbf');
var supercluster = require('supercluster');
var geojsonvt = require('geojson-vt');

module.exports = GeoJSONWorkerSource;

/**
 * Create a {@link WorkerSource} that supports a GeoJSONSource.
 * @param {Function} [loadGeoJSON] Optional method for custom loading/parsing of GeoJSON based on parameters passed from the main-thread Source.  By default, GeoJSON is loaded and parsed from `params.url` if it exists, or else expected as a literal (string or object) `params.data`.
 */
function GeoJSONWorkerSource (loadGeoJSON) {
    if (loadGeoJSON) { this.loadGeoJSON = loadGeoJSON; }
}

GeoJSONWorkerSource.prototype = {
    // object mapping source ids to geojson-vt-like tile indexes
    _geoJSONIndexes: {},

    loadTile: function (params, callback) {
        var source = params.source,
            coord = params.coord;

        if (!this._geoJSONIndexes[source]) return callback(null, null); // we couldn't load the file

        var geoJSONTile = this._geoJSONIndexes[source].getTile(Math.min(coord.z, params.maxZoom), coord.x, coord.y);
        if (geoJSONTile) {
            var geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);
            geojsonWrapper.name = '_geojsonTileLayer';
            var pbf = vtpbf({ layers: { '_geojsonTileLayer': geojsonWrapper }});
            if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
                // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
                pbf = new Uint8Array(pbf);
            }
            callback(null, { tile: geojsonWrapper, rawTileData: pbf.buffer });
            // tile.parse(geojsonWrapper, this.layerFamilies, this.actor, rawTileData, callback);
        } else {
            return callback(null, null); // nothing in the given tile
        }
    },

    /**
     * Fetches (if appropriate), parses, and index geojson data into tiles.
     * `callback` is called with a "tile index" equivalent to the output of
     * geojson-vt.
     *
     * Defers to `this.loadGeoJSON(params, callback)` for the fetching/parsing,
     * expecting `callback` to be called with `(error, data: GeoJSON)`.
     * @private
     */
    loadData: function (params, callback) {
        var handleData = function(err, data) {
            if (err) return callback(err);
            if (typeof data != 'object') {
                return callback(new Error("Input data is not a valid GeoJSON object."));
            }
            rewind(data, true);
            this._indexData(data, params, function (err, indexed) {
                if (err) { return callback(err); }
                this._geoJSONIndexes[params.source] = indexed;
                callback(null);
            }.bind(this));
        }.bind(this);

        this.loadGeoJSON(params, handleData);
    },

    /**
     * Fetch and parse GeoJSON according to the given params.  Calls `callback`
     * with `(err, data)`, where `data` is a parsed GeoJSON object.
     * @private
     */
    loadGeoJSON: function (params, callback) {
        // Because of same origin issues, urls must either include an explicit
        // origin or absolute path.
        // ie: /foo/bar.json or http://example.com/bar.json
        // but not ../foo/bar.json
        if (params.url) {
            ajax.getJSON(params.url, callback);
        } else if (typeof params.data === 'string') {
            try {
                return callback(null, JSON.parse(params.data));
            } catch (e) {
                return callback(new Error("Input data is not a valid GeoJSON object."));
            }
        } else {
            return callback(new Error("Input data is not a valid GeoJSON object."));
        }
    },

    /**
     * Index the data using either geojson-vt or supercluster
     * @param {GeoJSON} data
     * @param {object} params forwarded from loadTile.
     * @param {callback} (err, indexedData)
     * @private
     */
    _indexData: function (data, params, callback) {
        try {
            if (params.cluster) {
                callback(null, supercluster(params.superclusterOptions).load(data.features));
            } else {
                callback(null, geojsonvt(data, params.geojsonVtOptions));
            }
        } catch (err) {
            return callback(err);
        }
    }
};
