import Pbf from 'pbf';
import Tile from './tile';
import Texture from '../render/texture';
import {RGBAImage} from '../util/image';
import {getArrayBuffer} from '../util/ajax';
import {makeFQID} from '../util/fqid';
import {MapboxRasterTile} from '../data/mrt/mrt.esm.js';

import type Painter from '../render/painter';
import type Framebuffer from '../gl/framebuffer';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';
import type {TextureImage} from '../render/texture';
import type {TDecodingResult} from '../data/mrt/types';
import type {OverscaledTileID} from './tile_id';
import type {RequestParameters, ResponseCallback} from '../util/ajax';
import type {MapboxRasterLayer, MRTDecodingBatch} from '../data/mrt/mrt.esm.js';

MapboxRasterTile.setPbf(Pbf);

export type TextureDescriptor = {
    img: TextureImage;
    layer: string;
    band: string | number;
    tileSize: number;
    buffer: number;
    mix: [number, number, number, number];
    offset: number;
    format?: 'uint8' | 'uint16' | 'uint32';
};

const FIRST_TRY_HEADER_LENGTH = 16384;
const MRT_DECODED_BAND_CACHE_SIZE = 30;

class RasterArrayTile extends Tile implements Tile {
    entireBuffer: ArrayBuffer | null | undefined;
    requestParams: RequestParameters | null | undefined;

    _workQueuePerLayer: Map<string | symbol, Array<() => void>>;
    _fetchQueuePerLayer: Map<string | symbol, Array<() => void>>;
    _taskQueue: Map<string | symbol, Set<Callback<TDecodingResult[] | null | undefined>>>;

    fbo: Framebuffer | null | undefined;
    textureDescriptorPerLayer: Map<string, TextureDescriptor | null | undefined>;
    texturePerLayer: Map<string, Texture | null | undefined>;
    textureSourceLayer: string | null | undefined;

    source?: string;
    scope?: string;

    _mrt: MapboxRasterTile | null | undefined;
    _isHeaderLoaded: boolean;

    constructor(tileID: OverscaledTileID, size: number, tileZoom: number, painter?: Painter | null, isRaster?: boolean) {
        super(tileID, size, tileZoom, painter, isRaster);

        this._workQueuePerLayer = new Map();
        this._fetchQueuePerLayer = new Map();
        this._taskQueue = new Map();
        this._isHeaderLoaded = false;
        this.textureDescriptorPerLayer = new Map();
        this.texturePerLayer = new Map();
    }

    /**
     * Returns a map of all layers in the raster array tile.
     * @returns {Record<string, MapboxRasterLayer>}
     * @private
     */
    getLayers(): MapboxRasterLayer[] {
        return this._mrt ? Object.values(this._mrt.layers) : [];
    }

    /**
     * Returns a layer in the raster array tile.
     * @param {string} layerId
     * @returns {MapboxRasterLayer | null | undefined}
     * @private
     */
    getLayer(layerId: string): MapboxRasterLayer | null | undefined {
        return this._mrt && this._mrt.getLayer(layerId);
    }

    /**
     * @private
     */
    setTexturePerLayer(sourceLayer: string, img: TextureImage, painter: Painter) {
        const context = painter.context;
        const gl = context.gl;
        let texture = this.texturePerLayer.get(sourceLayer) || painter.getTileTexture(img.width);

        if (texture && texture instanceof Texture) {
            texture.update(img, {premultiply: false});
        } else {
            texture = new Texture(context, img, gl.RGBA8, {premultiply: false});
        }

        if (!this.texturePerLayer.has(sourceLayer)) {
            this.texturePerLayer.set(sourceLayer, texture);
        }
    }

    /**
     * Stops existing fetches
     * @private
     */
    flushQueues(sourceLayer: string | symbol) {
        const workQueue = this._workQueuePerLayer.get(sourceLayer) || [];
        const fetchQueue = this._fetchQueuePerLayer.get(sourceLayer) || [];

        while (workQueue.length) {
            (workQueue.pop())();
        }

        while (fetchQueue.length) {
            (fetchQueue.pop())();
        }
    }

    /**
     * @private
     */
    flushAllQueues() {
        for (const sourceLayer of this._workQueuePerLayer.keys()) {
            const workQueue = this._workQueuePerLayer.get(sourceLayer) || [];
            while (workQueue.length) {
                (workQueue.pop())();
            }
        }

        for (const sourceLayer of this._fetchQueuePerLayer.keys()) {
            const fetchQueue = this._fetchQueuePerLayer.get(sourceLayer) || [];
            while (fetchQueue.length) {
                (fetchQueue.pop())();
            }
        }
    }

    fetchHeader(
        fetchLength: number | null | undefined = FIRST_TRY_HEADER_LENGTH,
        callback: ResponseCallback<ArrayBuffer | null | undefined>,
    ): Cancelable {
        const mrt = this._mrt = new MapboxRasterTile(MRT_DECODED_BAND_CACHE_SIZE);

        const headerRequestParams = Object.assign({}, this.requestParams, {headers: {Range: `bytes=0-${fetchLength - 1}`}});

        // A buffer, in case range requests were ignored
        this.entireBuffer = null;

        this.request = getArrayBuffer(headerRequestParams, (error?: Error | null, dataBuffer?: ArrayBuffer | null, cacheControl?: string | null, expires?: string | null) => {
            if (error) {
                callback(error);
                return;
            }

            try {
                const headerLength = mrt.getHeaderLength(dataBuffer);
                if (headerLength > fetchLength) {
                    this.request = this.fetchHeader(headerLength, callback);
                    return;
                }

                // Parse the header only
                mrt.parseHeader(dataBuffer);
                this._isHeaderLoaded = true;

                // If the received data covers all possible byte ranges (i.e. if the range request was
                // ignored by the server), then cache the buffer and neglect range requests.
                let lastByte = 0;
                for (const layer of Object.values(mrt.layers)) {
                    lastByte = Math.max(lastByte, layer.dataIndex[layer.dataIndex.length - 1].lastByte);
                }

                if (dataBuffer.byteLength >= lastByte) {
                    this.entireBuffer = dataBuffer;
                }

                callback(null, (this.entireBuffer || dataBuffer), cacheControl, expires);
            } catch (error) {
                callback(error);
            }
        });

        return this.request;
    }

    fetchBandForRender(sourceLayer: string, layerId: string, band: string | number, callback: Callback<TextureImage | null | undefined>) {
        this.fetchBand(sourceLayer, layerId, band, (err) => {
            if (err) {
                callback(err);
                return;
            }

            this.updateTextureDescriptor(sourceLayer, layerId, band);

            const textureDescriptor = this.textureDescriptorPerLayer.get(layerId);
            callback(null, textureDescriptor ? textureDescriptor.img : null);
        });
    }

    fetchBand(sourceLayer: string, layerId: string | null, band: string | number, callback: Callback<TDecodingResult[] | null | undefined>, cancelable: boolean = true): Cancelable {
        // If header is not loaded, bail out of rendering.
        // Repaint on reload is handled by appropriate callbacks.
        const mrt = this._mrt;
        if (!this._isHeaderLoaded || !mrt) {
            callback(new Error('Tile header is not ready'));
            return;
        }

        const actor = this.actor;
        if (!actor) {
            callback(new Error('Can\'t fetch tile band without an actor'));
            return;
        }

        // eslint-disable-next-line prefer-const
        let task: MRTDecodingBatch;

        const taskQueueId = makeFQID(String(band), makeFQID(this.tileID.key, sourceLayer));

        let taskInQueue = this._taskQueue.get(taskQueueId);

        if (!taskInQueue) {
            taskInQueue = new Set();
            taskInQueue.add(callback);
            this._taskQueue.set(taskQueueId, taskInQueue);
        } else {
            taskInQueue.add(callback);
        }

        const onDataDecoded = (err?: Error | null, result?: TDecodingResult[]) => {
            task.complete(err, result);
            if (err) {
                callback(err);
                return;
            }

            taskInQueue.values().forEach((cb) => cb(null, result));
            this._taskQueue.delete(taskQueueId);
        };

        const onDataLoaded = (err?: Error | null, buffer?: ArrayBuffer | null) => {
            if (err) return callback(err);

            const params = {
                type: 'raster-array',
                source: this.source,
                scope: this.scope,
                tileID: this.tileID,
                uid: this.uid,
                buffer,
                task
            };

            const workerJob = actor.send('decodeRasterArray', params, onDataDecoded, undefined, true);

            if (layerId !== null) {
                const workQueue = this._workQueuePerLayer.get(layerId) || [];

                workQueue.push(() => {
                    if (workerJob) workerJob.cancel();
                    task.cancel();
                });

                if (!this._workQueuePerLayer.has(layerId)) {
                    this._workQueuePerLayer.set(layerId, workQueue);
                }
            }
        };

        const mrtLayer = mrt.getLayer(sourceLayer);
        if (!mrtLayer) {
            callback(new Error(`Unknown sourceLayer "${sourceLayer}"`));
            return;
        }

        if (mrtLayer.hasDataForBand(band)) {
            taskInQueue.values().forEach((cb) => cb(null, null));
            this._taskQueue.delete(taskQueueId);
            return;
        }

        const range = mrtLayer.getDataRange([band]);
        task = mrt.createDecodingTask(range);

        // The MRT instance will not return work for a task which has already been checked
        // out but not completed. If the resulting task has no work, we presume it is in
        // progress. (This makes it very important to correctly cancel aborted decoding tasks.)
        if (task && !task.tasks.length) {
            return;
        }

        // Stop existing fetches and decodes
        if (layerId !== null) {
            this.flushQueues(layerId);
        }

        if (this.entireBuffer) {
            // eslint-disable-next-line no-warning-comments
            // TODO: can we decode without slicing and duplicating memory?
            onDataLoaded(null, this.entireBuffer.slice(range.firstByte, range.lastByte + 1));
        } else {
            const rangeRequestParams = Object.assign({}, this.requestParams, {headers: {Range: `bytes=${range.firstByte}-${range.lastByte}`}});
            const request = getArrayBuffer(rangeRequestParams, onDataLoaded);

            if (layerId !== null) {
                const fetchQueue = this._fetchQueuePerLayer.get(layerId) || [];
                fetchQueue.push(() => {
                    request.cancel();
                    task.cancel();
                });
                if (!this._fetchQueuePerLayer.has(layerId)) {
                    this._fetchQueuePerLayer.set(layerId, fetchQueue);
                }
            }
        }
    }

    updateNeeded(layerId: string, band: string | number): boolean {
        const textureUpdateNeeded = !this.textureDescriptorPerLayer.get(layerId) ||
            this.textureDescriptorPerLayer.get(layerId).band !== band ||
            this.refreshedUponExpiration;

        return textureUpdateNeeded && this.state !== 'errored';
    }

    updateTextureDescriptor(sourceLayer: string, layerId: string, band: string | number): void {
        if (!this._mrt) return;

        const mrtLayer = this._mrt.getLayer(sourceLayer);
        if (!mrtLayer || !mrtLayer.hasBand(band) || !mrtLayer.hasDataForBand(band)) return;

        const {bytes, tileSize, buffer, offset, scale} = mrtLayer.getBandView(band);
        const size = tileSize + 2 * buffer;
        const img = new RGBAImage({width: size, height: size}, bytes);

        const texture = this.texturePerLayer.get(layerId);
        if (texture && texture instanceof Texture) {
            texture.update(img, {premultiply: false});
        }

        this.textureDescriptorPerLayer.set(layerId, {
            layer: sourceLayer,
            band,
            img,
            buffer,
            offset,
            tileSize,
            format: mrtLayer.pixelFormat,
            mix: [
                scale,
                scale * 256,
                scale * 65536,
                scale * 16777216,
            ]
        });
    }

    override destroy(preserveTexture: boolean = false): void {
        super.destroy(preserveTexture);

        delete this._mrt;

        if (!preserveTexture) {
            for (const texture of this.texturePerLayer.values()) {
                if (texture && texture instanceof Texture) {
                    texture.destroy();
                }
            }
        }

        this.texturePerLayer.clear();
        this.textureDescriptorPerLayer.clear();

        if (this.fbo) {
            this.fbo.destroy();
            delete this.fbo;
        }

        delete this.request;
        delete this.requestParams;

        this._isHeaderLoaded = false;
    }

}

export default RasterArrayTile;
