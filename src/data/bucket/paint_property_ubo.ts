import assert from '../../style-spec/util/assert';

import type Context from '../../gl/context';

/**
 * Shared pure helpers for paint-property Uniform Buffer Objects (UBOs). These are consumed by
 * every style layer's paint-property UBO implementation.
 *
 * The UBO layout header is a flat Uint32Array of 16 dwords (4 uvec4), built once per layer by
 * PaintPropertyBinderUBO.updateHeader() and uploaded to the GPU verbatim (matching GL Native and
 * the shader's header UBO). These constants name its dword slots:
 *
 *   [HEADER_DATA_DRIVEN_MASK]     bitmask: 1 = property goes in the per-feature data-driven block
 *   [HEADER_DZR_MASK]             bitmask (bit i per property): 1 = this property's own block slot
 *                                 carries a per-feature zoom range [zm, zM], rather than sharing one
 *                                 across the layer and read from HEADER_SHARED_ZOOM — and the block
 *                                 is 2 vec4 instead of 1. For colors this means appearances override
 *                                 the property with differing zoom stops (DifferentZoomRanges); for
 *                                 translate — which has no HEADER_SHARED_ZOOM slot to share — this
 *                                 means the property is zoom-dependent at all (SameZoomRange or
 *                                 DifferentZoomRanges). The shader reads bits 0/1 (fill_color/
 *                                 halo_color) to pick the zoom-range source branchlessly and bit 8
 *                                 (translate) to pick whether to mix at all; the bit doesn't
 *                                 otherwise affect block sizing/offsets beyond the 1-vs-2 vec4
 *                                 split above. The broader Independent/SameZoomRange/
 *                                 DifferentZoomRanges classification each property needs on the CPU
 *                                 lives in SymbolPropertyBinderUBO.zoomDependency, not here —
 *                                 matching GL Native, whose header likewise carries only the DZR
 *                                 bits the shader consumes.
 *   [HEADER_BLOCK_SIZE_VEC4]      size of the data-driven block in vec4 units (0 when no DD props)
 *   [HEADER_OFFSETS + i]          vec4-unit offset of property i within the data-driven block
 *                                 (only meaningful when property i's data-driven bit is set)
 *   [HEADER_SHARED_ZOOM + 0..3]   [fillZm, fillZM, haloZm, haloZM] (as raw float bits, see
 *                                 floatToBits) — the shared [zm, zM] zoom range for fill/halo color
 *                                 when NOT DifferentZoomRanges (Independent: {0,0}; SameZoomRange:
 *                                 the one range shared by every feature). Read by the shader instead
 *                                 of a per-feature block slot in that case.
 *
 * Every data-driven property occupies a fixed, zoom-ready slot so the shader decode is branchless
 * and uniform for constant / zoom-interpolated / appearance-zoom-stops cases alike (one `zoomFactor`
 * + one `mix`); non-zoom values simply duplicate min into max:
 *   float:                                  1 vec4  [min, max, zm, zM]
 *   translate (vec2), not zoom-dependent:   1 vec4  [tx, ty, tx, ty] (zoom range read as [0, 0])
 *   translate (vec2), zoom-dependent:       2 vec4  [tx_min, ty_min, tx_max, ty_max],
 *                                                    [zm, zM, pad, pad] (translate has no
 *                                                    HEADER_SHARED_ZOOM slot, so it always carries
 *                                                    its own zoom range when zoom-dependent)
 *   color, Independent/SameZoomRange:       1 vec4  [packMin0, packMin1, packMax0, packMax1]
 *                                                    (zoom range read from HEADER_SHARED_ZOOM)
 *   color, DifferentZoomRanges:             2 vec4  [packMin0, packMin1, packMax0, packMax1],
 *                                                    [zm, zM, pad, pad]
 */
export const HEADER_DATA_DRIVEN_MASK = 0;
export const HEADER_DZR_MASK = 1;
export const HEADER_BLOCK_SIZE_VEC4 = 2;
export const HEADER_OFFSETS = 3;
// [fillZm, fillZM, haloZm, haloZM], packed as float bits — see HEADER_SHARED_ZOOM doc above.
export const HEADER_SHARED_ZOOM = 12;

// Scratch buffer for reinterpreting a float's bit pattern as a uint32 (mirrors GLSL's
// floatBitsToUint), so shared zoom ranges can be packed into the uint32 header alongside the
// other integer fields.
const _floatBitsScratchF32 = new Float32Array(1);
const _floatBitsScratchU32 = new Uint32Array(_floatBitsScratchF32.buffer);
export function floatToBits(value: number): number {
    _floatBitsScratchF32[0] = value;
    return _floatBitsScratchU32[0];
}

// Symbol-only (see PaintPropertiesUBO._blockNames doc — line has no indirection block at all).
// The block-indices buffer is a pure identity mapping (blockIndices[i] = i): dedup currently
// happens at the vertex-attribute level (duplicate features get the same index written into the
// vertex buffer), so no indirection is needed here. Because it carries no per-instance state, all
// batches share one read-only template rather than each allocating — and serializing — its own
// 16 KB copy. When symbol layout properties move to UBOs this will hold real per-layer indices and
// need to become per-instance again (it'll deduplicate paint properties, with a sibling array for
// layout properties); restore the per-instance copy then. uboSizeDwords is constant per session
// (derived from device limits), so a single template size is safe.
let _blockIndicesTemplate: Uint32Array | null = null;

export function getBlockIndicesTemplate(propsDwords: number): Uint32Array {
    let template = _blockIndicesTemplate;
    if (!template) {
        template = _blockIndicesTemplate = new Uint32Array(propsDwords);
        for (let i = 0; i < propsDwords; i++) template[i] = i;
    }
    assert(template.length === propsDwords, 'block-indices template size mismatch across batches');
    return template;
}

/**
 * Shared base for per-layer paint-property Uniform Buffer Objects (UBOs). Manages 2 or 3 GPU
 * buffers per batch aligned with the GL Native UBO layout:
 *   - Header buffer:        layout descriptor (see subclass HEADER_* docs)
 *   - Properties buffer:    per-feature data-driven blocks
 *   - Block indices buffer: feature→block index mapping (symbol only — see _blockNames doc;
 *                           line addresses its properties buffer directly with no indirection,
 *                           since it has no appearance concept to deduplicate)
 *
 * Binding points: batchIndex*n (header), batchIndex*n+1 (properties), and, when present,
 * batchIndex*n+2 (indices), where n = _bindingsPerBatch() (2 or 3).
 *
 * Constant properties are NOT stored here — they are passed as uniforms at draw time.
 *
 * Subclasses supply their own header size, property count, binding count, and per-property
 * flat-buffer copy logic through the abstract hooks below; everything else — buffer allocation,
 * dirty tracking, upload, bind, destroy — is identical across layers.
 */
export abstract class PaintPropertiesUBO {
    propsDwords: number;           // dword count for u_properties
    totalBytes: number;            // byte size of each of properties / block-indices buffers
    headerData: Uint32Array;       // header dwords, shared (read-only) across all batches
    propertiesData: Float32Array;  // propsDwords floats — data-driven blocks only
    headerBuffer: WebGLBuffer | null;
    propertiesBuffer: WebGLBuffer | null;
    blockIndicesBuffer: WebGLBuffer | null; // null and unused when _blockNames() has no index name
    batchIndex: number;
    context: Context | null;

    // Dirty tracking: each flag/range marks data that needs uploading to GPU.
    // headerDirty: true after construction (triggers the first upload) and again whenever
    // markHeaderDirty() is called — the shared-zoom header slots can change at runtime (see
    // *PropertyBinderUBO._recomputeSharedRanges), unlike the rest of the header.
    // propsDirtyMin/Max: dword range touched by writeDataDrivenBlock; -1 means clean.
    // blockIndicesDirty: the shared identity template is uploaded once per batch's GPU buffer,
    // so this clears after the first upload and stays false. Always false when there's no index
    // block.
    _headerDirty: boolean;
    _propsDirtyMin: number;
    _propsDirtyMax: number;
    _blockIndicesDirty: boolean;

    protected abstract _headerBytes(): number;
    protected abstract _propCount(): number;
    protected abstract _copyFromFlat(dwordOffset: number, propIdx: number, flat: Float32Array): void;
    // 2 names (header, properties) when the layer has no indirection block (line); 3 (header,
    // properties, indices) when it does (symbol).
    protected abstract _blockNames(): readonly [string, string] | readonly [string, string, string];
    // Number of consecutive UBO binding points this layer's UBO occupies per batch — 3 when
    // _blockNames() includes an index block, 2 otherwise. Default matches the 3-block shape;
    // line overrides it.
    protected _bindingsPerBatch(): number {
        return 3;
    }

    constructor(context: Context | null, batchIndex: number, uboSizeDwords: number, header: Uint32Array) {
        this.batchIndex = batchIndex;
        this.headerBuffer = null;
        this.propertiesBuffer = null;
        this.blockIndicesBuffer = null;
        this.context = context || null;
        this.propsDwords = uboSizeDwords;
        this.totalBytes = this.propsDwords * 4;
        // The header is built once per layer and shared (read-only) across all batches.
        this.headerData = header;
        this.propertiesData = new Float32Array(this.propsDwords);

        // Initial state: header and blockIndices need uploading on first upload(); properties
        // gets dirtied as features are written. No index block means nothing to ever dirty there.
        this._headerDirty = true;
        this._propsDirtyMin = -1;
        this._propsDirtyMax = -1;
        this._blockIndicesDirty = this._blockNames().length === 3;

        if (context) {
            this._initBuffers(context);
        }
    }

    private _initBuffers(context: Context): void {
        const gl = context.gl;

        if (this.totalBytes > context.maxUniformBlockSize) {
            throw new Error(`UBO size ${this.totalBytes} exceeds device limit ${context.maxUniformBlockSize}`);
        }

        // If the context is lost, the gl.createBuffer() calls below will return null and throw an error
        // Instead, we check for context loss here and return early to avoid throwing.
        // The Map will handle context restoration and recreate the buffers as needed.
        if (gl.isContextLost()) return;

        this.headerBuffer = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.headerBuffer);
        gl.bufferData(gl.UNIFORM_BUFFER, this._headerBytes(), gl.DYNAMIC_DRAW);

        this.propertiesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.propertiesBuffer);
        gl.bufferData(gl.UNIFORM_BUFFER, this.totalBytes, gl.DYNAMIC_DRAW);

        if (this._blockNames().length === 3) {
            this.blockIndicesBuffer = gl.createBuffer();
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.blockIndicesBuffer);
            gl.bufferData(gl.UNIFORM_BUFFER, this.totalBytes, gl.DYNAMIC_DRAW);
        }

        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    /**
     * Marks the header buffer for re-upload. Call after mutating `headerData` in place post-
     * construction (currently only the shared-zoom slots, refreshed by
     * *PropertyBinderUBO._recomputeSharedRanges on runtime paint-property changes).
     */
    markHeaderDirty(): void {
        this._headerDirty = true;
    }

    /**
     * Write all data-driven properties for one feature from a flat evaluation buffer.
     *
     * The feature's block starts at dword offset: featureIndex * dataDrivenBlockSizeDwords.
     * (No constant block — constant properties are passed as uniforms at draw time.)
     * `flat` is produced by the binder's evaluateAllProperties().
     *
     * `skipMask` excludes bits from the per-property copy loop, leaving those dwords untouched —
     * used by the feature-state / dynamic-expression update path to avoid clobbering a property
     * that must survive re-evaluation (e.g. line-dasharray, populated once from the atlas rather
     * than from an expression; see PaintPropertyBinderUBO._immutableAfterPopulateMask).
     */
    writeDataDrivenBlock(flat: Float32Array, featureIndex: number, skipMask: number = 0): void {
        const h = this.headerData;
        const dataDrivenBlockSizeDwords = h[HEADER_BLOCK_SIZE_VEC4] * 4;
        if (dataDrivenBlockSizeDwords === 0) return;
        const base = featureIndex * dataDrivenBlockSizeDwords;
        if (base + dataDrivenBlockSizeDwords > this.propertiesData.length) {
            throw new Error(`UBO write out of bounds: feature index ${featureIndex} exceeds propertiesData capacity`);
        }
        const dataDrivenMask = h[HEADER_DATA_DRIVEN_MASK];
        const propCount = this._propCount();
        for (let i = 0; i < propCount; i++) {
            if ((dataDrivenMask & (1 << i)) === 0) continue;
            if ((skipMask & (1 << i)) !== 0) continue;
            this._copyFromFlat(base + h[HEADER_OFFSETS + i] * 4, i, flat);
        }
        // Track dword range touched so upload() can do a partial bufferSubData.
        if (this._propsDirtyMin === -1 || base < this._propsDirtyMin) this._propsDirtyMin = base;
        const end = base + dataDrivenBlockSizeDwords;
        if (end > this._propsDirtyMax) this._propsDirtyMax = end;
    }

    /**
     * Shrink `propertiesData` to just the dwords actually written, called once on the worker
     * after all features are populated and before transfer. `propertiesData` is allocated at the
     * full UBO capacity (we don't know the final feature count while streaming), but typically
     * only a small prefix is used; slicing here keeps the dead tail off the worker→main wire.
     *
     * `totalBytes` / `propsDwords` stay at full capacity — the GPU buffer is sized from those, and
     * `upload()` only ever uploads the touched `_propsDirty*` range, so the trimmed CPU array still
     * covers every write (including later main-thread feature-state updates, which only rewrite
     * existing in-range blocks). A `.slice()` (not `.subarray()`) is required so the transferred
     * ArrayBuffer is the trimmed length rather than a view over the full backing buffer.
     */
    rightSizeForTransfer(): void {
        const used = this._propsDirtyMax === -1 ? 0 : this._propsDirtyMax;
        if (used < this.propertiesData.length) {
            this.propertiesData = this.propertiesData.slice(0, used);
        }
    }

    /**
     * Upload dirty buffer regions to GPU. Header and block-indices are uploaded
     * at most once (they don't change after construction); properties uploads
     * only the dword range touched by writeDataDrivenBlock since the last upload.
     */
    upload(context: Context): void {
        if (!this.context) this.context = context;
        const gl = context.gl;

        const hasIndexBlock = this._blockNames().length === 3;
        if (!this.headerBuffer || !this.propertiesBuffer || (hasIndexBlock && !this.blockIndicesBuffer)) {
            this._initBuffers(context);
        }

        let didAny = false;

        if (this._headerDirty) {
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.headerBuffer);
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.headerData);
            this._headerDirty = false;
            didAny = true;
        }

        if (this._propsDirtyMin !== -1) {
            const min = this._propsDirtyMin;
            const max = this._propsDirtyMax; // exclusive
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.propertiesBuffer);
            // bufferSubData(target, dstByteOffset, srcData, srcOffset, srcLength) — srcOffset/srcLength
            // are in element units, not bytes.
            gl.bufferSubData(gl.UNIFORM_BUFFER, min * 4, this.propertiesData, min, max - min);
            this._propsDirtyMin = -1;
            this._propsDirtyMax = -1;
            didAny = true;
        }

        if (this._blockIndicesDirty) {
            gl.bindBuffer(gl.UNIFORM_BUFFER, this.blockIndicesBuffer);
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, getBlockIndicesTemplate(this.propsDwords));
            this._blockIndicesDirty = false;
            didAny = true;
        }

        if (didAny) gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    /**
     * Bind all of this layer's UBOs to their binding points for the given shader program.
     *
     * Binding points: batchIndex*n (header), batchIndex*n+1 (properties), and, when this layer
     * has an indirection block, batchIndex*n+2 (indices) — where n = _bindingsPerBatch().
     */
    bind(context: Context, program: WebGLProgram): void {
        const gl = context.gl;

        const bindBlock = (blockName: string, buffer: WebGLBuffer | null, bindingPoint: number) => {
            if (!buffer) return;
            const blockIndex = gl.getUniformBlockIndex(program, blockName);
            if (blockIndex === (gl.INVALID_INDEX as number)) return;
            gl.uniformBlockBinding(program, blockIndex, bindingPoint);
            gl.bindBufferBase(gl.UNIFORM_BUFFER, bindingPoint, buffer);
        };

        const blockNames = this._blockNames();
        const base = this.batchIndex * this._bindingsPerBatch();
        bindBlock(blockNames[0], this.headerBuffer, base);
        bindBlock(blockNames[1], this.propertiesBuffer, base + 1);
        if (blockNames.length === 3) {
            bindBlock(blockNames[2], this.blockIndicesBuffer, base + 2);
        }
    }

    /**
     * Release GPU resources.
     */
    destroy(): void {
        if (this.context) {
            const gl = this.context.gl;
            if (this.headerBuffer)       { gl.deleteBuffer(this.headerBuffer);       this.headerBuffer = null; }
            if (this.propertiesBuffer)   { gl.deleteBuffer(this.propertiesBuffer);   this.propertiesBuffer = null; }
            if (this.blockIndicesBuffer) { gl.deleteBuffer(this.blockIndicesBuffer); this.blockIndicesBuffer = null; }
        }
    }
}
