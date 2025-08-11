// Import MRTData as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import '../data/mrt_data';
import RasterTileSource from './raster_tile_source';
import {extend} from '../util/util';
import {RGBAImage} from '../util/image';
import {ErrorEvent} from '../util/evented';
import {ResourceType} from '../util/ajax';
import RasterStyleLayer from '../style/style_layer/raster_style_layer';
import RasterParticleStyleLayer from '../style/style_layer/raster_particle_style_layer';
import MercatorCoordinate from '../geo/mercator_coordinate';
import {OverscaledTileID} from './tile_id';
import {getPointLonLat} from '../data/mrt/mrt.query';
import LngLat from '../geo/lng_lat';
import browser from '../util/browser';
import {makeFQID} from '../util/fqid';

import type RasterArrayTile from './raster_array_tile';
import type Texture from '../render/texture';
import type Dispatcher from '../util/dispatcher';
import type {Map as MapboxMap} from '../ui/map';
import type {Evented} from '../util/evented';
import type {Callback} from '../types/callback';
import type {AJAXError} from '../util/ajax';
import type {MapboxRasterTile} from '../data/mrt/mrt.esm.js';
import type {TextureDescriptor} from './raster_array_tile';
import type {StyleImage, StyleImageMap} from '../style/style_image';
import type {RasterArraySourceSpecification} from '../style-spec/types';
import type {WorkerSourceRasterArrayTileRequest} from './worker_source';
import type {LngLatLike} from '../geo/lng_lat';

type RasterQueryResultEntry = Record<string, number[] | null>;
export type RasterQueryResult = Record<string, RasterQueryResultEntry> | null;

export type RasterQueryParameters = {
    layerName?: string;
    bands?: string[];
};

/**
 * A data source containing raster-array tiles created with [Mapbox Tiling Service](https://docs.mapbox.com/mapbox-tiling-service/guides/).
 * See the [Style Specification](https://docs.mapbox.com/style-spec/reference/sources/#raster-array) for detailed documentation of options.
 *
 * @example
 * // add to map
 * map.addSource('some id', {
 *     type: 'raster-array',
 *     url: 'mapbox://rasterarrayexamples.gfs-winds',
 *     tileSize: 512
 * });
 *
 * @see [Example: Create a wind particle animation](https://docs.mapbox.com/mapbox-gl-js/example/raster-particle-layer/)
 */
class RasterArrayTileSource extends RasterTileSource<'raster-array'> {
    private _loadTilePending: Record<string, Array<Callback<MapboxRasterTile>>>;
    private _loadTileLoaded: Record<string, boolean>;

    override map: MapboxMap;

    /**
     * When `true`, the source will only load the tile header
     * and use range requests to load and parse the tile data.
     * Otherwise, the entire tile will be loaded and parsed in the Worker.
     */
    partial: boolean;

    constructor(id: string, options: RasterArraySourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'raster-array';
        this.maxzoom = 22;
        this.partial = true;
        this._loadTilePending = {};
        this._loadTileLoaded = {};
        this._options = extend({type: 'raster-array'}, options);
    }

    triggerRepaint(tile: RasterArrayTile) {
        const terrain = this.map.painter._terrain;
        const sourceCache = this.map.style.getSourceCache(this.id);
        if (terrain && terrain.enabled && sourceCache) {
            terrain._clearRenderCacheForTile(sourceCache.id, tile.tileID);
        }

        // eslint-disable-next-line no-warning-comments
        // TODO: trigger repaint only if all tiles have the requested band
        this.map.triggerRepaint();
    }

    override loadTile(tile: RasterArrayTile, callback: Callback<undefined>) {
        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme), false, this.tileSize);
        const request = this.map._requestManager.transformRequest(url, ResourceType.Tile);

        const params: WorkerSourceRasterArrayTileRequest = {
            request,
            uid: tile.uid,
            tileID: tile.tileID,
            type: this.type,
            source: this.id,
            scope: this.scope,
            partial: this.partial
        };

        tile.source = this.id;
        tile.scope = this.scope;
        tile.requestParams = request;
        if (!tile.actor) tile.actor = this.dispatcher.getActor();

        const done = (error?: AJAXError | null, data?: MapboxRasterTile, cacheControl?: string, expires?: string) => {
            delete tile.request;

            if (tile.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }

            if (error) {
                // silence AbortError
                if (error.name === 'AbortError') return;
                tile.state = 'errored';
                return callback(error);
            }

            if (this.map._refreshExpiredTiles && data) {
                tile.setExpiryData({cacheControl, expires});
            }

            if (this.partial && tile.state !== 'expired') {
                tile.state = 'empty';
            } else if (!this.partial) {
                if (!data) return callback(null);

                tile.state = 'loaded';
                tile._isHeaderLoaded = true;
                tile._mrt = data;
            }

            callback(null);
        };

        if (this.partial) {
            // Load only the tile header in the main thread
            tile.request = tile.fetchHeader(undefined, done.bind(this));
        } else {
            // Load and parse the entire tile in Worker
            tile.request = tile.actor.send('loadTile', params, done.bind(this), undefined, true);
        }
    }

    override abortTile(tile: RasterArrayTile) {
        if (tile.request) {
            tile.request.cancel();
            delete tile.request;
        }

        if (tile.actor) {
            tile.actor.send('abortTile', {uid: tile.uid, type: this.type, source: this.id, scope: this.scope});
        }
    }

    override unloadTile(tile: RasterArrayTile, _?: Callback<undefined> | null) {
        const textures = tile.texturePerLayer;

        tile.flushAllQueues();

        if (textures.size) {
            // Clean everything else up owned by the tile, but preserve the texture.
            // Destroy first to prevent racing with the texture cache being popped.
            tile.destroy(true);
            // Preserve the textures in the cache
            for (const texture of textures.values()) {
                // Save the texture to the cache
                this.map.painter.saveTileTexture(texture);
            }
        } else {
            tile.destroy();
        }
    }

    /**
     * Prepare RasterArrayTile for the rendering. If tile doesn't have data
     * for the requested band, fetch and repaint once it's acquired.
     * @private
     */
    prepareTile(tile: RasterArrayTile, sourceLayer: string, layerId: string, band: string | number) {
        // Skip if tile is not yet loaded or if no update is needed
        if (!tile._isHeaderLoaded) return;

        // Don't mark tile as reloading if it was empty.
        if (tile.state !== 'empty') tile.state = 'reloading';

        // Fetch data for band and then repaint once data is acquired.
        tile.fetchBandForRender(sourceLayer, layerId, band, (error, data) => {
            if (error) {
                tile.state = 'errored';
                this.fire(new ErrorEvent(error));
                this.triggerRepaint(tile);
                return;
            }

            if (data) {
                tile._isHeaderLoaded = true;
                tile.setTexturePerLayer(layerId, data, this.map.painter);
                tile.state = 'loaded';
                this.triggerRepaint(tile);
            }
        });
    }

    /**
     * Get the initial band for a source layer.
     * @private
     */
    getInitialBand(sourceLayer: string): string | number {
        if (!this.rasterLayers) return 0;
        const rasterLayer = this.rasterLayers.find(({id}) => id === sourceLayer);
        const fields = rasterLayer && rasterLayer.fields;
        const bands = fields && fields.bands && fields.bands;
        return bands ? bands[0] : 0;
    }

    /**
     * Get a texture descriptor for a source layer and a band.
     * @private
     * @param {RasterArrayTile} tile
     * @param {RasterStyleLayer} layer
     * @param {boolean} fallbackToPrevious If true, return previous texture even if update is needed
     * @returns {TextureDescriptor} Texture descriptor with texture if available
     */
    getTextureDescriptor(
        tile: RasterArrayTile,
        layer: RasterStyleLayer | RasterParticleStyleLayer,
        fallbackToPrevious: boolean,
    ): TextureDescriptor & {texture: Texture | null | undefined;} | void {
        if (!tile) return;

        const sourceLayer = layer.sourceLayer || (this.rasterLayerIds && this.rasterLayerIds[0]);
        if (!sourceLayer) return;

        let layerBand = null;
        if (layer instanceof RasterStyleLayer) {
            layerBand = layer.paint.get('raster-array-band');
        } else if (layer instanceof RasterParticleStyleLayer) {
            layerBand = layer.paint.get('raster-particle-array-band');
        }
        const band = layerBand || this.getInitialBand(sourceLayer);
        if (band == null) return;

        if (!tile.textureDescriptorPerLayer.get(layer.id)) {
            this.prepareTile(tile, sourceLayer, layer.id, band);
            return;
        }

        // Fallback to previous texture even if update is needed
        if (tile.updateNeeded(layer.id, band) && !fallbackToPrevious) return;

        const textureDescriptor = tile.textureDescriptorPerLayer.get(layer.id);

        return Object.assign({}, textureDescriptor, {texture: tile.texturePerLayer.get(layer.id)});
    }

    /**
     * Creates style images from raster array tiles based on the requested image names.
     * Used by `ImageProvider` to resolve pending image requests.
     * @private
     * @param {RasterArrayTile[]} tiles - Array of loaded raster array tiles to extract data from
     * @param {string[]} imageNames - Array of image names in format "layerId/bandId" to extract
     * @returns {StyleImageMap<string>} Map of image names to StyleImage objects
     */
    getImages(tiles: RasterArrayTile[], imageNames: string[]): StyleImageMap<string> {
        const styleImages = new Map<string, StyleImage>();

        for (const tile of tiles) {
            for (const name of imageNames) {
                const [layerId, bandId] = name.split('/');
                const layer = tile.getLayer(layerId);
                if (!layer) continue;
                if (!layer.hasBand(bandId) || !layer.hasDataForBand(bandId)) continue;

                const {bytes, tileSize, buffer} = layer.getBandView(bandId);
                const size = tileSize + 2 * buffer;

                const styleImage: StyleImage = {
                    data: new RGBAImage({width: size, height: size}, bytes),
                    pixelRatio: 2,
                    sdf: false,
                    usvg: false,
                    version: 0
                };

                styleImages.set(name, styleImage);
            }
        }

        return styleImages;
    }

    queryRasterArrayValueByBandId(lngLat: LngLat, tile: RasterArrayTile, params: RasterQueryParameters): Promise<RasterQueryResult> {
        const mrt = tile._mrt;
        return new Promise((resolve) => {
            const queryResult: RasterQueryResult = {};
            const fetchLayerBandsRequests = new Set<string>();

            for (const [layerName, layer] of Object.entries(mrt.layers)) {
                if (params.layerName && layerName !== params.layerName) continue;
                const entry: RasterQueryResultEntry = {};
                queryResult[layerName] = entry;
                for (const {bands} of layer.dataIndex) {
                    for (const band of bands) {
                        if (params.bands && !(params.bands).includes(band)) continue;
                        fetchLayerBandsRequests.add(makeFQID(layerName, band));
                        tile.fetchBand(layerName, null, band, (err) => {
                            browser.frame(() => {
                                if (err) {
                                    entry[band] = null;
                                } else {
                                    entry[band] = getPointLonLat([lngLat.lng, lngLat.lat], mrt, layer.getBandView(band)) as number[];
                                }
                                fetchLayerBandsRequests.delete(makeFQID(layerName, band));
                                if (fetchLayerBandsRequests.size === 0) {
                                    resolve(queryResult);
                                }
                            });
                        }, false);
                    }
                }
            }

            if (fetchLayerBandsRequests.size === 0) {
                resolve(queryResult);
            }
        });
    }

    _loadTileForQuery(tile: RasterArrayTile, callback: Callback<MapboxRasterTile>) {
        if (this._loadTileLoaded[tile.uid]) {
            callback(null, tile._mrt);
            return;
        }

        if (this._loadTilePending[tile.uid]) {
            this._loadTilePending[tile.uid].push(callback);
            return;
        }

        this._loadTilePending[tile.uid] = [callback];

        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme), false, this.tileSize);
        const request = this.map._requestManager.transformRequest(url, ResourceType.Tile);
        const requestParams: WorkerSourceRasterArrayTileRequest = {
            request,
            uid: tile.uid,
            tileID: tile.tileID,
            type: this.type,
            source: this.id,
            scope: this.scope,
            partial: false
        };

        tile.actor.send('loadTile', requestParams, (error: AJAXError | null, data?: MapboxRasterTile, cacheControl?: string, expires?: string) => {
            if (error) {
                this._loadTilePending[tile.uid].forEach(cb => cb(error, null));
                delete this._loadTilePending[tile.uid];
                return;
            }

            if (!data) {
                this._loadTilePending[tile.uid].forEach(cb => cb(null, null));
                delete this._loadTilePending[tile.uid];
                return;
            }

            if (this.map._refreshExpiredTiles && data) {
                tile.setExpiryData({cacheControl, expires});
            }

            tile._mrt = data;
            tile._isHeaderLoaded = true;
            tile.state = 'loaded';

            this._loadTilePending[tile.uid].forEach(cb => cb(null, data));
            this._loadTileLoaded[tile.uid] = true;
            delete this._loadTilePending[tile.uid];
        }, undefined, true);
    }

    queryRasterArrayValueByAllBands(lngLat: LngLat, tile: RasterArrayTile, params: RasterQueryParameters): Promise<RasterQueryResult> {
        return new Promise((resolve, reject) => {
            this._loadTileForQuery(tile, (error, data) => {
                if (error) {
                    reject(error);
                    return;
                }
                if (!data) {
                    resolve(null);
                    return;
                }

                resolve(this.queryRasterArrayValueByBandId(lngLat, tile, params));
            });
        });
    }

    queryRasterArrayValue(lngLatLike: LngLatLike, params: RasterQueryParameters): Promise<RasterQueryResult> {
        const lngLat = LngLat.convert(lngLatLike);
        const tile = this.findLoadedParent(lngLat);
        if (!tile) return Promise.resolve(null);
        const mrt = tile._mrt;
        if (!mrt) return Promise.resolve(null);

        if (params.bands || !this.partial) {
            return this.queryRasterArrayValueByBandId(lngLat, tile, params);
        } else {
            return this.queryRasterArrayValueByAllBands(lngLat, tile, params);
        }
    }

    findLoadedParent(lngLat: LngLat) {
        const point = MercatorCoordinate.fromLngLat(lngLat, this.map.transform.tileSize);
        const z = this.maxzoom + 1;
        const tiles = 1 << z;
        const wrap = Math.floor(point.x);
        const px = point.x - wrap;
        const x = Math.floor(px * tiles);
        const y = Math.floor(point.y * tiles);
        const sourceCache = this.map.style.getSourceCache(this.id);
        const tileID = new OverscaledTileID(z, wrap, z, x, y);
        return sourceCache.findLoadedParent(tileID, this.minzoom) as RasterArrayTile | null | undefined;
    }
}

export default RasterArrayTileSource;
