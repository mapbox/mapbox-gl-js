// @noflow

// This file is part of meshoptimizer library and is distributed under the terms of MIT License.
// Copyright (C) 2016-2023, by Arseny Kapoulkine (arseny.kapoulkine@gmail.com)

export function MeshoptDecoder(wasmPromise) {

    let instance;

    const ready =
        WebAssembly.instantiateStreaming(wasmPromise, {})
            .then((result) => {
                instance = result.instance;
                instance.exports.__wasm_call_ctors();
            });

    function decode(instance, fun, target, count, size, source, filter) {
        const sbrk = instance.exports.sbrk;
        const count4 = (count + 3) & ~3;
        const tp = sbrk(count4 * size);
        const sp = sbrk(source.length);
        const heap = new Uint8Array(instance.exports.memory.buffer);
        heap.set(source, sp);
        const res = fun(tp, count, size, sp, source.length);
        if (res === 0 && filter) {
            filter(tp, count4, size);
        }
        target.set(heap.subarray(tp, tp + count * size));
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
            decode(instance, instance.exports[decoders[mode]], target, count, size, source, instance.exports[filters[filter]]);
        }
    };
}

