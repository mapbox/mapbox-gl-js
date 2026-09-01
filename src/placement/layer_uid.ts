// Runtime-only numeric identity for a style layer instance, used by placement
// instead of a layer's string id, which can be reused if a
// layer is removed and a new one is later added with the same id.
let nextLayerUID = 1;

export function createRuntimeLayerUID(): number {
    return nextLayerUID++;
}
