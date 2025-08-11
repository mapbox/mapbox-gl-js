/**
 * We need to keep TypeScript definitions of the `mrt.esm.js` in a separate file
 * because `dts-bundle-generator` does not support referencing types from JavaScript files.
 *
 * To generate the TypeScript definitions, run:
 * npx tsc --allowJs --declaration --emitDeclarationOnly --outDir . --removeComments mrt.esm.js
 */

import type Pbf from 'pbf';
import type {LRUCache} from '../../util/lru';
import type {
    TArrayLike,
    TDataRange,
    TBlockReference,
    TRasterLayerConfig,
    TBandViewRGBA,
    TProcessingTask,
    TProcessingBatch,
    TDecodingResult,
    TPbfDataIndexEntry,
    TPixelFormat
} from './types';

export type {TBandViewRGBA};

export namespace MapboxRasterTile {
    function setPbf(_Pbf: typeof Pbf): void;
    function performDecoding(buf: ArrayBufferLike, decodingBatch: TProcessingBatch): Promise<TDecodingResult[]>;
}

export class MRTDecodingBatch {
    constructor(tasks: TProcessingTask[], onCancel: () => void, onComplete: (err: Error, results: TDecodingResult[]) => void);
    tasks: TProcessingTask[];
    _onCancel: () => void;
    _onComplete: (err: Error, results: TDecodingResult[]) => void;
    _finalized: boolean;
    cancel(): void;
    complete(err: Error, result: TDecodingResult[]): void;
}

export class MRTError extends Error {
    constructor(message: string);
}

export class MapboxRasterTile {
    constructor(cacheSize?: number);
    x: number;
    y: number;
    z: number;
    layers: Record<string, MapboxRasterLayer>;
    _cacheSize: number;
    getLayer(layerName: string): MapboxRasterLayer;
    getHeaderLength(buf: ArrayBuffer): number;
    parseHeader(buf: ArrayBuffer): MapboxRasterTile;
    createDecodingTask(range: TDataRange): MRTDecodingBatch;
}

export class MapboxRasterLayer {
    constructor({version, name, units, tileSize, pixelFormat, buffer, dataIndex}: {version: number; name: string; units: string; tileSize: number; buffer: number; pixelFormat: number; dataIndex: TPbfDataIndexEntry[]}, config?: TRasterLayerConfig);
    version: 1;
    name: string;
    units: string;
    tileSize: number;
    buffer: number;
    pixelFormat: TPixelFormat;
    dataIndex: TPbfDataIndexEntry[];
    bandShape: number[];
    _decodedBlocks: LRUCache<object>;
    _blocksInProgress: Set<number>;
    get dimension(): number;
    get cacheSize(): number;
    getBandList(): Array<string>;
    processDecodedData(result: TDecodingResult): void;
    getBlockForBand(band: string | number): TBlockReference;
    getDataRange(bandList: Array<number | string>): TDataRange;
    hasBand(band: number | string): boolean;
    hasDataForBand(band: number | string): boolean;
    getBandView(band: number | string): TBandViewRGBA;
}

export function deltaDecode(data: TArrayLike, shape: number[]): TArrayLike;

export {};
