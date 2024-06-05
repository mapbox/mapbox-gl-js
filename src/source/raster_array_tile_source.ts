import Texture from '../render/texture';
import RasterTileSource from './raster_tile_source';
import {extend} from '../util/util';
import {ResourceType} from '../util/ajax';
import {Evented, ErrorEvent} from '../util/evented';
import RasterStyleLayer from '../style/style_layer/raster_style_layer';
import RasterParticleStyleLayer from '../style/style_layer/raster_particle_style_layer';

// Import MRTData as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import '../data/mrt_data';

import type Tile from './tile';
import type {Map} from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type RasterArrayTile from './raster_array_tile';
import type {Callback} from '../types/callback';
import type {TextureDescriptor} from './raster_array_tile';
import type {ISource, SourceRasterLayer} from './source';
import type {RasterArraySourceSpecification} from '../style-spec/types';

class RasterArrayTileSource extends RasterTileSource implements ISource {
    map: Map;
    rasterLayers: Array<SourceRasterLayer> | undefined;
    rasterLayerIds: Array<string> | undefined;

    constructor(id: string, options: RasterArraySourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'raster-array';
        this.maxzoom = 22;
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

    loadTile(tile: Tile, callback: Callback<undefined>) {
        tile = (tile as RasterArrayTile);

        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme), false, this.tileSize);
        // @ts-expect-error - TS2345 - Argument of type 'string' is not assignable to parameter of type '"Unknown" | "Style" | "Source" | "Tile" | "Glyphs" | "SpriteImage" | "SpriteJSON" | "Image" | "Model"'.
        const requestParams = this.map._requestManager.transformRequest(url, ResourceType.Tile);

        // @ts-expect-error - TS2339 - Property 'requestParams' does not exist on type 'Tile'.
        tile.requestParams = requestParams;
        if (!tile.actor) tile.actor = this.dispatcher.getActor();

        // @ts-expect-error - TS2339 - Property 'fetchHeader' does not exist on type 'Tile'.
        tile.request = tile.fetchHeader(undefined, (error?: Error | null, dataBuffer?: ArrayBuffer | null, cacheControl?: string | null, expires?: string | null) => {
            delete tile.request;

            if (tile.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }

            if (error) {
                // silence AbortError
                // @ts-expect-error - TS2339 - Property 'code' does not exist on type 'Error'.
                if (error.code === 20)
                    return;
                tile.state = 'errored';
                return callback(error);
            }

            if (this.map._refreshExpiredTiles) tile.setExpiryData({cacheControl, expires});

            tile.state = 'empty';
            callback(null);
        });
    }

    unloadTile(tile: Tile, _?: Callback<undefined> | null) {
        tile = (tile as RasterArrayTile);

        const texture = tile.texture;
        if (texture && texture instanceof Texture) {
            // Clean everything else up owned by the tile, but preserve the texture.
            // Destroy first to prevent racing with the texture cache being popped.
            tile.destroy(true);

            // Save the texture to the cache
            this.map.painter.saveTileTexture(texture);
        } else {
            tile.destroy();

            // @ts-expect-error - TS2339 - Property 'flushQueues' does not exist on type 'Tile'.
            tile.flushQueues();
            // @ts-expect-error - TS2339 - Property '_isHeaderLoaded' does not exist on type 'Tile'.
            tile._isHeaderLoaded = false;

            // @ts-expect-error - TS2339 - Property '_mrt' does not exist on type 'Tile'.
            delete tile._mrt;
            // @ts-expect-error - TS2339 - Property 'textureDescriptor' does not exist on type 'Tile'.
            delete tile.textureDescriptor;
        }

        // @ts-expect-error - TS2339 - Property 'fbo' does not exist on type 'Tile'.
        if (tile.fbo) {
            // @ts-expect-error - TS2339 - Property 'fbo' does not exist on type 'Tile'.
            tile.fbo.destroy();
            // @ts-expect-error - TS2339 - Property 'fbo' does not exist on type 'Tile'.
            delete tile.fbo;
        }

        delete tile.request;
        // @ts-expect-error - TS2339 - Property 'requestParams' does not exist on type 'Tile'.
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
    getInitialBand(sourceLayer: string): string | number | void {
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
    ): TextureDescriptor & {
        texture: Texture | null | undefined;
    } | void {
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
}

export default RasterArrayTileSource;
