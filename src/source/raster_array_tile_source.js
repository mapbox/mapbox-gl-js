// @flow

import assert from 'assert';
import {getArrayBuffer, ResourceType} from '../util/ajax.js';
import Texture from '../render/texture.js';
import {extend} from '../util/util.js';
import {Evented} from '../util/evented.js';
import {OverscaledTileID} from './tile_id.js';
import RasterTileSource from './raster_tile_source.js';
import MercatorCoordinate from '../geo/mercator_coordinate.js';
import {MapboxRasterTile, MRTError} from '../data/mrt/mrt.js';

// Import MRTData as a module with side effects to ensure
// it's registered as a serializable class on the main thread
import '../data/mrt_data.js';

import type Tile from './tile.js';
import type Dispatcher from '../util/dispatcher.js';
import type {Source} from './source.js';
import type {Callback} from '../types/callback.js';
import type {LngLatLike} from '../geo/lng_lat.js';
import type {RequestParameters} from '../util/ajax.js';
import type {RasterArrayTextureDescriptor} from './tile.js';
import type {RasterArraySourceSpecification} from '../style-spec/types.js';

const FIRST_TRY_HEADER_LENGTH = 16384;
const MRT_DECODED_BAND_CACHE_SIZE = 30;

// $FlowFixMe[method-unbinding]
class RasterArrayTileSource extends RasterTileSource implements Source {
    constructor(id: string, options: RasterArraySourceSpecification, dispatcher: Dispatcher, eventedParent: Evented) {
        super(id, options, dispatcher, eventedParent);
        this.type = 'raster-array';
        this.maxzoom = 22;
        this._options = extend({type: 'raster-array'}, options);
    }

    findLoadedParent(point: MercatorCoordinate): ?Tile {
        const z = this.maxzoom + 1;
        const tiles = 1 << z;
        const wrap = Math.floor(point.x);
        const px = point.x - wrap;
        const x = Math.floor(px * tiles);
        const y = Math.floor(point.y * tiles);
        const sourceCache = this.map.style.getSourceCache(this.id);
        if (!sourceCache) return null;

        const tileID = new OverscaledTileID(z, wrap, z, x, y);
        return sourceCache.findLoadedParent(tileID, this.minzoom);
    }

    queryRasterArrayValue(lngLat: LngLatLike): ?{[string]: any} {
        const point = MercatorCoordinate.fromLngLat(lngLat);
        const tile = this.findLoadedParent(point);
        if (!tile) return null;

        const mrt = tile.mrt;
        if (!mrt) return null;

        const results = {};
        for (const [layerName, layer] of Object.entries(mrt.layers)) {
            const layerData = {};
            results[layerName] = layerData;
            // $FlowFixMe[incompatible-type]
            for (const {bands} of layer.dataIndex) {
                for (const {name: band} of bands) {
                    // $FlowFixMe[incompatible-use]
                    if (layer.hasDataForBand(band)) {
                        // $FlowFixMe[incompatible-use]
                        const {data, buffer, offset, scale, tileSize} = layer.getBandView(band);
                        const tilesAtZoom = 1 << mrt.z;
                        const x = (point.x * tilesAtZoom - mrt.x) * tileSize;
                        const y = (point.y * tilesAtZoom - mrt.y) * tileSize;
                        const i = Math.floor(x);
                        const j = Math.floor(y);
                        const idx = 4 * ((j + buffer) * (tileSize + 2 * buffer) + (i + buffer));

                        const pixel = data[idx] | (data[idx + 1] << 8) | (data[idx + 2] << 16) | (data[idx + 3] << 24);
                        const val = pixel === -1 ? 'no data' : offset + scale * pixel;

                        layerData[band] = val;
                    } else {
                        layerData[band] = 'data not loaded';
                    }
                }
            }
        }
        return results;
    }

    flushQueues(tile: Tile) {
        while (tile._workQueue.length) {
            (tile._workQueue.pop())();
        }
        while (tile._fetchQueue.length) {
            (tile._fetchQueue.pop())();
        }
    }

    loadTile(tile: Tile, callback: Callback<void>) {
        const mrt = tile.mrt = (new MapboxRasterTile(MRT_DECODED_BAND_CACHE_SIZE): $NonMaybeType<Tile['mrt']>);

        // A buffer, in case range requests were ignored
        let entireBuffer = null;

        const url = this.map._requestManager.normalizeTileURL(tile.tileID.canonical.url(this.tiles, this.scheme), false, this.tileSize);
        const requestParams = this.map._requestManager.transformRequest(url, ResourceType.Tile);

        const fetchHeader = (fetchLength: number) => {
            const headerRequestParams = Object.assign({}, requestParams, {headers: {Range: `bytes=0-${fetchLength - 1}`}});

            const dataLoaded = (error: ?Error, dataBuffer: ?ArrayBuffer, cacheControl: ?string, expires: ?string) => {
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

                try {
                    const headerLength = mrt.getHeaderLength(dataBuffer);

                    if (headerLength > fetchLength) {
                        return fetchHeader(headerLength);
                    }

                    // Parse the header only
                    mrt.parseHeader(dataBuffer);

                    // If the received data covers all possible byte ranges (i.e. if the range request was
                    // ignored by the server), then cache the buffer and neglect range requests.
                    let lastByte = 0;
                    for (const layer of Object.values(mrt.layers)) {
                        // $FlowFixMe[incompatible-use]
                        lastByte = Math.max(lastByte, layer.dataIndex[layer.dataIndex.length - 1].last_byte);
                    }

                    // $FlowFixMe[incompatible-use]
                    if (dataBuffer.byteLength >= lastByte) {
                        entireBuffer = dataBuffer;
                    }

                    tile.state = 'loaded';
                    callback(null);
                } catch (error) {
                    tile.state = 'errored';
                    callback(error);
                }
            };

            tile.request = getArrayBuffer(headerRequestParams, dataLoaded);
        };

        // $FlowFixMe[method-unbinding]
        tile.getTexture = this.getTexture.bind(this, tile, requestParams, entireBuffer);

        fetchHeader(FIRST_TRY_HEADER_LENGTH);
    }

    getTexture(tile: Tile, requestParams: RequestParameters, entireBuffer: ?ArrayBuffer, layerName: ?string, band: string | number | void, filtering: ?string): ?RasterArrayTextureDescriptor {
        const mrt = tile.mrt;
        if (!mrt) return null;

        const sourceCache = this.map.style.getSourceCache(this.id);

        const repaint = () => {
            const terrain = this.map.painter._terrain;
            if (terrain && terrain.enabled && sourceCache) {
                terrain._clearRenderCacheForTile(sourceCache.id, tile.tileID);
            }
            this.map.triggerRepaint();
        };

        const getBandData = (layerName: string, band: string | number, callback: Callback<void>) => {
            let layer, range, task;
            try {
                layer = mrt.getLayer(layerName);

                if (layer.hasDataForBand(band)) {
                    callback(null, layer.getBandView(band));
                }

                range = layer.getDataRange([band]);
                task = mrt.createDecodingTask(range);

                if (!task.tasks.length) {
                    return;
                }

                // Stop existing fetches
                this.flushQueues(tile);
            } catch (error) {
                if (!(error instanceof MRTError)) throw error;
                return {};
            }

            const onDataDecoded = (err: ?Error, result: any) => {
                task.complete(err, result);
                callback(null, layer.getBandView(band));
            };

            const onDataLoaded = (err: ?Error, buffer: ?ArrayBuffer) => {
                if (err) {
                    tile.state = 'errored';
                    return callback(err);
                }

                assert(task.tasks.length, 'Impossible state');
                if (!tile.actor) tile.actor = this.dispatcher.getActor();

                const params = {
                    uid: tile.uid,
                    coord: tile.tileID,
                    source: this.id,
                    buffer,
                    task,
                };

                const workerJob = tile.actor.send('decodeRasterArray', params, onDataDecoded, undefined, true);

                tile._workQueue.push(() => {
                    if (workerJob) workerJob.cancel();
                    task.cancel();
                });
            };

            if (entireBuffer) {
                // eslint-disable-next-line no-warning-comments
                // TODO: can we decode without slicing and duplicating memory?
                onDataLoaded(null, entireBuffer.slice(range.firstByte, range.lastByte + 1));
            } else {
                const rangeRequestParams = Object.assign({}, requestParams, {headers: {Range: `bytes=${range.firstByte}-${range.lastByte}`}});
                const request = getArrayBuffer(rangeRequestParams, onDataLoaded);

                tile._fetchQueue.push(() => {
                    request.cancel();
                    task.cancel();
                });
            }
        };

        // If not loaded, bail out of rendering. Repaint on reload is handled by appropriate callbacks.
        if (!mrt || Number.isNaN(mrt.x) || !layerName) return null;

        try {
            const mrtLayer = mrt.getLayer(layerName);

            // $FlowFixMe[incompatible-type]
            band = band || 0;

            if (!mrtLayer || !mrtLayer.hasBand(band)) {
                tile.state = 'errored';
                return null;
            }

            const context = this.map.painter.context;
            const gl = context.gl;

            let desc = tile.rasterArrayTextureDescriptor;
            const needsUpdate = !desc || desc.layer !== layerName || desc.band !== band;

            if (!needsUpdate) {
                return desc;
            }

            // If there is no data for the band, fetch it and repaint once data is acquired
            if (needsUpdate && !mrtLayer.hasDataForBand(band)) {
                // Fetch and then blindly repaint once data is acquired
                tile.state = 'reloading';

                getBandData(layerName, band, (error, _bandView) => {
                    if (error) {
                        tile.state = 'errored';
                        return;
                    }

                    tile.state = 'loaded';
                    repaint();
                });

                return desc || null;
            }

            const {bytes, tileSize, buffer, offset, scale} = mrtLayer.getBandView(band);

            const size = tileSize + 2 * buffer;
            const img = {
                data: bytes,
                width: size,
                height: size,
            };

            if (desc && desc.texture) {
                desc.texture.update(img, {useMipmap: false, premultiply: false});
            } else {
                desc = (({
                    texture: new Texture(context, img, gl.RGBA, {useMipmap: false, premultiply: false}),
                    layer: layerName,
                    band,
                }: any): RasterArrayTextureDescriptor);

                tile.rasterArrayTextureDescriptor = desc;

                // $FlowFixMe[incompatible-use]
                // $FlowFixMe[incompatible-call]
                desc.texture.bind(filtering, gl.CLAMP_TO_EDGE);

                if (context.extTextureFilterAnisotropic) {
                    gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, context.extTextureFilterAnisotropicMax);
                }
            }

            desc.layer = layerName;
            desc.band = band;
            desc.mix = [
                scale,
                scale * 256,
                scale * 65536,
                scale * 16777216,
            ];
            desc.offset = offset;
            desc.tileSize = tileSize;
            desc.buffer = buffer;

            return tile.rasterArrayTextureDescriptor;
        } catch (error) {
            if (!(error instanceof MRTError)) throw error;
            return null;
        }
    }

    // $FlowFixMe[method-unbinding]
    unloadTile(tile: Tile) {
        if (tile.rasterArrayTextureDescriptor && tile.rasterArrayTextureDescriptor.texture) {
            this.map.painter.saveTileTexture(tile.rasterArrayTextureDescriptor.texture);
        }
        tile.rasterArrayTextures = null;
        if (tile.fbo) {
            tile.fbo.destroy();
            delete tile.fbo;
        }
        if (tile.mrt) delete tile.mrt;
        delete tile.neighboringTiles;

        tile.state = 'unloaded';
    }
}

export default RasterArrayTileSource;
