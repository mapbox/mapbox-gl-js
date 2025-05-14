import Texture from '../render/texture';
import RasterTileSource from './raster_tile_source';
import {extend} from '../util/util';
import {RGBAImage} from '../util/image';
import {ErrorEvent} from '../util/evented';
import {ResourceType} from '../util/ajax';
import RasterStyleLayer from '../style/style_layer/raster_style_layer';
import RasterParticleStyleLayer from '../style/style_layer/raster_particle_style_layer';
// Import MRTData as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import '../data/mrt_data';

import type Dispatcher from '../util/dispatcher';
import type RasterArrayTile from './raster_array_tile';
import type {Map as MapboxMap} from '../ui/map';
import type {Evented} from '../util/evented';
import type {Callback} from '../types/callback';
import type {AJAXError} from '../util/ajax';
import type {MapboxRasterTile} from '../data/mrt/mrt.esm.js';
import type {TextureDescriptor} from './raster_array_tile';
import type {StyleImage, StyleImageMap} from '../style/style_image';
import type {RasterArraySourceSpecification} from '../style-spec/types';
import type {WorkerSourceRasterArrayTileRequest} from './worker_source';

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

            if (this.partial) {
                tile.state = 'empty';
            } else {
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
        const texture = tile.texture;
        if (texture && texture instanceof Texture) {
            // Clean everything else up owned by the tile, but preserve the texture.
            // Destroy first to prevent racing with the texture cache being popped.
            tile.destroy(true);

            // Save the texture to the cache
            this.map.painter.saveTileTexture(texture);
        } else {
            tile.destroy();
            tile.flushQueues();
            tile._isHeaderLoaded = false;

            delete tile._mrt;
            delete tile.textureDescriptor;
        }

        if (tile.fbo) {
            tile.fbo.destroy();
            delete tile.fbo;
        }

        delete tile.request;
        delete tile.requestParams;

        delete tile.neighboringTiles;
        tile.state = 'unloaded';
    }

    /**
     * Prepare RasterArrayTile for the rendering. If tile doesn't have data
     * for the requested band, fetch and repaint once it's acquired.
     * @private
     */
    prepareTile(tile: RasterArrayTile, sourceLayer: string, band: string | number) {
        // Skip if tile is not yet loaded or if no update is needed
        if (!tile._isHeaderLoaded) return;

        // Don't mark tile as reloading if it was empty.
        if (tile.state !== 'empty') tile.state = 'reloading';

        // Fetch data for band and then repaint once data is acquired.
        tile.fetchBand(sourceLayer, band, (error, data) => {
            if (error) {
                tile.state = 'errored';
                this.fire(new ErrorEvent(error));
                this.triggerRepaint(tile);
                return;
            }

            if (data) {
                tile._isHeaderLoaded = true;
                tile.setTexture(data, this.map.painter);
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

        if (!tile.textureDescriptor) {
            this.prepareTile(tile, sourceLayer, band);
            return;
        }

        // Fallback to previous texture even if update is needed
        if (tile.updateNeeded(sourceLayer, band) && !fallbackToPrevious) return;

        return Object.assign({}, tile.textureDescriptor, {texture: tile.texture});
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
}

export default RasterArrayTileSource;
