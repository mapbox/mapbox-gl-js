type TTypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint8ClampedArray
  | Uint16Array
  | Uint32Array;

type TArrayLike = number[] | TTypedArray;

type TDataRange = {
  layerName: string;
  firstByte: number;
  lastByte: number;
  blockIndices: Array<number>;
};

type TPixelFormat = 'uint8' | 'uint16' | 'uint32';

type TCodec = 'gzip_data';

type TBlockReference = {
  bandIndex: number;
  blockIndex: number;
  blockBandIndex: number;
};

type TProcessingTask = {
  layerName: string;
  firstByte: number;
  lastByte: number;
  blockIndex: number;
  blockShape: number[];
  pixelFormat: TPixelFormat;
  buffer: number;
  codec: TCodec;
  filters: string[];
};

type TProcessingBatch = {
  tasks: TProcessingTask[];
};

type TDecodingResult = {
  layerName: string;
  blockIndex: number;
  data: ArrayBufferLike;
};

type TBandViewRGBA = {
  data: TTypedArray;
  bytes: Uint8Array;
  tileSize: number;
  buffer: number;
  offset: number;
  scale: number;
  dimension: number;
  pixelFormat: TPixelFormat;
};

type TPbfFilter = {
  filter: string;
};

type TPbfCodec = {
  codec: TCodec;
};

type TPbfDataIndexEntry = {
  bands: Array<string>
  offset: number;
  scale: number;
  firstByte: number;
  lastByte: number;
  filters: TPbfFilter[];
  codec: TPbfCodec;
};

type TRasterLayerConfig = {
  cacheSize: number;
};

type TPbfRasterTileData = {
  headerLength: number;
  x: number;
  y: number;
  z: number;
  layers: TPbfRasterLayerData[];
};

type TPbfRasterLayerData = {
  version: number;
  name: string;
  units: string;
  tileSize: number;
  buffer: number;
  dataIndex: TPbfDataIndexEntry[];
  pixelFormat: number;
};

export type {
    TArrayLike,
    TDataRange,
    TRasterLayerConfig,
    TBlockReference,
    TBandViewRGBA,
    TPixelFormat,

    TPbfRasterTileData,
    TPbfRasterLayerData,
    TPbfDataIndexEntry,

    TProcessingTask,
    TProcessingBatch,
    TDecodingResult,
    TCodec
};
