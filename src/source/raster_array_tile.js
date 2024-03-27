// @flow

import Tile from './tile.js';
import Texture from '../render/texture.js';
import {getArrayBuffer} from '../util/ajax.js';
import {MapboxRasterTile} from '../data/mrt/mrt.js';

import type Painter from '../render/painter.js';
import type Framebuffer from '../gl/framebuffer.js';
import type {Callback} from '../types/callback.js';
import type {Cancelable} from '../types/cancelable.js';
import type {TextureImage} from '../render/texture.js';
import type {OverscaledTileID} from './tile_id.js';
import type {RequestParameters, ResponseCallback} from '../util/ajax.js';

export type TextureDescriptor = {
    img: TextureImage,
    layer: string,
    band: string | number,
    tileSize: number,
    buffer: number,
    mix: [number, number, number, number],
    offset: number,
    format?: 'uint8' | 'uint16' | 'uint32',
};

export type MRTLayer = {
    version: number;
    name: string;
    units: string;
    tilesize: number;
    buffer: number;
    pixelFormat: 'uint8' | 'uint16' | 'uint32';
    dataIndex: {[string | number]: any};
    hasBand: (string | number) => boolean;
    hasDataForBand: (string | number) => boolean;
    getDataRange: (Array<string | number>) => MRTDataRange;
    getBandView: (string | number) => MRTBandView;
}

export type MRTBandView = {
    data: any,
    bytes: any,
    tileSize: number,
    buffer: number,
    offset: number,
    scale: number,
};

export type MRTDataRange = {
    layerName: string;
    firstByte: number;
    lastByte: number;
    firstBlock: number;
    lastBlock: number;
};

export type MRTDecodingBatch = {
    tasks: Array<MRTDecodingTask>;
    cancel: () => void;
    complete: (?Error, ?ArrayBuffer) => void;
};

export type MRTDecodingTask = {
    layerName: string;
    firstByte: number;
    lastByte: number;
    pixelFormat: 'uint8' | 'uint16' | 'uint32';
    blockIndex: number;
    blockShape: Array<number>;
    buffer: number;
    codec: string;
    filters: Array<string>;
};

export type MRT = {
    x: number;
    y: number;
    z: number;
    _cacheSize: number;

    layers: {[_: string]: MRTLayer};
    getLayer(string): ?MRTLayer;
    parseHeader(ArrayBuffer): MRT;
    getHeaderLength(ArrayBuffer): number;
    createDecodingTask(MRTDataRange): MRTDecodingBatch;
};

const FIRST_TRY_HEADER_LENGTH = 16384;
const MRT_DECODED_BAND_CACHE_SIZE = 30;

class RasterArrayTile extends Tile {
    // $FlowFixMe[incompatible-extend]
    texture: ?Texture;
    entireBuffer: ?ArrayBuffer;
    requestParams: ?RequestParameters;

    _workQueue: Array<() => void>;
    _fetchQueue: Array<() => void>;

    fbo: ?Framebuffer;
    textureDescriptor: ?TextureDescriptor;

    _mrt: ?MRT;
    _isHeaderLoaded: boolean;

    constructor(tileID: OverscaledTileID, size: number, tileZoom: number, painter: ?Painter, isRaster?: boolean) {
        super(tileID, size, tileZoom, painter, isRaster);

        this._workQueue = [];
        this._fetchQueue = [];
        this._isHeaderLoaded = false;
    }

    setTexture(img: TextureImage, painter: Painter) {
        const context = painter.context;
        const gl = context.gl;
        this.texture = this.texture || painter.getTileTexture(img.width);

        if (this.texture && this.texture instanceof Texture) {
            this.texture.update(img, {useMipmap: false, premultiply: false});
        } else {
            this.texture = new Texture(context, img, gl.RGBA, {useMipmap: false, premultiply: false});
        }
    }

    /**
     * Stops existing fetches
     * @private
     */
    flushQueues() {
        while (this._workQueue.length) {
            (this._workQueue.pop())();
        }

        while (this._fetchQueue.length) {
            (this._fetchQueue.pop())();
        }
    }

    fetchHeader(fetchLength: number = FIRST_TRY_HEADER_LENGTH, callback: ResponseCallback<?ArrayBuffer>): Cancelable {
        const mrt = this._mrt = new MapboxRasterTile(MRT_DECODED_BAND_CACHE_SIZE);

        const headerRequestParams = Object.assign({}, this.requestParams, {headers: {Range: `bytes=0-${fetchLength - 1}`}});

        // A buffer, in case range requests were ignored
        this.entireBuffer = null;

        this.request = getArrayBuffer(headerRequestParams, (error: ?Error, dataBuffer: ?ArrayBuffer, cacheControl: ?string, expires: ?string) => {
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
                    // $FlowFixMe[incompatible-use]
                    lastByte = Math.max(lastByte, layer.dataIndex[layer.dataIndex.length - 1].last_byte);
                }

                // $FlowFixMe[incompatible-use]
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

    fetchBand(sourceLayer: string, band: string | number, callback: Callback<?TextureImage>) {
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
        let task;

        const onDataDecoded = (err: ?Error, result: ?ArrayBuffer) => {
            task.complete(err, result);
            if (err) {
                callback(err);
                return;
            }

            this.updateTextureDescriptor(sourceLayer, band);
            callback(null, this.textureDescriptor && this.textureDescriptor.img);
        };

        const onDataLoaded = (err: ?Error, buffer: ?ArrayBuffer) => {
            if (err) return callback(err);

            const params = {buffer, task};
            const workerJob = actor.send('decodeRasterArray', params, onDataDecoded, undefined, true);

            this._workQueue.push(() => {
                if (workerJob) workerJob.cancel();
                task.cancel();
            });
        };

        const mrtLayer = mrt.getLayer(sourceLayer);
        if (!mrtLayer) {
            callback(new Error(`Unknown sourceLayer "${sourceLayer}"`));
            return;
        }

        if (mrtLayer.hasDataForBand(band)) {
            this.updateTextureDescriptor(sourceLayer, band);
            callback(null, this.textureDescriptor ? this.textureDescriptor.img : null);
            return;
        }

        const range = mrtLayer.getDataRange([band]);
        task = mrt.createDecodingTask(range);

        // The MRT instance will not return work for a task which has already been checked
        // out but not completed. If the resulting task has no work, we presume it is in
        // progress. (This makes it very important to correctly cancel aborted decoding tasks.)
        if (task && !task.tasks.length) {
            callback(null);
            return;
        }

        // Stop existing fetches and decodes
        this.flushQueues();

        if (this.entireBuffer) {
            // eslint-disable-next-line no-warning-comments
            // TODO: can we decode without slicing and duplicating memory?
            onDataLoaded(null, this.entireBuffer.slice(range.firstByte, range.lastByte + 1));
        } else {
            const rangeRequestParams = Object.assign({}, this.requestParams, {headers: {Range: `bytes=${range.firstByte}-${range.lastByte}`}});
            const request = getArrayBuffer(rangeRequestParams, onDataLoaded);
            this._fetchQueue.push(() => {
                request.cancel();
                task.cancel();
            });
        }
    }

    updateNeeded(sourceLayer: string, band: string | number): boolean {
        const textureUpdateNeeded = !this.textureDescriptor ||
            this.textureDescriptor.band !== band ||
            this.textureDescriptor.layer !== sourceLayer;

        return textureUpdateNeeded && this.state !== 'errored';
    }

    updateTextureDescriptor(sourceLayer: string, band: string | number): void {
        if (!this._mrt) return;

        const mrtLayer = this._mrt.getLayer(sourceLayer);
        if (!mrtLayer || !mrtLayer.hasBand(band) || !mrtLayer.hasDataForBand(band)) return;

        const {bytes, tileSize, buffer, offset, scale} = mrtLayer.getBandView(band);
        const size = tileSize + 2 * buffer;
        const img = {data: bytes, width: size, height: size};

        const texture = this.texture;
        if (texture && texture instanceof Texture) {
            texture.update(img, {useMipmap: false, premultiply: false});
        }

        this.textureDescriptor = {
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
        };
    }
}

export default RasterArrayTile;
