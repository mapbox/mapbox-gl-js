let simdSupported: boolean | undefined;

/**
 * Returns whether the browser supports WebAssembly SIMD instructions.
 * The result is cached after the first call.
 *
 * @private
 */
export function isWasmSimdSupported(): boolean {
    if (simdSupported === undefined) {
        if (typeof WebAssembly !== 'object') {
            return false;
        }

        // Minimal WASM module that uses SIMD
        const detector = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 3, 2, 0, 0, 5, 3, 1, 0, 1, 12, 1, 0, 10, 22, 2, 12, 0, 65, 0, 65, 0, 65, 0, 252, 10, 0, 0, 11, 7, 0, 65, 0, 253, 15, 26, 11]);
        simdSupported = WebAssembly.validate(detector);
    }

    return simdSupported;
}
