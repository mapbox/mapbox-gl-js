// @flow

import Texture from '../render/texture.js';
import RasterTileSource from './raster_tile_source.js';
import {extend} from '../util/util.js';
import {ResourceType} from '../util/ajax.js';
import {Evented, ErrorEvent} from '../util/evented.js';
import RasterStyleLayer from '../style/style_layer/raster_style_layer.js';
import RasterParticleStyleLayer from '../style/style_layer/raster_particle_style_layer.js';

// Import MRTData as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import '../data/mrt_data.js';

import type Map from '../ui/map.js';
import type Dispatcher from '../util/dispatcher.js';
import type RasterArrayTile from './raster_array_tile.js';
import type {Callback} from '../types/callback.js';
import type {TextureDescriptor} from './raster_array_tile.js';
import type {Source, SourceRasterLayer} from './source.js';
import type {RasterArraySourceSpecification} from '../style-spec/types.js';

// $FlowFixMe[method-unbinding]
class RasterArrayTileSource extends RasterTileSource implements Source {
    map: Map;
    rasterLayers: Array<SourceRasterLayer> | void;
    rasterLayerIds: Array<string> | void;

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

    // $FlowFixMe[incompatible-type]
    // $FlowFixMe[incompatible-extend]
    loadTile(tile: RasterArrayTile, callback: Callback<void>) {
        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme), false, this.tileSize);
        const requestParams = this.map._requestManager.transformRequest(url, ResourceType.Tile);

        tile.requestParams = requestParams;
        if (!tile.actor) tile.actor = this.dispatcher.getActor();

        tile.request = tile.fetchHeader(undefined, (error: ?Error, dataBuffer: ?ArrayBuffer, cacheControl: ?string, expires: ?string) => {
            delete tile.request;

            if (tile.aborted) {
                tile.state = 'unloaded';
                return callback(null);
            }

            if (error) {
                // silence AbortError
                // $FlowFixMe[prop-missing]
                if (error.code === 20) return;
                tile.state = 'errored';
                return callback(error);
            }

            if (this.map._refreshExpiredTiles) tile.setExpiryData({cacheControl, expires});

            tile.state = 'empty';
            callback(null);
        });
    }

    // $FlowFixMe[method-unbinding]
    // $FlowFixMe[incompatible-type]
    // $FlowFixMe[incompatible-extend]
    unloadTile(tile: RasterArrayTile) {
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
    getTextureDescriptor(tile: RasterArrayTile, layer: RasterStyleLayer | RasterParticleStyleLayer, fallbackToPrevious: boolean): TextureDescriptor & {texture: ?Texture} | void {
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
