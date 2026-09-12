/**
 * Utilities for client-side MRT tile overzooming.
 * Based on @mapbox/mrt-overzoom package.
 */

export class MRTOverzoomError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MRTOverzoomError';
    }
}

type DType = 'uint8' | 'uint16' | 'uint32';

const CTOR_FOR_DTYPE = {
    'uint8': Uint8Array,
    'uint16': Uint16Array,
    'uint32': Uint32Array,
};

function dtypeFromArray(array: Uint8Array | Uint16Array | Uint32Array): DType {
    if (array instanceof Uint8Array) return 'uint8';
    if (array instanceof Uint16Array) return 'uint16';
    if (array instanceof Uint32Array) return 'uint32';
    throw new Error('Invalid array type');
}

/**
 * Compute relative offset of proposed overzoom
 *
 * @param tileSize - source tile size
 * @param source - source tile coordinates
 * @param dest - destination tile coordinates
 * @returns offset - relative offset of overzoomed tile
 */
export function computeOverzoomCoords(
    tileSize: number,
    source: {x: number; y: number; z: number},
    dest: {x: number; y: number; z: number}
): {offset: [number, number]; tileSize: number; deltaZ: number} {
    const {x: sx, y: sy, z: sz} = source;
    const {x: dx, y: dy, z: dz} = dest;

    const deltaZ = dz - sz;
    if (deltaZ < 0) {
        throw new MRTOverzoomError(
            `Invalid overzoom, source (z=${sz}) is higher zoom than destination (z=${dz}).`
        );
    }
    const x = dx - (sx << deltaZ);
    const y = dy - (sy << deltaZ);
    const dim = 1 << deltaZ;
    if (x < 0 || x >= dim || y < 0 || y >= dim) {
        throw new MRTOverzoomError(
            `Invalid overzoom, ${dz}/${dx}/${dy} is not a child of ${sz}/${sx}/${sy}.`
        );
    }

    // For deltaZ > log2(tileSize), we'd cropping past a 1x1 region of the parent — there
    // is no sub-pixel detail left to extract. Server-side `@mapbox/mrt-overzoom` throws
    // here (HTTP 400); on the client we clamp instead so the renderer keeps producing
    // tiles. The crop ends up being 1x1 of the closest parent pixel, scaled across the
    // destination tile by the texture filter — visually saturated, but the map keeps
    // rendering with no error events or holes.
    const tileSizeLog2 = Math.log2(tileSize) | 0;
    const effectiveDeltaZ = Math.min(deltaZ, tileSizeLog2);
    const subPixelShift = deltaZ - effectiveDeltaZ;
    const outTileSize = tileSize >> effectiveDeltaZ;
    const offsetX = (x >> subPixelShift) * outTileSize;
    const offsetY = (y >> subPixelShift) * outTileSize;

    return {
        offset: [offsetX, offsetY],
        tileSize: outTileSize,
        deltaZ,
    };
}

/**
 * Crop a 4D input array with shape [numBands, height, width, numComponents]
 *
 * @param data - input data
 * @param inShape - input array shape [numBands, height, width, numComponents]
 * @param outShape - output array shape [numBands, height, width, numComponents]
 * @param offset - pixel offset of cropped region [x, y]
 * @returns cropped data array
 */
export function crop(
    data: Uint8Array | Uint16Array | Uint32Array,
    inShape: [number, number, number, number],
    outShape: [number, number, number, number],
    offset: [number, number]
): Uint8Array | Uint16Array | Uint32Array {
    const dtype = dtypeFromArray(data);
    const Ctor = CTOR_FOR_DTYPE[dtype];

    if (!Ctor) {
        throw new Error(`Invalid data type "${dtype}"`);
    }

    // Shape arrays are:
    //
    //   [ numBands, height, width, numComponents]
    //
    // Width and height should be strictly equal, but we treat them generally.
    // Components refers to the vector dimension, so the only possibilities are
    // uint32 (scalar) = 1, uint16 (vector) = 2, uint8 (rgba) = 4.

    // Lengths are in terms of typed sizes, not bytes
    const inRowLength = inShape[2] * inShape[3];
    const inBandLength = inShape[1] * inRowLength;
    const outRowLength = outShape[2] * outShape[3];
    const outBandLength = outShape[1] * outRowLength;

    const out = new Ctor(outBandLength * outShape[0]);

    for (let band = 0; band < outShape[0]; band++) {
        // Start with the offset of the band
        let inPos = band * inBandLength;

        // Then increment by the row/col offset
        inPos += outShape[3] * (offset[1] * inShape[2] + offset[0]);

        // Output is just the top-left corner of the output array for this band
        let outPos = band * outBandLength;

        // "memcpy" raster rows one by one
        for (let row = 0; row < outShape[1]; row++) {
            out.subarray(outPos, outPos + outRowLength).set(
                data.subarray(inPos, inPos + outRowLength)
            );

            inPos += inRowLength;
            outPos += outRowLength;
        }
    }
    return out;
}
