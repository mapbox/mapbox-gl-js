'use strict';

const Evented = require('../util/evented');
const util = require('../util/util');
const window = require('../util/window');
const EXTENT = require('../data/extent');

/**
 * A source containing GeoJSON.
 * (See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-geojson) for detailed documentation of options.)
 *
 * @interface GeoJSONSource
 * @example
 *
 * map.addSource('some id', {
 *     type: 'geojson',
 *     data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_ports.geojson'
 * });
 *
 * @example
 * map.addSource('some id', {
 *    type: 'geojson',
 *    data: {
 *        "type": "FeatureCollection",
 *        "features": [{
 *            "type": "Feature",
 *            "properties": {},
 *            "geometry": {
 *                "type": "Point",
 *                "coordinates": [
 *                    -76.53063297271729,
 *                    39.18174077994108
 *                ]
 *            }
 *        }]
 *    }
 * });
 *
 * @example
 * map.getSource('some id').setData({
 *   "type": "FeatureCollection",
 *   "features": [{
 *       "type": "Feature",
 *       "properties": { "name": "Null Island" },
 *       "geometry": {
 *           "type": "Point",
 *           "coordinates": [ 0, 0 ]
 *       }
 *   }]
 * });
 * @see [Draw GeoJSON points](https://www.mapbox.com/mapbox-gl-js/example/geojson-markers/)
 * @see [Add a GeoJSON line](https://www.mapbox.com/mapbox-gl-js/example/geojson-line/)
 * @see [Create a heatmap from points](https://www.mapbox.com/mapbox-gl-js/example/heatmap/)
 */
class GeoJSONSource extends Evented {

    constructor(id, options, dispatcher, eventedParent) {
        super();
        options = options || {};
        this.id = id;

        // `type` is a property rather than a constant to make it easy for 3rd
        // parties to use GeoJSONSource to build their own source types.
        this.type = 'geojson';

        this.minzoom = 0;
        this.maxzoom = 18;
        this.tileSize = 512;
        this.isTileClipped = true;
        this.reparseOverscaled = true;

        this.dispatcher = dispatcher;
        this.setEventedParent(eventedParent);

        this._data = options.data;

        if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;
        if (options.type) this.type = options.type;

        const scale = EXTENT / this.tileSize;

        // sent to the worker, along with `url: ...` or `data: literal geojson`,
        // so that it can load/parse/index the geojson data
        // extending with `options.workerOptions` helps to make it easy for
        // third-party sources to hack/reuse GeoJSONSource.
        this.workerOptions = util.extend({
            source: this.id,
            cluster: options.cluster || false,
            geojsonVtOptions: {
                buffer: (options.buffer !== undefined ? options.buffer : 128) * scale,
                tolerance: (options.tolerance !== undefined ? options.tolerance : 0.375) * scale,
                extent: EXTENT,
                maxZoom: this.maxzoom
            },
            superclusterOptions: {
                maxZoom: Math.min(options.clusterMaxZoom, this.maxzoom - 1) || (this.maxzoom - 1),
                extent: EXTENT,
                radius: (options.clusterRadius || 50) * scale,
                log: false
            }
        }, options.workerOptions);
    }

    load() {
        this.fire('dataloading', {dataType: 'source'});
        this._updateWorkerData((err) => {
            if (err) {
                this.fire('error', {error: err});
                return;
            }
            this.fire('data', {dataType: 'source'});
            this.fire('source.load');
        });
    }

    onAdd(map) {
        this.load();
        this.map = map;
    }

    /**
     * Sets the GeoJSON data and re-renders the map.
     *
     * @param {Object|string} data A GeoJSON data object or a URL to one. The latter is preferable in the case of large GeoJSON files.
     * @returns {GeoJSONSource} this
     */
    setData(data) {
        this._data = data;

        this.fire('dataloading', {dataType: 'source'});
        this._updateWorkerData((err) => {
            if (err) {
                return this.fire('error', { error: err });
            }
            this.fire('data', {dataType: 'source'});
        });

        return this;
    }

    /*
     * Responsible for invoking WorkerSource's geojson.loadData target, which
     * handles loading the geojson data and preparing to serve it up as tiles,
     * using geojson-vt or supercluster as appropriate.
     */
    _updateWorkerData(callback) {
        const options = util.extend({}, this.workerOptions);
        const data = this._data;
        if (typeof data === 'string') {
            options.url = resolveURL(data);
        } else {
            options.data = JSON.stringify(data);
        }

        // target {this.type}.loadData rather than literally geojson.loadData,
        // so that other geojson-like source types can easily reuse this
        // implementation
        this.workerID = this.dispatcher.send(`${this.type}.loadData`, options, (err) => {
            this._loaded = true;
            callback(err);

        });
    }

    loadTile(tile, callback) {
        const overscaling = tile.coord.z > this.maxzoom ? Math.pow(2, tile.coord.z - this.maxzoom) : 1;
        const params = {
            type: this.type,
            uid: tile.uid,
            coord: tile.coord,
            zoom: tile.coord.z,
            maxZoom: this.maxzoom,
            tileSize: this.tileSize,
            source: this.id,
            overscaling: overscaling,
            angle: this.map.transform.angle,
            pitch: this.map.transform.pitch,
            showCollisionBoxes: this.map.showCollisionBoxes
        };

        tile.workerID = this.dispatcher.send('loadTile', params, (err, data) => {

            tile.unloadVectorData();

            if (tile.aborted)
                return;

            if (err) {
                return callback(err);
            }

            tile.loadVectorData(data, this.map.painter);

            if (tile.redoWhenDone) {
                tile.redoWhenDone = false;
                tile.redoPlacement(this);
            }

            return callback(null);

        }, this.workerID);
    }

    abortTile(tile) {
        tile.aborted = true;
    }

    unloadTile(tile) {
        tile.unloadVectorData();
        this.dispatcher.send('removeTile', { uid: tile.uid, type: this.type, source: this.id }, () => {}, tile.workerID);
    }

    onRemove() {
        this.dispatcher.broadcast('removeSource', { type: this.type, source: this.id }, () => {});
    }

    serialize() {
        return {
            type: this.type,
            data: this._data
        };
    }
}

function resolveURL(url) {
    const a = window.document.createElement('a');
    a.href = url;
    return a.href;
}

module.exports = GeoJSONSource;
