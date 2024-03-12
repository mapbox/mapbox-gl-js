// @noflow
/* eslint-disable no-undef */
/* eslint-disable camelcase */
import {gunzipSync} from 'fflate';

/** @typedef { import("./types/types").TCodec } TCodec */

/** @type { { [key: string]: string } } */
const DS_TYPES = {gzip_data: 'gzip'};

/**
 * Decompress a n array of bytes
 *
 * @param {Buffer | Uint8Array} bytes - input bytes
 * @param {TCodec} codec - codec with which data is compressed
 * @return {Promise<Uint8Array | ArrayBuffer>} Promise which resolves with unzipped data
 */
export default function decompress(bytes, codec) {
    // @ts-ignore
    if (!globalThis.DecompressionStream) {
        switch (codec) {
        case 'gzip_data':
            return Promise.resolve(gunzipSync(bytes));
        }
    }

    const decompressionStreamType = DS_TYPES[codec];
    if (!decompressionStreamType) {
        throw new Error(`Unhandled codec: ${codec}`);
    }

    /** @ts-ignore */
    const ds = new globalThis.DecompressionStream(decompressionStreamType);

    return new Response(new Blob([bytes]).stream().pipeThrough(ds))
        .arrayBuffer()
        .then((buf) => new Uint8Array(buf));
}
