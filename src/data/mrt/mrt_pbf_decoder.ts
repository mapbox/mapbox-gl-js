// @ts-nocheck
/* eslint-disable camelcase */

export function readTileHeader(pbf, end) {
    return pbf.readFields(readTileHeaderTag, {header_length: 0, x: 0, y: 0, z: 0, layers: []}, end);
}
function readTileHeaderTag(tag, obj, pbf) {
    if (tag === 1) obj.header_length = pbf.readFixed32();
    else if (tag === 2) obj.x = pbf.readVarint();
    else if (tag === 3) obj.y = pbf.readVarint();
    else if (tag === 4) obj.z = pbf.readVarint();
    else if (tag === 5) obj.layers.push(readLayer(pbf, pbf.readVarint() + pbf.pos));
}

function readFilter(pbf, end) {
    return pbf.readFields(readFilterTag, {}, end);
}
function readFilterTag(tag, obj, pbf) {
    if (tag === 1) {
        obj.delta_filter = readFilterDelta(pbf, pbf.readVarint() + pbf.pos);
        obj.filter = 'delta_filter';
    } else if (tag === 2) {
        pbf.readVarint();
        obj.filter = 'zigzag_filter';
    } else if (tag === 3) {
        pbf.readVarint();
        obj.filter = 'bitshuffle_filter';
    } else if (tag === 4) {
        pbf.readVarint();
        obj.filter = 'byteshuffle_filter';
    }
}

function readFilterDelta(pbf, end) {
    return pbf.readFields(readFilterDeltaTag, {block_size: 0}, end);
}
function readFilterDeltaTag(tag, obj, pbf) {
    if (tag === 1) obj.block_size = pbf.readVarint();
}

function readCodec(pbf, end) {
    return pbf.readFields(readCodecTag, {}, end);
}
function readCodecTag(tag, obj, pbf) {
    if (tag === 1) {
        pbf.readVarint();
        obj.codec = 'gzip_data';
    } else if (tag === 2) {
        pbf.readVarint();
        obj.codec = 'jpeg_image';
    } else if (tag === 3) {
        pbf.readVarint();
        obj.codec = 'webp_image';
    } else if (tag === 4) {
        pbf.readVarint();
        obj.codec = 'png_image';
    }
}

function readDataIndexEntry(pbf, end) {
    return pbf.readFields(readDataIndexEntryTag, {
        first_byte: 0,
        last_byte: 0,
        filters: [],
        codec: null,
        offset: 0,
        scale: 0,
        bands: [],
    }, end);
}
function readDataIndexEntryTag(tag, obj, pbf) {
    if (tag === 1) obj.first_byte = pbf.readFixed64();
    else if (tag === 2) obj.last_byte = pbf.readFixed64();
    else if (tag === 3) obj.filters.push(readFilter(pbf, pbf.readVarint() + pbf.pos));
    else if (tag === 4) obj.codec = readCodec(pbf, pbf.readVarint() + pbf.pos);
    else if (tag === 5) obj.offset = pbf.readFloat();
    else if (tag === 6) obj.scale = pbf.readFloat();
    else if (tag === 7) obj.bands.push(pbf.readString());
}

function readLayer(pbf, end) {
    return pbf.readFields(readLayerTag, {
        version: 0,
        name: '',
        units: '',
        tilesize: 0,
        buffer: 0,
        pixel_format: 0,
        data_index: [],
    }, end);
}
function readLayerTag(tag, obj, pbf) {
    if (tag === 1) obj.version = pbf.readVarint();
    else if (tag === 2) obj.name = pbf.readString();
    else if (tag === 3) obj.units = pbf.readString();
    else if (tag === 4) obj.tilesize = pbf.readVarint();
    else if (tag === 5) obj.buffer = pbf.readVarint();
    else if (tag === 6) obj.pixel_format = pbf.readVarint();
    else if (tag === 7) obj.data_index.push(readDataIndexEntry(pbf, pbf.readVarint() + pbf.pos));
}

export function readNumericData(pbf, values) {
    pbf.readFields(readNumericDataTag, values);
}
function readNumericDataTag(tag, values, pbf) {
    if (tag === 2) {
        readUint32Values(pbf, pbf.readVarint() + pbf.pos, values);
    } else if (tag === 3) {
        throw new Error('Not implemented');
    }
}

function readUint32Values(pbf, end, values) {
    return pbf.readFields(readUint32ValuesTag, values, end);
}
function readUint32ValuesTag(tag, values, pbf) {
    if (tag === 1) {
        let i = 0;
        const end = pbf.readVarint() + pbf.pos;
        while (pbf.pos < end) {
            values[i++] = pbf.readVarint();
        }
    }
}
