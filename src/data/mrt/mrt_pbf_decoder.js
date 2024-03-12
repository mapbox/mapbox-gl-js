// @noflow
/* eslint-disable camelcase */
/* eslint-disable no-sequences */
/* eslint-disable no-unused-vars */
/* eslint-disable no-unreachable */
/* eslint-disable no-unused-expressions */

/* This code is not entirely auto-generated. It's based on the output of npm run
 * pbf:generate, but it has been hand-modified.
 *
 * There is precisely two section which are customized: A utility function is
 * added at the top, and then at the bottom the NumericData.VariableLengthValues
 * reader is modified to read values into a preallocated typed array in order
 * to avoid the default behavior which reads them into a generic JavaScript
 * array only to then pass them into a typed array.
 *
 * To update this file:
 *   1. run `npm run pbf:generate`
 *   2. copy the contents of the updated `mrt/js/proto/mrt_v2_pb2.js` into this file
 *   3. manually transfer over modified sections
 *   4. delete all `write` methods (they're not used in JS)
 *   5. remove references to `exports`
 */

/********************************************************
 **************** BEGIN EDITED SECTION ******************
 ********************************************************/
const Bytes = 2;

function readPackedEnd(pbf) {
    return pbf.type === Bytes ? pbf.readVarint() + pbf.pos : pbf.pos + 1;
}

function createPackedVarintReader(pbf) {
    if (pbf.type !== Bytes) throw new Error(`Unsupported pbf type "${pbf.type}"`);
    const end = readPackedEnd(pbf);
    const start = pbf.pos;
    pbf.pos = end;
    return function readInto(arr) {
        pbf.pos = start;
        let i = 0;
        while (pbf.pos < end) {
            const value = pbf.readVarint();
            arr[i++] = value;
        }
        return arr;
    };
}
/********************************************************
 ***************** END EDITED SECTION *******************
 ********************************************************/

// TileHeader ========================================

const TileHeader = {};

TileHeader.read = function (pbf, end) {
    return pbf.readFields(
        TileHeader._readField,
        {header_length: 0, x: 0, y: 0, z: 0, layers: []},
        end
    );
};
TileHeader._readField = function (tag, obj, pbf) {
    if (tag === 1) obj.header_length = pbf.readFixed32();
    else if (tag === 2) obj.x = pbf.readVarint();
    else if (tag === 3) obj.y = pbf.readVarint();
    else if (tag === 4) obj.z = pbf.readVarint();
    else if (tag === 5)
        obj.layers.push(TileHeader.Layer.read(pbf, pbf.readVarint() + pbf.pos));
};

TileHeader.PixelFormat = {
    PIXEL_FORMAT_UNKNOWN: {
        value: 0,
        options: {},
    },
    PIXEL_FORMAT_UINT32: {
        value: 1,
        options: {},
    },
    PIXEL_FORMAT_UINT16: {
        value: 2,
        options: {},
    },
    PIXEL_FORMAT_UINT8: {
        value: 3,
        options: {},
    },
};

// TileHeader.Filter ========================================

TileHeader.Filter = {};

TileHeader.Filter.read = function (pbf, end) {
    return pbf.readFields(
        TileHeader.Filter._readField,
        {
            delta_filter: null,
            filter: null,
            zigzag_filter: null,
            bitshuffle_filter: null,
            byteshuffle_filter: null,
        },
        end
    );
};
TileHeader.Filter._readField = function (tag, obj, pbf) {
    if (tag === 1)
        (obj.delta_filter = TileHeader.Filter.Delta.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.filter = 'delta_filter');
    else if (tag === 2)
        (obj.zigzag_filter = TileHeader.Filter.Zigzag.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.filter = 'zigzag_filter');
    else if (tag === 3)
        (obj.bitshuffle_filter = TileHeader.Filter.BitShuffle.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.filter = 'bitshuffle_filter');
    else if (tag === 4)
        (obj.byteshuffle_filter = TileHeader.Filter.ByteShuffle.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.filter = 'byteshuffle_filter');
};

// TileHeader.Filter.Delta ========================================

TileHeader.Filter.Delta = {};

TileHeader.Filter.Delta.read = function (pbf, end) {
    return pbf.readFields(
        TileHeader.Filter.Delta._readField,
        {block_size: 0},
        end
    );
};
TileHeader.Filter.Delta._readField = function (tag, obj, pbf) {
    if (tag === 1) obj.block_size = pbf.readVarint();
};

// TileHeader.Filter.Zigzag ========================================

TileHeader.Filter.Zigzag = {};

TileHeader.Filter.Zigzag.read = function (pbf, end) {
    return pbf.readFields(TileHeader.Filter.Zigzag._readField, {}, end);
};
TileHeader.Filter.Zigzag._readField = function (tag, obj, pbf) {};

// TileHeader.Filter.BitShuffle ========================================

TileHeader.Filter.BitShuffle = {};

TileHeader.Filter.BitShuffle.read = function (pbf, end) {
    return pbf.readFields(TileHeader.Filter.BitShuffle._readField, {}, end);
};
TileHeader.Filter.BitShuffle._readField = function (tag, obj, pbf) {};

// TileHeader.Filter.ByteShuffle ========================================

TileHeader.Filter.ByteShuffle = {};

TileHeader.Filter.ByteShuffle.read = function (pbf, end) {
    return pbf.readFields(TileHeader.Filter.ByteShuffle._readField, {}, end);
};
TileHeader.Filter.ByteShuffle._readField = function (tag, obj, pbf) {};

// TileHeader.Codec ========================================

TileHeader.Codec = {};

TileHeader.Codec.read = function (pbf, end) {
    return pbf.readFields(
        TileHeader.Codec._readField,
        {
            gzip_data: null,
            codec: null,
            jpeg_image: null,
            webp_image: null,
            png_image: null,
        },
        end
    );
};
TileHeader.Codec._readField = function (tag, obj, pbf) {
    if (tag === 1)
        (obj.gzip_data = TileHeader.Codec.GzipData.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.codec = 'gzip_data');
    else if (tag === 2)
        (obj.jpeg_image = TileHeader.Codec.JpegImage.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.codec = 'jpeg_image');
    else if (tag === 3)
        (obj.webp_image = TileHeader.Codec.WebpImage.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.codec = 'webp_image');
    else if (tag === 4)
        (obj.png_image = TileHeader.Codec.PngImage.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.codec = 'png_image');
};

// TileHeader.Codec.GzipData ========================================

TileHeader.Codec.GzipData = {};

TileHeader.Codec.GzipData.read = function (pbf, end) {
    return pbf.readFields(TileHeader.Codec.GzipData._readField, {}, end);
};
TileHeader.Codec.GzipData._readField = function (tag, obj, pbf) {};

// TileHeader.Codec.JpegImage ========================================

TileHeader.Codec.JpegImage = {};

TileHeader.Codec.JpegImage.read = function (pbf, end) {
    return pbf.readFields(TileHeader.Codec.JpegImage._readField, {}, end);
};
TileHeader.Codec.JpegImage._readField = function (tag, obj, pbf) {};

// TileHeader.Codec.WebpImage ========================================

TileHeader.Codec.WebpImage = {};

TileHeader.Codec.WebpImage.read = function (pbf, end) {
    return pbf.readFields(TileHeader.Codec.WebpImage._readField, {}, end);
};
TileHeader.Codec.WebpImage._readField = function (tag, obj, pbf) {};

// TileHeader.Codec.PngImage ========================================

TileHeader.Codec.PngImage = {};

TileHeader.Codec.PngImage.read = function (pbf, end) {
    return pbf.readFields(TileHeader.Codec.PngImage._readField, {}, end);
};
TileHeader.Codec.PngImage._readField = function (tag, obj, pbf) {};

// TileHeader.DataIndexEntry ========================================

TileHeader.DataIndexEntry = {};

TileHeader.DataIndexEntry.read = function (pbf, end) {
    return pbf.readFields(
        TileHeader.DataIndexEntry._readField,
        {
            first_byte: 0,
            last_byte: 0,
            filters: [],
            codec: null,
            offset: 0,
            scale: 0,
            bands: [],
        },
        end
    );
};
TileHeader.DataIndexEntry._readField = function (tag, obj, pbf) {
    if (tag === 1) obj.first_byte = pbf.readFixed64();
    else if (tag === 2) obj.last_byte = pbf.readFixed64();
    else if (tag === 3)
        obj.filters.push(
            TileHeader.Filter.read(pbf, pbf.readVarint() + pbf.pos)
        );
    else if (tag === 4)
        obj.codec = TileHeader.Codec.read(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 5) obj.offset = pbf.readFloat();
    else if (tag === 6) obj.scale = pbf.readFloat();
    else if (tag === 7) obj.bands.push(pbf.readString());
};

// TileHeader.Layer ========================================

TileHeader.Layer = {};

TileHeader.Layer.read = function (pbf, end) {
    return pbf.readFields(
        TileHeader.Layer._readField,
        {
            version: 0,
            name: '',
            units: '',
            tilesize: 0,
            buffer: 0,
            pixel_format: 0,
            data_index: [],
        },
        end
    );
};
TileHeader.Layer._readField = function (tag, obj, pbf) {
    if (tag === 1) obj.version = pbf.readVarint();
    else if (tag === 2) obj.name = pbf.readString();
    else if (tag === 3) obj.units = pbf.readString();
    else if (tag === 4) obj.tilesize = pbf.readVarint();
    else if (tag === 5) obj.buffer = pbf.readVarint();
    else if (tag === 6) obj.pixel_format = pbf.readVarint();
    else if (tag === 7)
        obj.data_index.push(
            TileHeader.DataIndexEntry.read(pbf, pbf.readVarint() + pbf.pos)
        );
};

// NumericData ========================================

const NumericData = {};

NumericData.read = function (pbf, end) {
    return pbf.readFields(
        NumericData._readField,
        {uint32_values: null, values: null, fixed32_values: null},
        end
    );
};
NumericData._readField = function (tag, obj, pbf) {
    if (tag === 2)
        (obj.uint32_values = NumericData.Uint32Values.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.values = 'uint32_values');
    else if (tag === 3)
        (obj.fixed32_values = NumericData.Fixed32Values.read(
            pbf,
            pbf.readVarint() + pbf.pos
        )),
        (obj.values = 'fixed32_values');
};

// NumericData.Uint32Values ========================================

NumericData.Uint32Values = {};

NumericData.Uint32Values.read = function (pbf, end) {
    return pbf.readFields(
        NumericData.Uint32Values._readField,
        {values: []},
        end
    );
};
NumericData.Uint32Values._readField = function (tag, obj, pbf) {
    /********************************************************
     ***************** BEGIN EDITED SECTION *******************
     ********************************************************/
    if (tag === 1) obj.readValuesInto = createPackedVarintReader(pbf);
    /********************************************************
     ***************** END EDITED SECTION *******************
     ********************************************************/
};

// NumericData.Fixed32Values ========================================

NumericData.Fixed32Values = {};

NumericData.Fixed32Values.read = function (pbf, end) {
    return pbf.readFields(
        NumericData.Fixed32Values._readField,
        {values: []},
        end
    );
};
NumericData.Fixed32Values._readField = function (tag, obj, pbf) {
    /********************************************************
     ***************** BEGIN EDITED SECTION *******************
     ********************************************************/
    throw new Error('Not implemented');
    if (tag === 1) pbf.readPackedFixed32(obj.values);
    /********************************************************
     ***************** END EDITED SECTION *******************
     ********************************************************/
};

export {TileHeader, NumericData};
