/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

// This file is part of meshoptimizer library and is distributed under the terms of MIT License.
// Copyright (C) 2016-2023, by Arseny Kapoulkine (arseny.kapoulkine@gmail.com)

export function MeshoptDecoderModule(wasmPromise) {

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return WebAssembly.instantiateStreaming(wasmPromise, {}).then((output) => {
        const {
            sbrk,
            memory,
            meshopt_decodeVertexBuffer: decodeVertexBuffer,
            meshopt_decodeIndexBuffer: decodeIndexBuffer,
            meshopt_decodeIndexSequence: decodeIndexSequence,
            meshopt_decodeFilterOct: decodeFilterOct,
            meshopt_decodeFilterQuat: decodeFilterQuat,
            meshopt_decodeFilterExp: decodeFilterExp
        } = output.instance.exports;

        const decoders = {
            ATTRIBUTES: decodeVertexBuffer,
            TRIANGLES: decodeIndexBuffer,
            INDICES: decodeIndexSequence
        };
        const filters = {
            OCTAHEDRAL: decodeFilterOct,
            QUATERNION: decodeFilterQuat,
            EXPONENTIAL: decodeFilterExp,
        };

        output.instance.exports.__wasm_call_ctors();

        return {
            decodeGltfBuffer(target, count, size, source, mode, filter) {
                const count4 = (count + 3) & ~3;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const tp = sbrk(count4 * size);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                const sp = sbrk(source.length);
                const heap = new Uint8Array(memory.buffer);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                heap.set(source, sp);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const res = decoders[mode](tp, count, size, sp, source.length);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (res === 0 && filters[filter]) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    filters[filter](tp, count4, size);
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
                target.set(heap.subarray(tp, tp + count * size));
                sbrk(tp - sbrk(0));
                if (res !== 0) {
                    throw new Error(`Malformed buffer data: ${res}`);
                }
            }
        };
    });
}

