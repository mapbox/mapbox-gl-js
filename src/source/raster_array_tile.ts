import {PbfReader} from 'pbf';
import Tile from './tile';
import Texture from '../render/texture';
import {RGBAImage} from '../util/image';
import {getArrayBuffer} from '../util/ajax';
import {makeFQID} from '../util/fqid';
import {registerRasterArrayTile} from './raster_array_plugin';
import {MapboxRasterTile} from '../data/mrt/mrt.esm.js';
import {crop, computeOverzoomCoords} from '../data/mrt/overzoom_util';

import type Painter from '../render/painter';
import type Framebuffer from '../gl/framebuffer';
import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';
import type {TextureImage} from '../render/texture';
import type {TDecodingResult} from '../data/mrt/types';
import type {OverscaledTileID} from './tile_id';
import type {RequestParameters, ResponseCallback} from '../util/ajax';
import type {MapboxRasterLayer, MRTDecodingBatch} from '../data/mrt/mrt.esm.js';

MapboxRasterTile.setPbf(PbfReader);

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

type OverzoomCoords = {offset: [number, number]; tileSize: number; deltaZ: number};

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

    // Set by RasterArrayTileSource; resolves once workers have preloaded the MRT decoder.
    workerReady?: Promise<void>;

    _mrt: MapboxRasterTile | null | undefined;
    _isHeaderLoaded: boolean;

    // Set on tiles whose `loadTile` is in progress through the synthetic overzoom path
    // (no actor/worker). Used to dedup re-entrant `loadTile` calls.
    _isLoadInProgress: boolean;

    // For overzoomed tiles, points to the root data tile whose MRT data is reused.
    // `overzoomCoordsPerLayer` describes which pixel region of the parent maps to
    // this tile, keyed by layer name. Each layer can have its own `tileSize`, so
    // the crop region differs per layer (matches @mapbox/mrt-overzoom's flow).
    parentTile: RasterArrayTile | null;
    overzoomCoordsPerLayer: Map<string, OverzoomCoords> | null;

    constructor(tileID: OverscaledTileID, size: number, tileZoom: number, painter?: Painter | null, isRaster?: boolean) {
        super(tileID, size, tileZoom, painter, isRaster);

        this._workQueuePerLayer = new Map();
        this._fetchQueuePerLayer = new Map();
        this._taskQueue = new Map();
        this._isHeaderLoaded = false;
        this._isLoadInProgress = false;
        this.textureDescriptorPerLayer = new Map();
        this.texturePerLayer = new Map();
        this.parentTile = null;
        this.overzoomCoordsPerLayer = null;
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
            // Use linear filtering and clamp to edge to avoid tile boundary artifacts
            texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
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
    ): AbortController {
        const mrt = this._mrt = new MapboxRasterTile(MRT_DECODED_BAND_CACHE_SIZE);

        const headerRequestParams = {...this.requestParams, headers: {Range: `bytes=0-${fetchLength - 1}`}};

        // A buffer, in case range requests were ignored
        this.entireBuffer = null;

        const controller = new AbortController();
        this.request = controller;
        getArrayBuffer(headerRequestParams, controller.signal)
            .then(({data: dataBuffer, headers}) => {
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
                        lastByte = Math.max(lastByte, layer.dataIndex.at(-1).lastByte);
                    }

                    if (dataBuffer.byteLength >= lastByte) {
                        this.entireBuffer = dataBuffer;
                    }

                    callback(null, (this.entireBuffer || dataBuffer), headers);
                } catch (error) {
                    callback(error as Error);
                }
            })
            .catch((err: Error) => { if (!controller.signal.aborted) callback(err); });

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

    fetchBand(sourceLayer: string, layerId: string | null, band: string | number, callback: Callback<TDecodingResult[] | null | undefined>): Cancelable {
        // If header is not loaded, bail out of rendering.
        // Repaint on reload is handled by appropriate callbacks.
        const mrt = this._mrt;
        if (!this._isHeaderLoaded || !mrt) {
            callback(new Error('Tile header is not ready'));
            return;
        }

        if (this.parentTile && this.overzoomCoordsPerLayer) {
            callback(null, null);
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

            taskInQueue.forEach((cb) => cb(null, result));
            this._taskQueue.delete(taskQueueId);
        };

        const onDataLoaded = (err?: Error | null, buffer?: ArrayBuffer | null) => {
            if (err) return callback(err);

            let decodeRequest: AbortController | undefined;
            let aborted = false;

            if (layerId !== null) {
                const workQueue = this._workQueuePerLayer.get(layerId) || [];

                workQueue.push(() => {
                    aborted = true;
                    if (decodeRequest) decodeRequest.abort();
                    task.cancel();
                });

                if (!this._workQueuePerLayer.has(layerId)) {
                    this._workQueuePerLayer.set(layerId, workQueue);
                }
            }

            // Defer the decode until workers have preloaded the MRT module (see `workerReady`).
            const send = () => {
                if (aborted) return;
                const params = {
                    type: 'raster-array' as const,
                    source: this.source,
                    scope: this.scope,
                    tileID: this.tileID,
                    uid: this.uid,
                    buffer,
                    task
                };
                decodeRequest = actor.sendCancelable('decodeRasterArray', params, {}, onDataDecoded);
            };

            if (this.workerReady !== undefined) {
                this.workerReady.then(send).catch((e: Error) => callback(e));
            } else {
                send();
            }
        };

        let mrtLayer: MapboxRasterLayer;
        try {
            mrtLayer = mrt.getLayer(sourceLayer);
        } catch (err) {
            if (this.parentTile && this.overzoomCoordsPerLayer) {
                callback(new Error(`Layer '${sourceLayer}' not found in parent tile MRT`));
                return;
            }

            if (this.state === 'reloading') {
                // When a tile is reloading, getLayer might throw an error
                // due to the layer not existing for a time period
                // We swallow the error here since that's expected
                return;
            }

            throw err;
        }

        if (!mrtLayer) {
            callback(new Error(`Unknown sourceLayer "${sourceLayer}"`));
            return;
        }

        if (mrtLayer.hasDataForBand(band)) {
            taskInQueue.forEach((cb) => cb(null, null));
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
            const rangeRequestParams = {...this.requestParams, headers: {Range: `bytes=${range.firstByte}-${range.lastByte}`}};
            const controller = new AbortController();
            getArrayBuffer(rangeRequestParams, controller.signal)
                .then(({data: buffer}) => onDataLoaded(null, buffer))
                .catch((err: Error) => { if (!controller.signal.aborted) onDataLoaded(err); });

            if (layerId !== null) {
                const fetchQueue = this._fetchQueuePerLayer.get(layerId) || [];
                fetchQueue.push(() => {
                    controller.abort();
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

        let mrtLayer: MapboxRasterLayer;
        try {
            mrtLayer = this._mrt.getLayer(sourceLayer);
        } catch (err) {
            return;
        }

        if (!mrtLayer || !mrtLayer.hasBand(band) || !mrtLayer.hasDataForBand(band)) return;

        let {bytes, tileSize, buffer, offset, scale} = mrtLayer.getBandView(band);

        if (this.parentTile && this.overzoomCoordsPerLayer) {
            const layerCoords = this.overzoomCoordsPerLayer.get(sourceLayer);
            if (layerCoords) {
                bytes = this.cropBandData(bytes, tileSize, buffer, layerCoords);
                tileSize = layerCoords.tileSize;
            }
        }

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

    /**
     * Crop a layer's RGBA-decoded band data down to the overzoomed region.
     * @private
     */
    cropBandData(
        bytes: Uint8Array,
        parentTileSize: number,
        buffer: number,
        layerCoords: OverzoomCoords
    ): Uint8Array {
        const {offset, tileSize: childTileSize} = layerCoords;

        // getBandView() always returns data in RGBA format (4 bytes per pixel)
        // regardless of the native MRT format (uint8/uint16/uint32).
        const RGBA_COMPONENTS = 4;
        const parentDimWithBuffer = parentTileSize + 2 * buffer;
        const inShape: [number, number, number, number] = [1, parentDimWithBuffer, parentDimWithBuffer, RGBA_COMPONENTS];

        const childDimWithBuffer = childTileSize + 2 * buffer;
        const outShape: [number, number, number, number] = [1, childDimWithBuffer, childDimWithBuffer, RGBA_COMPONENTS];

        return crop(bytes, inShape, outShape, offset) as Uint8Array;
    }

    /**
     * Set up this tile to render from a parent tile's data.
     * Walks the parent chain to the root data tile, shares its MRT, and computes
     * the pixel crop region. Returns true on success.
     * @private
     */
    setupOverzoom(parentTile: RasterArrayTile): boolean {
        let rootTile = parentTile;
        while (rootTile.parentTile) {
            rootTile = rootTile.parentTile;
        }

        const rootMrt = rootTile._mrt;
        if (!rootMrt || !rootMrt.layers) return false;

        const layers = Object.values(rootMrt.layers);
        if (layers.length === 0) return false;

        const source = {
            x: rootTile.tileID.canonical.x,
            y: rootTile.tileID.canonical.y,
            z: rootTile.tileID.canonical.z,
        };
        const dest = {
            x: this.tileID.canonical.x,
            y: this.tileID.canonical.y,
            z: this.tileID.canonical.z,
        };

        // Compute crop coords per layer. Layers in a single MRT tile can
        // have different `tileSize` values, which means a single overzoom
        // request resolves to different pixel offsets for each layer.
        const coordsPerLayer = new Map<string, OverzoomCoords>();
        for (const layer of layers) {
            try {
                coordsPerLayer.set(layer.name, computeOverzoomCoords(layer.tileSize, source, dest));
            } catch (err) {
                // Only genuine invariant violations (dest not a child of source, negative
                // deltaZ) throw here; the "too much overzoom" case is clamped instead.
                // If something does throw, treat the whole tile as un-overzoomable rather
                // than producing a partial Map.
                return false;
            }
        }

        this.parentTile = rootTile;
        this._mrt = rootMrt;
        this._isHeaderLoaded = true;
        this.overzoomCoordsPerLayer = coordsPerLayer;

        return true;
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

// Registers the constructor so core-resident `SourceCache` can build raster-array tiles
// without a static value import of this class (which would anchor the MRT decoder into core).
registerRasterArrayTile((tileID, size, tileZoom, painter, isRaster) => new RasterArrayTile(tileID, size, tileZoom, painter, isRaster));

export default RasterArrayTile;
