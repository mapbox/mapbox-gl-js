'use strict';

const ajax = require('../util/ajax');
const rewind = require('geojson-rewind');
const GeoJSONWrapper = require('./geojson_wrapper');
const vtpbf = require('vt-pbf');
const supercluster = require('supercluster');
const geojsonvt = require('geojson-vt');

const VectorTileWorkerSource = require('./vector_tile_worker_source');

/**
 * The {@link WorkerSource} implementation that supports {@link GeoJSONSource}.
 * This class is designed to be easily reused to support custom source types
 * for data formats that can be parsed/converted into an in-memory GeoJSON
 * representation.  To do so, create it with
 * `new GeoJSONWorkerSource(actor, layerIndex, customLoadGeoJSONFunction)`.  For a full example, see [mapbox-gl-topojson](https://github.com/developmentseed/mapbox-gl-topojson).
 *
 * @private
 */
class GeoJSONWorkerSource extends VectorTileWorkerSource {
    /**
     * @param {Function} [loadGeoJSON] Optional method for custom loading/parsing of GeoJSON based on parameters passed from the main-thread Source.  See {@link GeoJSONWorkerSource#loadGeoJSON}.
     */
    constructor (actor, layerIndex, loadGeoJSON) {
        super(actor, layerIndex);
        if (loadGeoJSON) {
            this.loadGeoJSON = loadGeoJSON;
        }
        // object mapping source ids to geojson-vt-like tile indexes
        this._geoJSONIndexes = {};
    }

    /**
     * See {@link VectorTileWorkerSource#loadTile}.
     */
    loadVectorData(params, callback) {
        const source = params.source,
            coord = params.coord;

        if (!this._geoJSONIndexes[source]) {
            return callback(null, null);  // we couldn't load the file
        }

        const geoJSONTile = this._geoJSONIndexes[source].getTile(Math.min(coord.z, params.maxZoom), coord.x, coord.y);
        if (!geoJSONTile) {
            return callback(null, null); // nothing in the given tile
        }

        const geojsonWrapper = new GeoJSONWrapper(geoJSONTile.features);
        geojsonWrapper.name = '_geojsonTileLayer';
        let pbf = vtpbf({ layers: { '_geojsonTileLayer': geojsonWrapper }});
        if (pbf.byteOffset !== 0 || pbf.byteLength !== pbf.buffer.byteLength) {
            // Compatibility with node Buffer (https://github.com/mapbox/pbf/issues/35)
            pbf = new Uint8Array(pbf);
        }
        geojsonWrapper.rawData = pbf.buffer;
        callback(null, geojsonWrapper);
    }

    /**
     * Fetches (if appropriate), parses, and index geojson data into tiles. This
     * preparatory method must be called before {@link GeoJSONWorkerSource#loadTile}
     * can correctly serve up tiles.
     *
     * Defers to {@link GeoJSONWorkerSource#loadGeoJSON} for the fetching/parsing,
     * expecting `callback(error, data)` to be called with either an error or a
     * parsed GeoJSON object.
     * @param {Object} params
     * @param {string} params.source The id of the source.
     * @param {Function} callback
     */
    loadData(params, callback) {
        const handleData = function(err, data) {
            if (err) return callback(err);
            if (typeof data != 'object') {
                return callback(new Error("Input data is not a valid GeoJSON object."));
            }
            rewind(data, true);
            this._indexData(data, params, (err, indexed) => {
                if (err) { return callback(err); }
                this._geoJSONIndexes[params.source] = indexed;
                callback(null);
            });
        }.bind(this);

        this.loadGeoJSON(params, handleData);
    }

    /**
     * Fetch and parse GeoJSON according to the given params.  Calls `callback`
     * with `(err, data)`, where `data` is a parsed GeoJSON object.
     *
     * GeoJSON is loaded and parsed from `params.url` if it exists, or else
     * expected as a literal (string or object) `params.data`.
     *
     * @param {Object} params
     * @param {string} [params.url] A URL to the remote GeoJSON data.
     * @param {Object} [params.data] Literal GeoJSON data. Must be provided if `params.url` is not.
     */
    loadGeoJSON(params, callback) {
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
    }

    removeSource(params) {
        if (this._geoJSONIndexes[params.source]) {
            delete this._geoJSONIndexes[params.source];
        }
    }

    /**
     * Index the data using either geojson-vt or supercluster
     * @param {GeoJSON} data
     * @param {Object} params forwarded from loadTile.
     * @param {callback} (err, indexedData)
     * @private
     */
    _indexData(data, params, callback) {
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
}

module.exports = GeoJSONWorkerSource;
