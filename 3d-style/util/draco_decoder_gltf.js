// @noflow
/* eslint-disable new-cap */

// Emscripten-based JavaScript wrapper for Google Draco WASM decoder, manually optimized for much smaller size
export function DracoDecoderModule(wasmPromise) {
    let HEAPU8, wasmMemory = null;
    function updateMemoryViews() {
        HEAPU8 = new Uint8Array(wasmMemory.buffer);
    }
    function abort() {
        throw new Error("Unexpected Draco error.");
    }
    function memcpyBig(dest, src, num) {
        return HEAPU8.copyWithin(dest, src, src + num);
    }
    function resizeHeap(requestedSize) {
        const oldSize = HEAPU8.length;
        const newSize = Math.max(requestedSize >>> 0, Math.ceil(oldSize * 1.2));
        const pages = Math.ceil((newSize - oldSize) / 65536);
        try {
            wasmMemory.grow(pages);
            updateMemoryViews();
            return true;
        } catch (e) {
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

    const instantiateWasm = WebAssembly.instantiateStreaming ?
        WebAssembly.instantiateStreaming(wasmPromise, wasmImports) :
        wasmPromise.then(wasm => wasm.arrayBuffer()).then(buffer => WebAssembly.instantiate(buffer, wasmImports));

    return instantiateWasm.then(output => {
        // minified exports values might change when recompiling Draco WASM, to be manually updated on version ugprade
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
        } = output.instance.exports;

        wasmMemory = memory;

        const ensureCache = (() => {
            let buffer = 0;
            let size = 0;
            let needed = 0;
            let temp = 0;

            return (array) => {
                if (needed) {
                    _free(temp);
                    _free(buffer);
                    size += needed;
                    needed = buffer = 0;
                }
                if (!buffer) {
                    size += 128;
                    buffer = _malloc(size);
                }

                const len = (array.length + 7) & -8;
                let offset = buffer;
                if (len >= size) {
                    needed = len;
                    offset = temp = _malloc(len);
                }

                for (let i = 0; i < array.length; i++) {
                    HEAPU8[offset + i] = array[i];
                }

                return offset;
            };
        })();

        class Mesh {
            constructor() {
                this.ptr = _Mesh();
            }
            destroy() {
                _MeshDestroy(this.ptr);
            }
        }

        class Decoder {
            constructor() {
                this.ptr = _Decoder();
            }
            destroy() {
                _DecoderDestroy(this.ptr);
            }
            DecodeArrayToMesh(data, dataSize, outMesh) {
                const offset = ensureCache(data);
                const status = _DecoderDecodeArrayToMesh(this.ptr, offset, dataSize, outMesh.ptr);
                return !!_StatusOK(status);
            }
            GetAttributeByUniqueId(pc, id) {
                return {ptr: _DecoderGetAttributeByUniqueId(this.ptr, pc.ptr, id)};
            }
            GetTrianglesUInt16Array(m, outSize, outValues) {
                _DecoderGetTrianglesUInt16Array(this.ptr, m.ptr, outSize, outValues);
            }
            GetTrianglesUInt32Array(m, outSize, outValues) {
                _DecoderGetTrianglesUInt32Array(this.ptr, m.ptr, outSize, outValues);
            }
            GetAttributeDataArrayForAllPoints(pc, pa, dataType, outSize, outValues) {
                _DecoderGetAttributeDataArrayForAllPoints(this.ptr, pc.ptr, pa.ptr, dataType, outSize, outValues);
            }
        }

        updateMemoryViews();
        initRuntime();

        return {
            memory,
            _free,
            _malloc,
            Mesh,
            Decoder,
            DT_INT8: getINT8(),
            DT_UINT8: getUINT8(),
            DT_INT16: getINT16(),
            DT_UINT16: getUINT16(),
            DT_UINT32: getUINT32(),
            DT_FLOAT32: getFLOAT32()
        };
    });
}
