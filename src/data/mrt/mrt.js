// @noflow
/* eslint-disable camelcase */

import {TileHeader, NumericData} from './mrt_pbf_decoder.js';
import {lru} from 'tiny-lru';
import deltaDecode from './filters/delta.js';
import zigzagDecode from './filters/zigzag.js';
import bitshuffleDecode from './filters/bitshuffle.js';
// eslint-disable-next-line import/no-named-as-default
import MRTError from './error.js';

import decompress from './decompress.js';
import Pbf from 'pbf';

/** @typedef { import("pbf") } Pbf; */
/** @typedef { import("./types/types").TArrayLike } TArrayLike; */
/** @typedef { import("./types/types").TDataRange } TDataRange; */
/** @typedef { import("./types/types").TBlockReference } TBlockReference; */
/** @typedef { import("./types/types").TRasterLayerConfig } TRasterLayerConfig; */
/** @typedef { import("./types/types").TBandViewRGBA } TBandViewRGBA; */
/** @typedef { import("./types/types").TPbfRasterTileData } TPbfRasterTileData */
/** @typedef { import("./types/types").TProcessingTask } TProcessingTask */
/** @typedef { import("./types/types").TProcessingBatch } TProcessingBatch */
/** @typedef { import("./types/types").TDecodingResult } TDecodingResult */
/** @typedef { import("./types/types").TPbfDataIndexEntry } TPbfDataIndexEntry */
/** @typedef { import("./types/types").TPixelFormat } TPixelFormat */

const MRT_VERSION = 1;

/** @type { { [key: number]: TPixelFormat } } */
const PIXEL_FORMAT = {
    0: 'uint32',
    1: 'uint32',
    2: 'uint16',
    3: 'uint8',
};

const PIXEL_FORMAT_TO_DIM_LEN = {
    uint32: 1,
    uint16: 2,
    uint8: 4,
};

const PIXEL_FORMAT_TO_CTOR = {
    uint32: Uint32Array,
    uint16: Uint16Array,
    uint8: Uint8Array,
};

class MapboxRasterTile {
    /**
     * @param {number} cacheSize - number of decoded data chunks cached
     */
    constructor(cacheSize = 1) {
        this.x = NaN;
        this.y = NaN;
        this.z = NaN;

        /** @type { { [key: string]: RasterLayer } } */
        this.layers = {};

        this._cacheSize = cacheSize;
    }

    /**
     * Get a layer instance by name
     * @param {string} layerName - name of requested layer
     * @return {RasterLayer?} layer instance
     */
    getLayer(layerName) {
        return this.layers[layerName];
    }

    getHeaderLength(buf) {
        const bytes = new Uint8Array(buf);
        const view = new DataView(buf);
        if (bytes[0] !== 0x0d) throw new MRTError('File is not a valid MRT.');
        return view.getUint32(1, true);
    }

    /**
     * @param {ArrayBuffer} buf - data buffer
     * @return {MapboxRasterTile} raster tile instance
     */
    parseHeader(buf) {
        // Validate the magic number
        const bytes = new Uint8Array(buf);
        // const view = new DataView(buf);

        const headerLength = this.getHeaderLength(buf);

        if (bytes.length < headerLength) {
            throw new MRTError(
                `Expected header with length >= ${headerLength} but got buffer of length ${bytes.length}`
            );
        }

        /** @type {Pbf} */
        const pbf = new Pbf(bytes.subarray(0, headerLength));

        /** @type {TPbfRasterTileData} */
        const meta = TileHeader.read(pbf);

        // Validate the incoming tile z/x/y matches, if already initialized
        if (
            !isNaN(this.x) &&
            (this.x !== meta.x || this.y !== meta.y || this.z !== meta.z)
        ) {
            throw new MRTError(
                `Invalid attempt to parse header ${meta.z}/${meta.x}/${meta.y} for tile ${this.z}/${this.x}/${this.y}`
            );
        }

        this.x = meta.x;
        this.y = meta.y;
        this.z = meta.z;

        for (const layer of meta.layers) {
            this.layers[layer.name] = new RasterLayer(layer, {
                cacheSize: this._cacheSize,
            });
        }

        return this;
    }

    /**
     * Create a serializable representation of a data parsing task
     * @param {TDataRange} range - range of fetched data
     * @return {MRTDecodingBatch} processing task description
     */
    createDecodingTask(range) {
        /** @type {TProcessingTask[]} */
        const tasks = [];
        const layer = this.getLayer(range.layerName);

        for (let i = 0; i < layer.dataIndex.length; i++) {
            const block = layer.dataIndex[i];
            const firstByte = block.first_byte - range.firstByte;
            const lastByte = block.last_byte + 1 - range.firstByte;
            if (i < range.firstBlock || i > range.lastBlock) continue;
            if (layer._blocksInProgress.has(i)) continue;

            const task = {
                layerName: layer.name,
                firstByte,
                lastByte,
                pixelFormat: layer.pixelFormat,
                blockIndex: i,
                blockShape: [block.bands.length].concat(layer.bandShape),
                buffer: layer.buffer,
                codec: block.codec.codec,
                filters: block.filters.map((f) => f.filter),
            };
            layer._blocksInProgress.add(i);
            tasks.push(task);
        }
        const onCancel = () => {
            tasks.forEach((task) =>
                layer._blocksInProgress.delete(task.blockIndex)
            );
        };

        /** @type {(err: Error, results: TDecodingResult[]) => void} */
        const onComplete = (err, results) => {
            tasks.forEach((task) =>
                layer._blocksInProgress.delete(task.blockIndex)
            );
            if (err) throw err;
            results.forEach((result) => {
                this.getLayer(result.layerName).processDecodedData(result);
            });
        };

        return new MRTDecodingBatch(tasks, onCancel, onComplete);
    }
}

class RasterLayer {
    /**
     * @param {object} pbf - layer configuration
     * @param {number} pbf.version - major version of MRT specification with which tile was encoded
     * @param {string} pbf.name - layer name
     * @param {string} pbf.units - layer units
     * @param {number} pbf.tilesize - number of rows and columns in raster data
     * @param {number} pbf.buffer - number of pixels around the edge of each tile
     * @param {number} pbf.pixel_format - encoded pixel format enum indicating uint32, uint16, or uint8
     * @param {TPbfDataIndexEntry[]} pbf.data_index - index of data chunk byte offsets
     * @param {TRasterLayerConfig} [config] - Additional configuration parameters
     */
    constructor(
        {version, name, units, tilesize, pixel_format, buffer, data_index},
        config
    ) {
        // Take these directly from decoded Pbf
        this.version = version;
        if (this.version !== MRT_VERSION) {
            throw new MRTError(
                `Cannot parse raster layer encoded with MRT version ${version}`
            );
        }
        this.name = name;
        this.units = units;
        this.tileSize = tilesize;
        this.buffer = buffer;
        this.pixelFormat = PIXEL_FORMAT[pixel_format];
        this.dataIndex = data_index;

        this.bandShape = [
            tilesize + 2 * buffer,
            tilesize + 2 * buffer,
            PIXEL_FORMAT_TO_DIM_LEN[this.pixelFormat],
        ];

        // Type script is creating more problems than it solves here:
        const cacheSize = config ? config.cacheSize : 5;
        this._decodedBlocks = lru(cacheSize);

        this._blocksInProgress = new Set();
    }

    /**
     * Assimilate results of data loading task
     * @param {TDecodingResult} result - result of processing task
     */
    processDecodedData(result) {
        const key = result.blockIndex.toString();
        if (this._decodedBlocks.get(key)) return;
        this._decodedBlocks.set(key, result.data);
    }

    /**
     * Find block for a band sequence index
     * @param {string|number} band - label or integer index of desired band
     * @return {TBlockReference} - index of block and index of band within block
     */
    getBlockForBand(band) {
        let blockBandStart = 0;
        switch (typeof band) {
        case 'string':
            for (const [blockIndex, block] of this.dataIndex.entries()) {
                for (const [
                    blockBandIndex,
                    bandName,
                ] of block.bands.entries()) {
                    if (bandName !== band) continue;
                    return {
                        bandIndex: blockBandStart + blockBandIndex,
                        blockIndex,
                        blockBandIndex,
                    };
                }
                blockBandStart += block.bands.length;
            }
            break;
        case 'number':
            for (const [blockIndex, block] of this.dataIndex.entries()) {
                if (
                    band >= blockBandStart &&
                        band < blockBandStart + block.bands.length
                ) {
                    return {
                        bandIndex: band,
                        blockIndex,
                        blockBandIndex: band - blockBandStart,
                    };
                }
                blockBandStart += block.bands.length;
            }
            break;
        default:
            throw new MRTError(
                    `Invalid band \`${JSON.stringify(
                        band
                    )}\`. Expected string or integer.`
            );
        }
        throw new MRTError(`Band not found: ${JSON.stringify(band)}`);
    }

    /**
     * Get the byte range of a data slice, for performing a HTTP Range fetch
     * @param {number[]} bandList - list of slices to be covered
     * @return {TDataRange} range of data
     */
    getDataRange(bandList) {
        let firstByte = Infinity;
        let lastByte = -Infinity;
        let firstBlock = Infinity;
        let lastBlock = -Infinity;
        for (const band of bandList) {
            const {blockIndex} = this.getBlockForBand(band);
            if (blockIndex < 0) {
                throw new MRTError(`Invalid band: ${JSON.stringify(band)}`);
            }
            const block = this.dataIndex[blockIndex];
            firstBlock = Math.min(firstBlock, blockIndex);
            lastBlock = Math.max(lastBlock, blockIndex);
            firstByte = Math.min(firstByte, block.first_byte);
            lastByte = Math.max(lastByte, block.last_byte);
        }
        return {
            layerName: this.name,
            firstByte,
            lastByte,
            firstBlock,
            lastBlock,
        };
    }

    hasBand(band) {
        const {blockIndex} = this.getBlockForBand(band);
        return blockIndex >= 0;
    }

    /**
     * Check if the layer has data for a given sequence band
     * @param {number} band - sequence band
     * @return {boolean} true if data is already available
     */
    hasDataForBand(band) {
        const {blockIndex} = this.getBlockForBand(band);
        return blockIndex >= 0 && !!this._decodedBlocks.get(blockIndex.toString());
    }

    /**
     * Get a typed array view of data
     * @param {number} band - sequence band
     * @return {TBandViewRGBA} view of raster layer
     */
    getBandView(band) {
        const {blockIndex, blockBandIndex} = this.getBlockForBand(band);

        /** @type {Uint8Array} */
        const data = this._decodedBlocks.get(blockIndex.toString());

        if (!data) {
            throw new MRTError(
                `Data for band ${JSON.stringify(band)} of layer "${
                    this.name
                }" not decoded.`
            );
        }

        const block = this.dataIndex[blockIndex];
        const bandDataLength = this.bandShape.reduce((a, b) => a * b, 1);
        const start = blockBandIndex * bandDataLength;
        const view = data.subarray(start, start + bandDataLength);
        const bytes = new Uint8Array(view.buffer).subarray(view.byteOffset, view.byteOffset + view.byteLength);
        return {
            data: view,
            bytes,
            tileSize: this.tileSize,
            buffer: this.buffer,
            offset: block.offset,
            scale: block.scale,
        };
    }
}

class MRTDecodingBatch {
    /**
     * @param {TProcessingTask[]} tasks - processing tasks
     * @param {() => void} onCancel - callback invoked on cancel
     * @param {(err: Error, results: TDecodingResult[]) => void} onComplete - callback invoked on completion
     */
    constructor(tasks, onCancel, onComplete) {
        this.tasks = tasks;
        this._onCancel = onCancel;
        this._onComplete = onComplete;
        this._finalized = false;
    }

    /**
     * Cancel a processing task
     * return {void}
     */
    cancel() {
        if (this._finalized) return;
        this._onCancel();
        this._finalized = true;
    }

    /**
     * Complete a processing task
     * @param {Error} err - processing error, if encountered
     * @param {TDecodingResult[]} result - result of processing
     * return {void}
     */
    complete(err, result) {
        if (this._finalized) return;
        this._onComplete(err, result);
        this._finalized = true;
    }
}

/**
 * Process a data parsing task
 * @param {ArrayBufferLike} buf - data buffer
 * @param {TProcessingBatch} decodingBatch - data processing task
 * @return {Promise<TDecodingResult[]>} output of processing task
 */
MapboxRasterTile.performDecoding = function (buf, decodingBatch) {
    return Promise.all(
        decodingBatch.tasks.map((task) => {
            const {
                layerName,
                firstByte,
                lastByte,
                pixelFormat,
                blockShape,
                blockIndex,
                filters,
                codec,
            } = task;

            const bytes = new Uint8Array(buf);
            const taskBuf = bytes.subarray(firstByte, lastByte + 1);
            const dataLength = blockShape[0] * blockShape[1] * blockShape[2];
            const values = new Uint32Array(dataLength);

            let decoded;

            switch (codec) {
            case 'gzip_data': {
                decoded = decompress(taskBuf, codec).then((bytes) => {
                    const pbf = NumericData.read(new Pbf(bytes));
                    switch (pbf.values) {
                    case 'uint32_values': {
                        pbf.uint32_values.readValuesInto(values);
                        const Ctor = PIXEL_FORMAT_TO_CTOR[pixelFormat];
                        return new Ctor(values.buffer);
                    }
                    default:
                        throw new Error(
                                    `Unhandled numeric data "${pbf.values}"`
                        );
                    }
                });
                break;
            }
            default:
                throw new Error(`Unhandled codec: ${codec}`);
            }

            return decoded
                .then((data) => {
                    // Decode filters, one at a time, in reverse order
                    for (let i = filters.length - 1; i >= 0; i--) {
                        switch (filters[i]) {
                        case 'delta_filter':
                            deltaDecode(data, blockShape);
                            break;
                        case 'zigzag_filter':
                            zigzagDecode(data);
                            break;
                        case 'bitshuffle_filter':
                            bitshuffleDecode(data, pixelFormat);
                            break;
                        default:
                            throw new Error(
                                    `Unhandled filter "${filters[i]}"`
                            );
                        }
                    }

                    return {
                        layerName,
                        blockIndex,
                        data,
                    };
                })
                .catch((err) => {
                    throw err;
                });
        })
    );
};

export {
    MapboxRasterTile,
    MRTError,
    RasterLayer,
    deltaDecode,
    MRTDecodingBatch
};
