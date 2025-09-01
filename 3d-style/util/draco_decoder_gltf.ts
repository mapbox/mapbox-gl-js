/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

// Emscripten-based JavaScript wrapper for Google Draco WASM decoder, manually optimized for much smaller size
export function DracoDecoderModule(wasmPromise) {
    let HEAPU8, wasmMemory = null;
    function updateMemoryViews() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        HEAPU8 = new Uint8Array(wasmMemory.buffer);
    }
    function abort() {
        throw new Error("Unexpected Draco error.");
    }
    function memcpyBig(dest, src, num) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return HEAPU8.copyWithin(dest, src, src + num);
    }
    function resizeHeap(requestedSize) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const oldSize = HEAPU8.length;
        const newSize = Math.max(requestedSize >>> 0, Math.ceil(oldSize * 1.2));
        const pages = Math.ceil((newSize - oldSize) / 65536);
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            wasmMemory.grow(pages);
            updateMemoryViews();
            return true;
        } catch (e: unknown) {
            return false;
        }
    }

    const wasmImports = {
        a: {
            a: abort,
            d: memcpyBig,
            c: resizeHeap,
            b: abort
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const instantiateWasm = WebAssembly.instantiateStreaming ?
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        WebAssembly.instantiateStreaming(wasmPromise, wasmImports) :
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        wasmPromise.then(wasm => wasm.arrayBuffer()).then(buffer => WebAssembly.instantiate(buffer, wasmImports));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return instantiateWasm.then(output => {
        // minified exports values might change when recompiling Draco WASM, to be manually updated on version ugprade
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const {
            Rb: _free,
            Qb: _malloc,
            P: _Mesh,
            T: _MeshDestroy,
            X: _StatusOK,
            Ja: _Decoder,
            La: _DecoderDecodeArrayToMesh,
            Qa: _DecoderGetAttributeByUniqueId,
            Va: _DecoderGetTrianglesUInt16Array,
            Wa: _DecoderGetTrianglesUInt32Array,
            eb: _DecoderGetAttributeDataArrayForAllPoints,
            jb: _DecoderDestroy,
            f: initRuntime,
            e: memory,
            yb: getINT8,
            zb: getUINT8,
            Ab: getINT16,
            Bb: getUINT16,
            Db: getUINT32,
            Gb: getFLOAT32
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } = output.instance.exports;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        wasmMemory = memory;

        const ensureCache = (() => {
            let buffer = 0;
            let size = 0;
            let needed = 0;
            let temp = 0;

            return (array) => {
                if (needed) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    _free(temp);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    _free(buffer);
                    size += needed;
                    needed = buffer = 0;
                }
                if (!buffer) {
                    size += 128;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                    buffer = _malloc(size);
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                const len = (array.length + 7) & -8;
                let offset = buffer;
                if (len >= size) {
                    needed = len;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                    offset = temp = _malloc(len);
                }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                for (let i = 0; i < array.length; i++) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    HEAPU8[offset + i] = array[i];
                }

                return offset;
            };
        })();

        class Mesh {
            constructor() {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                this.ptr = _Mesh();
            }
            destroy() {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                _MeshDestroy(this.ptr);
            }
        }

        class Decoder {
            constructor() {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
                this.ptr = _Decoder();
            }
            destroy() {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                _DecoderDestroy(this.ptr);
            }
            DecodeArrayToMesh(data, dataSize, outMesh) {
                const offset = ensureCache(data);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const status = _DecoderDecodeArrayToMesh(this.ptr, offset, dataSize, outMesh.ptr);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                return !!_StatusOK(status);
            }
            GetAttributeByUniqueId(pc, id) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                return {ptr: _DecoderGetAttributeByUniqueId(this.ptr, pc.ptr, id)};
            }
            GetTrianglesUInt16Array(m, outSize, outValues) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                _DecoderGetTrianglesUInt16Array(this.ptr, m.ptr, outSize, outValues);
            }
            GetTrianglesUInt32Array(m, outSize, outValues) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                _DecoderGetTrianglesUInt32Array(this.ptr, m.ptr, outSize, outValues);
            }
            GetAttributeDataArrayForAllPoints(pc, pa, dataType, outSize, outValues) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                _DecoderGetAttributeDataArrayForAllPoints(this.ptr, pc.ptr, pa.ptr, dataType, outSize, outValues);
            }
        }

        updateMemoryViews();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        initRuntime();

        return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            memory,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            _free,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            _malloc,
            Mesh,
            Decoder,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            DT_INT8: getINT8(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            DT_UINT8: getUINT8(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            DT_INT16: getINT16(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            DT_UINT16: getUINT16(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            DT_UINT32: getUINT32(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            DT_FLOAT32: getFLOAT32()
        };
    });
}
