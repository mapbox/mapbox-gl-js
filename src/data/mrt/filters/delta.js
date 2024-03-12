// @noflow

/** @typedef { import("../types/types").TArrayLike } TArrayLike; */

/**
 * Decode difference-encoded data using a cumulative sum operation along
 * the last two (raster row and column) axes.
 *
 * @param {TArrayLike} data - flat array of input data
 * @param {number[]} shape - array dimensions, *including* the pixel dimension,
 *                           i.e. 1, 2, or 4 reflecting whether the data is
 *                           uint32, uint16, or uint8, respectively.
 * @return {TArrayLike} - differenced ndarray
 */
function deltaDecode(data, shape) {
    if (shape.length !== 4) {
        throw new Error(
            `Expected data of dimension 4 but got ${shape.length}.`
        );
    }

    // Sum over dimensions 1 and 2 of 0, 1, 2, 3
    let axisOffset = shape[3];
    for (let axis = 2; axis >= 1; axis--) {
        const start1 = axis === 1 ? 1 : 0;
        const start2 = axis === 2 ? 1 : 0;

        for (let i0 = 0; i0 < shape[0]; i0++) {
            const offset0 = shape[1] * i0;

            for (let i1 = start1; i1 < shape[1]; i1++) {
                const offset1 = shape[2] * (i1 + offset0);

                for (let i2 = start2; i2 < shape[2]; i2++) {
                    const offset2 = shape[3] * (i2 + offset1);

                    for (let i3 = 0; i3 < shape[3]; i3++) {
                        const offset3 = offset2 + i3;

                        data[offset3] += data[offset3 - axisOffset];
                    }
                }
            }
        }
        axisOffset *= shape[axis];
    }

    return data;
}

export default deltaDecode;
