import assert from '../style-spec/util/assert';

/**
 * Hands out contiguous ranges of generated symbol ids, one independent monotonic counter per
 * style layer keyed by StyleLayer#runtimeLayerUID, see ./layer_uid.
 *
 * A symbol id only has to be unique within its layer, because SymbolId pairs it
 * with the owning layer's runtimeLayerUID. Keeping a separate counter per layer therefore keeps
 * the ids small and lets us drop a layer's allocation state wholesale once the layer is removed.
 *
 * Callers store only a range's start and recover ids arithmetically (id = start + idx), so no
 * id-to-index mapping is kept here or on the caller side.
 */
export class SymbolIdRangeAllocator {
    _nextIdByLayer: Map<number, number>;

    constructor() {
        this._nextIdByLayer = new Map();
    }

    // Reserves the next `count` ids for `layerUID` and returns the range start. Ids are handed
    // out monotonically per layer and never reused, so a returned range stays valid until the
    // layer is released.
    allocateRange(layerUID: number, count: number): number {
        const start = this._nextIdByLayer.get(layerUID) || 0;
        assert(start + count <= Number.MAX_SAFE_INTEGER);
        this._nextIdByLayer.set(layerUID, start + count);
        return start;
    }

    // Drops the counter for a removed layer. No-op if the layer never allocated a range.
    releaseLayer(layerUID: number): void {
        this._nextIdByLayer.delete(layerUID);
    }
}
