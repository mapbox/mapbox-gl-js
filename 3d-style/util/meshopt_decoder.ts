/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

// This file is part of meshoptimizer library and is distributed under the terms of MIT License.
// Copyright (C) 2016-2023, by Arseny Kapoulkine (arseny.kapoulkine@gmail.com)

export function MeshoptDecoder(wasmPromise) {

    let instance;

    const ready =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        WebAssembly.instantiateStreaming(wasmPromise, {})
            .then((result) => {
                instance = result.instance;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                instance.exports.__wasm_call_ctors();
            });

    function decode(instance, fun, target, count, size, source, filter) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const sbrk = instance.exports.sbrk;
        const count4 = (count + 3) & ~3;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const tp = sbrk(count4 * size);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const sp = sbrk(source.length);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const heap = new Uint8Array(instance.exports.memory.buffer);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        heap.set(source, sp);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const res = fun(tp, count, size, sp, source.length);
        if (res === 0 && filter) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            filter(tp, count4, size);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        target.set(heap.subarray(tp, tp + count * size));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        sbrk(tp - sbrk(0));
        if (res !== 0) {
            throw new Error(`Malformed buffer data: ${res}`);
        }
    }

    const filters = {
        NONE: "",
        OCTAHEDRAL: "meshopt_decodeFilterOct",
        QUATERNION: "meshopt_decodeFilterQuat",
        EXPONENTIAL: "meshopt_decodeFilterExp",
    };

    const decoders = {
        ATTRIBUTES: "meshopt_decodeVertexBuffer",
        TRIANGLES: "meshopt_decodeIndexBuffer",
        INDICES: "meshopt_decodeIndexSequence",
    };

    return {
        ready,
        supported: true,
        decodeGltfBuffer(target, count, size, source, mode, filter) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            decode(instance, instance.exports[decoders[mode]], target, count, size, source, instance.exports[filters[filter]]);
        }
    };
}

