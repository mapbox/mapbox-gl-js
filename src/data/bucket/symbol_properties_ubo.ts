import assert from '../../style-spec/util/assert';
import {register} from '../../util/web_worker_transfer';

import type Context from '../../gl/context';

/**
 * The UBO layout header is a flat Uint32Array of 16 dwords (4 uvec4), built once per layer by
 * SymbolPropertyBinderUBO.updateHeader() and uploaded to the GPU verbatim (matching GL Native and
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
 * Property order (bit index 0-8): fill_color, halo_color, opacity, halo_width, halo_blur,
 * emissive_strength, occlusion_opacity, z_offset, translate.
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

/**
 * Manages Uniform Buffer Objects (UBOs) for symbol paint properties.
 *
 * Uses 3 separate GPU buffers per batch aligned with the GL Native UBO layout:
 *   - Header buffer  (SymbolPaintPropertiesHeaderUniform): 4 uvec4 layout descriptor
 *   - Properties buffer (SymbolPaintPropertiesUniform):   per-feature data-driven blocks
 *   - Block indices buffer (SymbolPaintPropertiesIndexUniform): feature→block index mapping
 *
 * Binding points: batchIndex*3 (header), batchIndex*3+1 (properties), batchIndex*3+2 (indices).
 *
 * Constant properties are NOT stored here — they are passed as u_spp_* uniforms.
 */
export class SymbolPropertiesUBO {
    static readonly HEADER_DWORDS = 16; // 4 uvec4s (never changes)
    static readonly HEADER_BYTES = 64;  // HEADER_DWORDS * 4

    // Flat evaluation buffer layout — per-property start offset in a Float32Array(EVAL_FLAT_TOTAL),
    // mirroring the data-driven block's zoom-ready slot shape exactly (see the layout doc above), so
    // writeDataDrivenBlock/_copyFromFlat below are unconditional contiguous copies:
    //   fill_color[0..7], halo_color[8..15]        — [value(4), zoomRange(4)] each
    //   opacity[16..19], halo_width[20..23], halo_blur[24..27], emissive_strength[28..31],
    //   occlusion_opacity[32..35], z_offset[36..39] — [min, max, zm, zM] each
    //   translate[40..47]                           — [value(4), zoomRange(4)]
    static readonly EVAL_FLAT_OFFSETS: readonly number[] = [0, 8, 16, 20, 24, 28, 32, 36, 40];
    static readonly EVAL_FLAT_TOTAL = 48;

    // The block-indices buffer is a pure identity mapping (blockIndices[i] = i): dedup currently
    // happens at the vertex-attribute level (duplicate features get the same index written into the
    // vertex buffer), so no indirection is needed here. Because it carries no per-instance state, all
    // batches share one read-only template rather than each allocating — and serializing — its own
    // 16 KB copy. When layout properties move to UBOs this will hold real per-layer indices and need
    // to become per-instance again (it'll deduplicate paint properties, with a sibling array for
    // layout properties); restore the per-instance copy then. uboSizeDwords is constant per session
    // (derived from device limits), so a single template size is safe.
    private static _blockIndicesTemplate: Uint32Array | null = null;

    private static getBlockIndices(propsDwords: number): Uint32Array {
        let template = SymbolPropertiesUBO._blockIndicesTemplate;
        if (!template) {
            template = SymbolPropertiesUBO._blockIndicesTemplate = new Uint32Array(propsDwords);
            for (let i = 0; i < propsDwords; i++) template[i] = i;
        }
        assert(template.length === propsDwords, 'block-indices template size mismatch across batches');
        return template;
    }

    propsDwords: number;           // dword count for u_properties
    totalBytes: number;            // byte size of each of properties / block-indices buffers
    headerData: Uint32Array;       // 16 uint32s (4 uvec4s)
    propertiesData: Float32Array;  // propsDwords floats — data-driven blocks only
    headerBuffer: WebGLBuffer | null;
    propertiesBuffer: WebGLBuffer | null;
    blockIndicesBuffer: WebGLBuffer | null;
    batchIndex: number;
    context: Context | null;
    // Dirty tracking: each flag/range marks data that needs uploading to GPU.
    // headerDirty: true after construction (triggers the first upload) and again whenever
    // markHeaderDirty() is called — the HEADER_SHARED_ZOOM slots can change at runtime (see
    // SymbolPropertyBinderUBO._recomputeSharedRanges), unlike the rest of the header.
    // propsDirtyMin/Max: dword range touched by writeDataDrivenBlock; -1 means clean.
    // blockIndicesDirty: the shared identity template is uploaded once per batch's GPU buffer,
    // so this clears after the first upload and stays false.
    _headerDirty: boolean;
    _propsDirtyMin: number;
    _propsDirtyMax: number;
    _blockIndicesDirty: boolean;

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
        // gets dirtied as features are written.
        this._headerDirty = true;
        this._propsDirtyMin = -1;
        this._propsDirtyMax = -1;
        this._blockIndicesDirty = true;

        if (context) {
            this._initBuffers(context);
        }
    }

    private _initBuffers(context: Context): void {
        const gl = context.gl;

        if (this.totalBytes > context.maxUniformBlockSize) {
            throw new Error(`UBO size ${this.totalBytes} exceeds device limit ${context.maxUniformBlockSize}`);
        }

        this.headerBuffer = gl.createBuffer();
        if (!this.headerBuffer) throw new Error('Failed to create header UBO buffer');
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.headerBuffer);
        gl.bufferData(gl.UNIFORM_BUFFER, SymbolPropertiesUBO.HEADER_BYTES, gl.DYNAMIC_DRAW);

        this.propertiesBuffer = gl.createBuffer();
        if (!this.propertiesBuffer) throw new Error('Failed to create properties UBO buffer');
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.propertiesBuffer);
        gl.bufferData(gl.UNIFORM_BUFFER, this.totalBytes, gl.DYNAMIC_DRAW);

        this.blockIndicesBuffer = gl.createBuffer();
        if (!this.blockIndicesBuffer) throw new Error('Failed to create block-indices UBO buffer');
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.blockIndicesBuffer);
        gl.bufferData(gl.UNIFORM_BUFFER, this.totalBytes, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    /**
     * Marks the header buffer for re-upload. Call after mutating `headerData` in place post-
     * construction (currently only HEADER_SHARED_ZOOM, refreshed by
     * SymbolPropertyBinderUBO._recomputeSharedRanges on runtime paint-property changes).
     */
    markHeaderDirty(): void {
        this._headerDirty = true;
    }

    /**
     * Write all data-driven properties for one feature from a flat evaluation buffer.
     *
     * The feature's block starts at dword offset: featureIndex * dataDrivenBlockSizeDwords.
     * (No constant block — constant properties are passed as u_spp_* uniforms at draw time.)
     * `flat` is a Float32Array(EVAL_FLAT_TOTAL) produced by evaluateAllProperties().
     */
    writeDataDrivenBlock(flat: Float32Array, featureIndex: number): void {
        const h = this.headerData;
        const dataDrivenBlockSizeDwords = h[HEADER_BLOCK_SIZE_VEC4] * 4;
        if (dataDrivenBlockSizeDwords === 0) return;
        const base = featureIndex * dataDrivenBlockSizeDwords;
        if (base + dataDrivenBlockSizeDwords > this.propertiesData.length) {
            throw new Error(`UBO write out of bounds: feature index ${featureIndex} exceeds propertiesData capacity`);
        }
        const dataDrivenMask = h[HEADER_DATA_DRIVEN_MASK];
        for (let i = 0; i < 9; i++) {
            if ((dataDrivenMask & (1 << i)) === 0) continue;
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
     * Copy one property's slot from the flat evaluation buffer into propertiesData. Scalars
     * always copy 4 dwords (just the packed value). Colors and translate copy 4 dwords (just the
     * value) unless this property's HEADER_DZR_MASK bit is set, where they copy 8 (value vec4 +
     * [zm, zM, pad, pad]) — see the HEADER_DZR_MASK doc above. The flat buffer's layout (see
     * EVAL_FLAT_OFFSETS) always has room for the full 8, so slicing a smaller prefix when not
     * needed is safe.
     */
    private _copyFromFlat(dwordOffset: number, propIdx: number, flat: Float32Array): void {
        const isColor = propIdx < 2;
        const isTranslate = propIdx === 8;
        let size = 4;
        if (isColor || isTranslate) {
            const isDzr = ((this.headerData[HEADER_DZR_MASK] >>> propIdx) & 1) !== 0;
            size = isDzr ? 8 : 4;
        }
        const flatOffset = SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[propIdx];
        this.propertiesData.set(flat.subarray(flatOffset, flatOffset + size), dwordOffset);
    }

    /**
     * Upload dirty buffer regions to GPU. Header and block-indices are uploaded
     * at most once (they don't change after construction); properties uploads
     * only the dword range touched by writeDataDrivenBlock since the last upload.
     */
    upload(context: Context): void {
        if (!this.context) this.context = context;
        const gl = context.gl;

        if (!this.headerBuffer || !this.propertiesBuffer || !this.blockIndicesBuffer) {
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
            gl.bufferSubData(gl.UNIFORM_BUFFER, 0, SymbolPropertiesUBO.getBlockIndices(this.propsDwords));
            this._blockIndicesDirty = false;
            didAny = true;
        }

        if (didAny) gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    /**
     * Bind all 3 UBOs to their binding points for the given shader program.
     *
     * Binding points: batchIndex*3 (header), batchIndex*3+1 (properties), batchIndex*3+2 (indices).
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

        const base = this.batchIndex * 3;
        bindBlock('SymbolPaintPropertiesHeaderUniform',  this.headerBuffer,       base);
        bindBlock('SymbolPaintPropertiesUniform',        this.propertiesBuffer,   base + 1);
        bindBlock('SymbolPaintPropertiesIndexUniform',   this.blockIndicesBuffer, base + 2);
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

register(SymbolPropertiesUBO, 'SymbolPropertiesUBO', {omit: ['headerBuffer', 'propertiesBuffer', 'blockIndicesBuffer']});
