// @noflow

/** @typedef { import("../types/types").TArrayLike } TArrayLike; */
/** @typedef { import("../types/types").TPixelFormat } TPixelFormat; */

/**
 * Perform bitshuffle decoding.
 *
 * @param {TArrayLike} data - flat array of input data
 * @param {TPixelFormat} pixelFormat - pixel format of data
 * @return {TArrayLike} - zigzag-decoded array
 */
function bitshuffleDecode(data, pixelFormat) {
    switch (pixelFormat) {
    case 'uint32':
        return data;
    case 'uint16':
        for (let i = 0; i < data.length; i += 2) {
            const a = data[i];
            const b = data[i + 1];
            data[i] = ((a & 0xF0) >> 4) | ((a & 0xF000) >> 8) | ((b & 0xF0) << 4) | (b & 0xF000);
            data[i + 1] = (a & 0xF) | ((a & 0xF00) >> 4) | ((b & 0xF) << 8) | ((b & 0xF00) << 4);
        }
        return data;
    case 'uint8':
        for (let i = 0; i < data.length; i += 4) {
            const a = data[i];
            const b = data[i + 1];
            const c = data[i + 2];
            const d = data[i + 3];

            data[i + 0] = ((a & 0xC0) >> 6) | ((b & 0xC0) >> 4) | ((c & 0xC0) >> 2) | ((d & 0xC0) >> 0);
            data[i + 1] = ((a & 0x30) >> 4) | ((b & 0x30) >> 2) | ((c & 0x30) >> 0) | ((d & 0x30) << 2);
            data[i + 2] = ((a & 0x0C) >> 2) | ((b & 0x0C) >> 0) | ((c & 0x0C) << 2) | ((d & 0x0C) << 4);
            data[i + 3] = ((a & 0x03) >> 0) | ((b & 0x03) << 2) | ((c & 0x03) << 4) | ((d & 0x03) << 6);
        }
        return data;
    default:
        throw new Error(`Invalid pixel format, "${pixelFormat}"`);
    }
}

export default bitshuffleDecode;
