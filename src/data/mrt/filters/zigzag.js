// @noflow

/** @typedef { import("../types/types").TArrayLike } TArrayLike; */

/**
 * Perform zigzag decoding.
 *
 * The purpose of this operation is to turn two's complement signed 32-bit
 * integers into small positive integers. It does this by performing a
 * circular shift and rotating the sign bit all the way over to the least
 * significant bit. At the same time, it inverts the bits of negative numbers
 * so that all those two's complement ones turn into zeros.
 *
 * This operation is a bitwise equivalent of the mathematical operation
 *
 *     x % 2 === 1
 *       ? (x + 1) / -2
 *       : x / 2
 *
 * Unlike the bitwise version though, it works throughout the entire 32-bit
 * unsigned range without overflow.
 *
 * Note that this imlementation works on Uint32Array, Uint16Array, and
 * Uint8Array input without needing to specially handle the different types.
 *
 * @param {TArrayLike} data - flat array of input data
 * @return {TArrayLike} - zigzag-decoded array
 */
function zigzagDecode(data) {
    for (let i = 0, n = data.length; i < n; i++) {
        data[i] = (data[i] >>> 1) ^ -(data[i] & 1);
    }
    return data;
}

export default zigzagDecode;
