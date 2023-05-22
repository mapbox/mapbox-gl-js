// @flow

import {Event, ErrorEvent, Evented} from '../util/evented.js';

import {extend} from '../util/util.js';
import EXTENT from '../data/extent.js';
import {ResourceType} from '../util/ajax.js';
import browser from '../util/browser.js';

import type {Source} from './source.js';
import type Map from '../ui/map.js';
import type Dispatcher from '../util/dispatcher.js';
import type Tile from './tile.js';
import type Actor from '../util/actor.js';
import type {Callback} from '../types/callback.js';
import type {GeoJSONWorkerOptions} from './geojson_worker_source.js';
import type {GeoJSON, GeoJSONFeature} from '@mapbox/geojson-types';
import type {GeoJSONSourceSpecification, PromoteIdSpecification} from '../style-spec/types.js';
import type {Cancelable} from '../types/cancelable.js';

/**
 * A source containing GeoJSON.
 * See the [Style Specification](https://www.mapbox.com/mapbox-gl-style-spec/#sources-geojson) for detailed documentation of options.
 *
 * @example
 * map.addSource('some id', {
 *     type: 'geojson',
 *     data: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_ports.geojson'
 * });
 *
 * @example
 * map.addSource('some id', {
 *     type: 'geojson',
 *     data: {
 *         "type": "FeatureCollection",
 *         "features": [{
 *             "type": "Feature",
 *             "properties": {},
 *             "geometry": {
 *                 "type": "Point",
 *                 "coordinates": [
 *                     -76.53063297271729,
 *                     39.18174077994108
 *                 ]
 *             }
 *         }]
 *     }
 * });
 *
 * @example
 * map.getSource('some id').setData({
 *     "type": "FeatureCollection",
 *     "features": [{
 *         "type": "Feature",
 *         "properties": {"name": "Null Island"},
 *         "geometry": {
 *             "type": "Point",
 *             "coordinates": [ 0, 0 ]
 *         }
 *     }]
 * });
 * @see [Example: Draw GeoJSON points](https://www.mapbox.com/mapbox-gl-js/example/geojson-markers/)
 * @see [Example: Add a GeoJSON line](https://www.mapbox.com/mapbox-gl-js/example/geojson-line/)
 * @see [Example: Create a heatmap from points](https://www.mapbox.com/mapbox-gl-js/example/heatmap/)
 * @see [Example: Create and style clusters](https://www.mapbox.com/mapbox-gl-js/example/cluster/)
 */
class GeoJSONSource extends Evented implements Source {
    type: 'geojson';
    id: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    attribution: string | void;
    promoteId: ?PromoteIdSpecification;

    isTileClipped: boolean | void;
    reparseOverscaled: boolean | void;
    _data: GeoJSON | string;
    _options: GeoJSONSourceSpecification;
    workerOptions: GeoJSONWorkerOptions;
    map: Map;
    actor: Actor;
    _loaded: boolean;
    _coalesce: ?boolean;
    _metadataFired: ?boolean;
    _collectResourceTiming: boolean;
    _pendingLoad: ?Cancelable;

    /**
     * @private
     */
    constructor(id: string, options: GeoJSONSourceSpecification & {workerOptions?: GeoJSONWorkerOptions, collectResourceTiming: boolean}, dispatcher: Dispatcher, eventedParent: Evented) {
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
        this._loaded = false;

        this.actor = dispatcher.getActor();
        this.setEventedParent(eventedParent);

        this._data = (options.data: any);
        this._options = extend({}, options);

        this._collectResourceTiming = options.collectResourceTiming;

        if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;
        if (options.type) this.type = options.type;
        if (options.attribution) this.attribution = options.attribution;
        this.promoteId = options.promoteId;

        const scale = EXTENT / this.tileSize;

        // sent to the worker, along with `url: ...` or `data: literal geojson`,
        // so that it can load/parse/index the geojson data
        // extending with `options.workerOptions` helps to make it easy for
        // third-party sources to hack/reuse GeoJSONSource.
        this.workerOptions = extend({
            source: this.id,
            cluster: options.cluster || false,
            geojsonVtOptions: {
                buffer: (options.buffer !== undefined ? options.buffer : 128) * scale,
                tolerance: (options.tolerance !== undefined ? options.tolerance : 0.375) * scale,
                extent: EXTENT,
                maxZoom: this.maxzoom,
                lineMetrics: options.lineMetrics || false,
                generateId: options.generateId || false
            },
            superclusterOptions: {
                maxZoom: options.clusterMaxZoom !== undefined ? options.clusterMaxZoom : this.maxzoom - 1,
                minPoints: Math.max(2, options.clusterMinPoints || 2),
                extent: EXTENT,
                radius: (options.clusterRadius !== undefined ? options.clusterRadius : 50) * scale,
                log: false,
                generateId: options.generateId || false
            },
            clusterProperties: options.clusterProperties,
            filter: options.filter
        }, options.workerOptions);
    }

    // $FlowFixMe[method-unbinding]
    onAdd(map: Map) {
        this.map = map;
        this.setData(this._data);
    }

    /**
     * Sets the GeoJSON data and re-renders the map.
     *
     * @param {Object | string} data A GeoJSON data object or a URL to one. The latter is preferable in the case of large GeoJSON files.
     * @returns {GeoJSONSource} Returns itself to allow for method chaining.
     * @example
     * map.addSource('source_id', {
     *     type: 'geojson',
     *     data: {
     *         type: 'FeatureCollection',
     *         features: []
     *     }
     * });
     * const geojsonSource = map.getSource('source_id');
     * // Update the data after the GeoJSON source was created
     * geojsonSource.setData({
     *     "type": "FeatureCollection",
     *     "features": [{
     *         "type": "Feature",
     *         "properties": {"name": "Null Island"},
     *         "geometry": {
     *             "type": "Point",
     *             "coordinates": [ 0, 0 ]
     *         }
     *     }]
     * });
     */
    setData(data: GeoJSON | string): this {
        this._data = data;
        this._updateWorkerData();
        return this;
    }

    /**
     * For clustered sources, fetches the zoom at which the given cluster expands.
     *
     * @param {number} clusterId The value of the cluster's `cluster_id` property.
     * @param {Function} callback A callback to be called when the zoom value is retrieved (`(error, zoom) => { ... }`).
     * @returns {GeoJSONSource} Returns itself to allow for method chaining.
     * @example
     * // Assuming the map has a layer named 'clusters' and a source 'earthquakes'
     * // The following creates a camera animation on cluster feature click
     * // the clicked layer should be filtered to only include clusters, e.g. `filter: ['has', 'point_count']`
     * map.on('click', 'clusters', (e) => {
     *     const features = map.queryRenderedFeatures(e.point, {
     *         layers: ['clusters']
     *     });
     *
     *     const clusterId = features[0].properties.cluster_id;
     *
     *     // Ease the camera to the next cluster expansion
     *     map.getSource('earthquakes').getClusterExpansionZoom(
     *         clusterId,
     *         (err, zoom) => {
     *             if (!err) {
     *                 map.easeTo({
     *                     center: features[0].geometry.coordinates,
     *                     zoom
     *                 });
     *             }
     *         }
     *     );
     * });
     */
    getClusterExpansionZoom(clusterId: number, callback: Callback<number>): this {
        this.actor.send('geojson.getClusterExpansionZoom', {clusterId, source: this.id}, callback);
        return this;
    }

    /**
     * For clustered sources, fetches the children of the given cluster on the next zoom level (as an array of GeoJSON features).
     *
     * @param {number} clusterId The value of the cluster's `cluster_id` property.
     * @param {Function} callback A callback to be called when the features are retrieved (`(error, features) => { ... }`).
     * @returns {GeoJSONSource} Returns itself to allow for method chaining.
     * @example
     * // Retrieve cluster children on click
     * // the clicked layer should be filtered to only include clusters, e.g. `filter: ['has', 'point_count']`
     * map.on('click', 'clusters', (e) => {
     *     const features = map.queryRenderedFeatures(e.point, {
     *         layers: ['clusters']
     *     });
     *
     *     const clusterId = features[0].properties.cluster_id;
     *
     *     clusterSource.getClusterChildren(clusterId, (error, features) => {
     *         if (!error) {
     *             console.log('Cluster children:', features);
     *         }
     *     });
     * });
     *
     */
    getClusterChildren(clusterId: number, callback: Callback<Array<GeoJSONFeature>>): this {
        this.actor.send('geojson.getClusterChildren', {clusterId, source: this.id}, callback);
        return this;
    }

    /**
     * For clustered sources, fetches the original points that belong to the cluster (as an array of GeoJSON features).
     *
     * @param {number} clusterId The value of the cluster's `cluster_id` property.
     * @param {number} limit The maximum number of features to return. Defaults to `10` if a falsy value is given.
     * @param {number} offset The number of features to skip (for example, for pagination). Defaults to `0` if a falsy value is given.
     * @param {Function} callback A callback to be called when the features are retrieved (`(error, features) => { ... }`).
     * @returns {GeoJSONSource} Returns itself to allow for method chaining.
     * @example
     * // Retrieve cluster leaves on click
     * // the clicked layer should be filtered to only include clusters, e.g. `filter: ['has', 'point_count']`
     * map.on('click', 'clusters', (e) => {
     *     const features = map.queryRenderedFeatures(e.point, {
     *         layers: ['clusters']
     *     });
     *
     *     const clusterId = features[0].properties.cluster_id;
     *     const pointCount = features[0].properties.point_count;
     *     const clusterSource = map.getSource('clusters');
     *
     *     clusterSource.getClusterLeaves(clusterId, pointCount, 0, (error, features) => {
     *     // Print cluster leaves in the console
     *         console.log('Cluster leaves:', error, features);
     *     });
     * });
     */
    getClusterLeaves(clusterId: number, limit: number, offset: number, callback: Callback<Array<GeoJSONFeature>>): this {
        this.actor.send('geojson.getClusterLeaves', {
            source: this.id,
            clusterId,
            limit,
            offset
        }, callback);
        return this;
    }

    /*
     * Responsible for invoking WorkerSource's geojson.loadData target, which
     * handles loading the geojson data and preparing to serve it up as tiles,
     * using geojson-vt or supercluster as appropriate.
     */
    _updateWorkerData() {
        // if there's an earlier loadData to finish, wait until it finishes and then do another update
        if (this._pendingLoad) {
            this._coalesce = true;
            return;
        }

        this.fire(new Event('dataloading', {dataType: 'source'}));

        this._loaded = false;
        const options = extend({}, this.workerOptions);
        const data = this._data;
        if (typeof data === 'string') {
            options.request = this.map._requestManager.transformRequest(browser.resolveURL(data), ResourceType.Source);
            options.request.collectResourceTiming = this._collectResourceTiming;
        } else {
            options.data = JSON.stringify(data);
        }

        // target {this.type}.loadData rather than literally geojson.loadData,
        // so that other geojson-like source types can easily reuse this
        // implementation
        this._pendingLoad = this.actor.send(`${this.type}.loadData`, options, (err, result) => {
            this._loaded = true;
            this._pendingLoad = null;

            if (err) {
                this.fire(new ErrorEvent(err));

            } else {
                // although GeoJSON sources contain no metadata, we fire this event at first
                // to let the SourceCache know its ok to start requesting tiles.
                const data: Object = {dataType: 'source', sourceDataType: this._metadataFired ? 'content' : 'metadata'};
                if (this._collectResourceTiming && result && result.resourceTiming && result.resourceTiming[this.id]) {
                    data.resourceTiming = result.resourceTiming[this.id];
                }
                this.fire(new Event('data', data));
                this._metadataFired = true;
            }

            if (this._coalesce) {
                this._updateWorkerData();
                this._coalesce = false;
            }
        });
    }

    loaded(): boolean {
        return this._loaded;
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const message = !tile.actor ? 'loadTile' : 'reloadTile';
        tile.actor = this.actor;
        const params = {
            type: this.type,
            uid: tile.uid,
            tileID: tile.tileID,
            tileZoom: tile.tileZoom,
            zoom: tile.tileID.overscaledZ,
            maxZoom: this.maxzoom,
            tileSize: this.tileSize,
            source: this.id,
            pixelRatio: browser.devicePixelRatio,
            showCollisionBoxes: this.map.showCollisionBoxes,
            promoteId: this.promoteId
        };

        tile.request = this.actor.send(message, params, (err, data) => {
            delete tile.request;
            tile.unloadVectorData();

            if (tile.aborted) {
                return callback(null);
            }

            if (err) {
                return callback(err);
            }

            tile.loadVectorData(data, this.map.painter, message === 'reloadTile');

            return callback(null);
        }, undefined, message === 'loadTile');
    }

    // $FlowFixMe[method-unbinding]
    abortTile(tile: Tile) {
        if (tile.request) {
            tile.request.cancel();
            delete tile.request;
        }
        tile.aborted = true;
    }

    // $FlowFixMe[method-unbinding]
    unloadTile(tile: Tile) {
        tile.unloadVectorData();
        this.actor.send('removeTile', {uid: tile.uid, type: this.type, source: this.id});
    }

    // $FlowFixMe[method-unbinding]
    onRemove() {
        if (this._pendingLoad) {
            this._pendingLoad.cancel();
        }
    }

    serialize(): GeoJSONSourceSpecification {
        return extend({}, this._options, {
            type: this.type,
            data: this._data
        });
    }

    hasTransition(): boolean {
        return false;
    }
}

export default GeoJSONSource;
