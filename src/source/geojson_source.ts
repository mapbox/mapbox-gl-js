import {Event, ErrorEvent, Evented} from '../util/evented';
import EXTENT from '../style-spec/data/extent';
import {ResourceType} from '../util/ajax';
import browser from '../util/browser';
import {makeFQID} from '../util/fqid';
import {HD, prepareHD} from '../../modules/hd_main';

import type {ISource, SourceEvents} from './source';
import type {Map as MapboxMap} from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Tile from './tile';
import type Actor from '../util/actor';
import type {WorkerInbox} from '../util/actor_messages';
import type {Callback} from '../types/callback';
import type {RequestParameters} from '../util/ajax';
import type {MapSourceDataEvent} from '../ui/events';
import type {GeoJSONWorkerOptions} from './geojson_worker_source';
import type {GeoJSONSourceSpecification, PromoteIdSpecification} from '../style-spec/types';
import type {WorkerSourceVectorTileRequest, WorkerSourceVectorTileResult} from './worker_source';

export type LoadGeoJSONRequest = GeoJSONWorkerOptions & {
    data?: string;
    scope?: string;
    append?: boolean;
    request?: RequestParameters;
};

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
class GeoJSONSource extends Evented<SourceEvents> implements ISource {
    type: 'geojson';
    id: string;
    scope: string;
    minzoom: number;
    maxzoom: number;
    tileSize: number;
    minTileCacheSize?: number;
    maxTileCacheSize?: number;
    attribution: string | undefined;
    promoteId: PromoteIdSpecification | null | undefined;
    // eslint-disable-next-line camelcase
    mapbox_logo: boolean | undefined;
    vectorLayers?: never;
    vectorLayerIds?: never;
    rasterLayers?: never;
    rasterLayerIds?: never;

    roundZoom: boolean | undefined;
    isTileClipped: boolean | undefined;
    reparseOverscaled: boolean | undefined;
    _data: GeoJSON.GeoJSON | string;
    _options: GeoJSONSourceSpecification;
    workerOptions: GeoJSONWorkerOptions;
    map: MapboxMap;
    actor: Actor<WorkerInbox>;
    _loaded: boolean;
    _coalesce: boolean | null | undefined;
    _metadataFired: boolean | null | undefined;
    _collectResourceTiming: boolean;
    _pendingLoad: AbortController | null | undefined;
    _partialReload: boolean;

    hasTile: undefined;
    prepare: undefined;
    afterUpdate: undefined;
    _clear: undefined;

    /**
     * @private
     */
    constructor(id: string, options: GeoJSONSourceSpecification & {
        workerOptions?: GeoJSONWorkerOptions;
        collectResourceTiming: boolean;
    }, dispatcher: Dispatcher, eventedParent: Evented) {
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

        this._data = options.data;
        this._options = {...options};

        this._collectResourceTiming = options.collectResourceTiming;

        if (options.maxzoom !== undefined) this.maxzoom = options.maxzoom;
        if (options.minzoom !== undefined) this.minzoom = options.minzoom;
        if (options.type) this.type = options.type;
        if (options.attribution) this.attribution = options.attribution;
        this.promoteId = options.promoteId;

        const scale = EXTENT / this.tileSize;

        // sent to the worker, along with `url: ...` or `data: literal geojson`,
        // so that it can load/parse/index the geojson data
        // extending with `options.workerOptions` helps to make it easy for
        // third-party sources to hack/reuse GeoJSONSource.
        this.workerOptions = {
            source: this.id,
            scope: this.scope,
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
            filter: options.filter,
            dynamic: options.dynamic,
            ...options.workerOptions
        } as GeoJSONWorkerOptions;
    }

    onAdd(map: MapboxMap) {
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
    setData(data: GeoJSON.GeoJSON | string): this {
        this._data = data;
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._updateWorkerData();
        return this;
    }

    /**
     * Updates the existing GeoJSON data with new features and re-renders the map.
     * Can only be used on sources with `dynamic: true` in options.
     * Updates features by their IDs:
     *
     * - If there's a feature with the same ID, overwrite it.
     * - If there's a feature with the same ID but the new one's geometry is `null`, remove it
     * - If there's no such ID in existing data, add it as a new feature.
     *
     * @param {Object | string} data A GeoJSON data object or a URL to one.
     * @returns {GeoJSONSource} Returns itself to allow for method chaining.
     * @example
     * // Update the feature with ID=123 in the existing GeoJSON source
     * map.getSource('source_id').updateData({
     *     "type": "FeatureCollection",
     *     "features": [{
     *         "id": 123,
     *         "type": "Feature",
     *         "properties": {"name": "Null Island"},
     *         "geometry": {
     *             "type": "Point",
     *             "coordinates": [ 0, 0 ]
     *         }
     *     }]
     * });
     */
    updateData(data: GeoJSON.GeoJSON | string): this {
        if (!this._options.dynamic) {
            return this.fire(new ErrorEvent(new Error("Can't call updateData on a GeoJSON source with dynamic set to false.")));
        }
        if (typeof data !== 'string') {
            if (data.type === 'Feature') {
                data = {type: 'FeatureCollection', features: [data]};
            }
            if (data.type !== 'FeatureCollection') {
                return this.fire(new ErrorEvent(new Error("Data to update should be a feature or a feature collection.")));
            }
        }
        // if there's a pending load, accummulate feature updates
        if (this._coalesce && typeof data !== 'string' && typeof this._data !== 'string' && this._data.type === 'FeatureCollection') {
            // merge features by ID to avoid accummulating duplicate features to update
            const featuresById = new Map();
            for (const feature of this._data.features) featuresById.set(feature.id, feature);
            for (const feature of data.features) featuresById.set(feature.id, feature);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            this._data.features = [...featuresById.values()];
        } else {
            this._data = data;
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._updateWorkerData(true);
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
        this.actor.send('geojson.getClusterExpansionZoom', {clusterId, source: this.id, scope: this.scope})
            .then(data => callback(null, data))
            .catch(err => callback(err as Error));
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
     */
    getClusterChildren(clusterId: number, callback: Callback<Array<GeoJSON.Feature>>): this {
        this.actor.send('geojson.getClusterChildren', {clusterId, source: this.id, scope: this.scope})
            .then(data => callback(null, data))
            .catch(err => callback(err as Error));
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
    getClusterLeaves(
        clusterId: number,
        limit: number,
        offset: number,
        callback: Callback<Array<GeoJSON.Feature>>,
    ): this {
        this.actor.send('geojson.getClusterLeaves', {
            source: this.id,
            scope: this.scope,
            clusterId,
            limit,
            offset
        })
            .then(data => callback(null, data))
            .catch(err => callback(err as Error));
        return this;
    }

    /*
     * Responsible for invoking WorkerSource's geojson.loadData target, which
     * handles loading the geojson data and preparing to serve it up as tiles,
     * using geojson-vt or supercluster as appropriate.
     */
    async _updateWorkerData(append: boolean = false) {
        // if there's an earlier loadData to finish, wait until it finishes and then do another update
        if (this._pendingLoad) {
            this._coalesce = true;
            return;
        }

        this.fire(new Event('dataloading', {dataType: 'source'}));

        this._loaded = false;
        const options: LoadGeoJSONRequest = {append, ...this.workerOptions};

        options.scope = this.scope;
        const data = this._data;

        // Register _pendingLoad before any await, so a same-tick _updateWorkerData hits the coalesce guard.
        const controller = new AbortController();
        this._pendingLoad = controller;

        try {
            if (typeof data === 'string') {
                options.request = await this.map._requestManager.transformRequest(browser.resolveURL(data), ResourceType.Source, controller.signal);
                if (controller.signal.aborted) {
                    this._pendingLoad = null;
                    this._coalesce = false;
                    return;
                }
                options.request.collectResourceTiming = this._collectResourceTiming;
            } else {
                options.data = JSON.stringify(data);
            }

            // The runtime type is `${this.type}.loadData` so geojson-like source types can reuse
            // this path, but every variant returns a LoadGeoJSONResult-shaped reply.
            const result = await this.actor.send(`${this.type}.loadData`, options, {signal: controller.signal});
            this._loaded = true;
            this._pendingLoad = null;
            // although GeoJSON sources contain no metadata, we fire this event at first
            // to let the SourceCache know its ok to start requesting tiles.
            const dataEvent: MapSourceDataEvent = {dataType: 'source', sourceDataType: this._metadataFired ? 'content' : 'metadata'};
            const geojsonResult = result;
            if (this._collectResourceTiming && geojsonResult && geojsonResult.resourceTiming && geojsonResult.resourceTiming[this.id]) {
                dataEvent.resourceTiming = geojsonResult.resourceTiming[this.id];
            }
            if (append) this._partialReload = true;
            this.fire(new Event('data', dataEvent));
            this._partialReload = false;
            this._metadataFired = true;
        } catch (err) {
            if (controller.signal.aborted) {
                this._pendingLoad = null;
                // the load was cancelled (e.g. source removed); drop any queued coalesced update
                this._coalesce = false;
                return;
            }
            this._loaded = true;
            this._pendingLoad = null;
            this.fire(new ErrorEvent(err as Error));
        }

        if (this._coalesce) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this._updateWorkerData(append);
            this._coalesce = false;
        }
    }

    loaded(): boolean {
        return this._loaded;
    }

    reload() {
        const fqid = makeFQID(this.id, this.scope);
        this.map.style.clearSource(fqid);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this._updateWorkerData();
    }

    loadTile(tile: Tile, callback: Callback<undefined>) {
        const message = !tile.actor ? 'loadTile' : 'reloadTile';
        tile.actor = this.actor;
        const lutForScope = this.map.style ? this.map.style.getLut(this.scope) : null;
        const lut = lutForScope ? {image: lutForScope.image.clone()} : null;
        const partial = this._partialReload;

        const params: WorkerSourceVectorTileRequest = {
            type: this.type,
            uid: tile.uid,
            tileID: tile.tileID,
            tileZoom: tile.tileZoom,
            zoom: tile.tileID.overscaledZ,
            maxZoom: this.maxzoom,
            tileSize: this.tileSize,
            source: this.id,
            lut,
            scope: this.scope,
            pixelRatio: browser.devicePixelRatio,
            showCollisionBoxes: this.map.showCollisionBoxes,
            showElevationIdDebug: this.map.painter ? this.map.painter._debugParams.showElevationIdDebug : false,
            promoteId: this.promoteId,
            brightness: this.map.style ? (this.map.style.getBrightness() || 0.0) : 0.0,
            extraShadowCaster: tile.isExtraShadowCaster,
            scaleFactor: this.map.getScaleFactor(),
            partial,
            worldview: this.map.getWorldview(),
            indoor: this.map.getIndoorTileOptions(this.id, this.scope)
        };

        const done = (err: Error | null | undefined, data?: WorkerSourceVectorTileResult) => {
            if (partial && !data) {
                // if we did a partial reload and the tile didn't change, do nothing and treat the tile as loaded
                tile.state = 'loaded';
                return callback(null);
            }

            delete tile.request;
            tile.destroy(false);

            if (tile.aborted) {
                return callback(null);
            }

            if (err) {
                return callback(err);
            }

            // Same HD gate as vector_tile_source.done(): await the HD module before
            // deserializing a tile that carries extension classes (elevated roads etc.),
            // otherwise `loadVectorData` would hit the unregistered-class throw.
            if (data && data.containsHdExt && !HD.loaded) {
                const finishLoad = () => {
                    if (tile.aborted) return callback(null);
                    if (!HD.loaded) return callback(new Error('HD module failed to load'));
                    tile.loadVectorData(data, this.map.painter, message === 'reloadTile');
                    callback(null);
                };
                prepareHD().then(finishLoad, finishLoad);
                return;
            }

            tile.loadVectorData(data, this.map.painter, message === 'reloadTile');
            callback(null);
        };

        tile.request = this.actor.sendCancelable(message, params, {}, done);
    }

    abortTile(tile: Tile) {
        if (tile.request) {
            tile.request.abort();
            delete tile.request;
        }
        tile.aborted = true;
    }

    unloadTile(tile: Tile, _?: Callback<undefined> | null) {
        this.actor.notify('removeTile', {uid: tile.uid, type: this.type, source: this.id, scope: this.scope});
        tile.destroy();
    }

    onRemove(_: MapboxMap) {
        if (this._pendingLoad) {
            this._pendingLoad.abort();
        }
    }

    serialize(): GeoJSONSourceSpecification {
        return {
            ...this._options,
            type: this.type,
            data: this._data
        };
    }

    hasTransition(): boolean {
        return false;
    }
}

export default GeoJSONSource;
