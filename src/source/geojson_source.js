// @flow

const Evented = require('../util/evented');
const util = require('../util/util');
const window = require('../util/window');
const EXTENT = require('../data/extent');
const ResourceType = require('../util/ajax').ResourceType;
const browser = require('../util/browser');

import type {Source} from './source';
import type Map from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';
import type {Callback} from '../types/callback';

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
class GeoJSONSource extends Evented implements Source {
    type: 'geojson';
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;

    isTileClipped: boolean;
    reparseOverscaled: boolean;
    _data: GeoJSON | string;
    _options: any;
    workerOptions: any;
    dispatcher: Dispatcher;
    map: Map;
    workerID: number;
    _loaded: boolean;

    constructor(id: string, options: GeojsonSourceSpecification & { workerOptions?: any }, dispatcher: Dispatcher, eventedParent: Evented) {
        super();

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

        this._data = (options.data: any);
        this._options = util.extend({}, options);

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
                maxZoom: options.clusterMaxZoom !== undefined ?
                    Math.min(options.clusterMaxZoom, this.maxzoom - 1) :
                    (this.maxzoom - 1),
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
            // although GeoJSON sources contain no metadata, we fire this event to let the SourceCache
            // know its ok to start requesting tiles.
            this.fire('data', {dataType: 'source', sourceDataType: 'metadata'});
        });
    }

    onAdd(map: Map) {
        this.map = map;
        this.load();
    }

    /**
     * Sets the GeoJSON data and re-renders the map.
     *
     * @param {Object|string} data A GeoJSON data object or a URL to one. The latter is preferable in the case of large GeoJSON files.
     * @returns {GeoJSONSource} this
     */
    setData(data: GeoJSON | string) {
        this._data = data;
        this.fire('dataloading', {dataType: 'source'});
        this._updateWorkerData((err) => {
            if (err) {
                return this.fire('error', { error: err });
            }
            this.fire('data', {dataType: 'source', sourceDataType: 'content'});
        });

        return this;
    }

    /*
     * Responsible for invoking WorkerSource's geojson.loadData target, which
     * handles loading the geojson data and preparing to serve it up as tiles,
     * using geojson-vt or supercluster as appropriate.
     */
    _updateWorkerData(callback: Function) {
        const options = util.extend({}, this.workerOptions);
        const data = this._data;
        if (typeof data === 'string') {
            options.request = this.map._transformRequest(resolveURL(data), ResourceType.Source);
        } else {
            options.data = JSON.stringify(data);
        }

        // target {this.type}.loadData rather than literally geojson.loadData,
        // so that other geojson-like source types can easily reuse this
        // implementation
        this.workerID = this.dispatcher.send(`${this.type}.loadData`, options, (err) => {
            this._loaded = true;
            callback(err);
        }, this.workerID);
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const message = tile.workerID === undefined || tile.state === 'expired' ? 'loadTile' : 'reloadTile';
        const params = {
            type: this.type,
            uid: tile.uid,
            coord: tile.coord,
            zoom: tile.coord.z,
            maxZoom: this.maxzoom,
            tileSize: this.tileSize,
            source: this.id,
            pixelRatio: browser.devicePixelRatio,
            overscaling: tile.coord.z > this.maxzoom ? Math.pow(2, tile.coord.z - this.maxzoom) : 1,
            showCollisionBoxes: this.map.showCollisionBoxes
        };

        tile.workerID = this.dispatcher.send(message, params, (err, data) => {
            tile.unloadVectorData();

            if (tile.aborted) {
                return callback(null);
            }

            if (err) {
                return callback(err);
            }

            tile.loadVectorData(data, this.map.painter);

            return callback(null);
        }, this.workerID);
    }

    abortTile(tile: Tile) {
        tile.aborted = true;
    }

    unloadTile(tile: Tile) {
        tile.unloadVectorData();
        this.dispatcher.send('removeTile', { uid: tile.uid, type: this.type, source: this.id }, null, tile.workerID);
    }

    onRemove() {
        this.dispatcher.broadcast('removeSource', { type: this.type, source: this.id });
    }

    serialize() {
        return util.extend({}, this._options, {
            type: this.type,
            data: this._data
        });
    }

    hasTransition() {
        return false;
    }
}

function resolveURL(url) {
    const a = window.document.createElement('a');
    a.href = url;
    return a.href;
}

module.exports = GeoJSONSource;
