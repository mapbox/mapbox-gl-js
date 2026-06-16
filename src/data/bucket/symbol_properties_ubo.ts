import assert from '../../style-spec/util/assert';
import {register} from '../../util/web_worker_transfer';

import type Context from '../../gl/context';

/**
 * The UBO layout header is a flat Uint32Array of 12 dwords (3 uvec4), built once per layer by
 * SymbolPropertyBinderUBO.updateHeader() and uploaded to the GPU verbatim (matching GL Native and
 * the shader's SymbolPropertyHeader struct). These constants name its dword slots:
 *
 *   [HEADER_DATA_DRIVEN_MASK]     bitmask: 1 = property goes in the per-feature data-driven block
 *   [HEADER_ZOOM_DEPENDENT_MASK]  low 16 bits: 1 = property uses zoom interpolation (composite kind).
 *                                 high 16 bits (>> HEADER_APPEARANCE_ZOOM_STOPS_SHIFT): 1 = appearances
 *                                 override this property with differing zoom stops, so its zoom range
 *                                 [zm, zM] is stored per feature in  the data-driven block
 *   [HEADER_BLOCK_SIZE_VEC4]      size of the data-driven block in vec4 units (0 when no DD props)
 *   [HEADER_OFFSETS + i]          dword offset of property i within the data-driven block
 *                                 (only meaningful when property i's data-driven bit is set)
 *
 * Property order (bit index 0-8): fill_color, halo_color, opacity, halo_width, halo_blur,
 * emissive_strength, occlusion_opacity, z_offset, translate.
 */
export const HEADER_DATA_DRIVEN_MASK = 0;
export const HEADER_ZOOM_DEPENDENT_MASK = 1;
export const HEADER_BLOCK_SIZE_VEC4 = 2;
export const HEADER_OFFSETS = 3;

// Bit shift for the appearance-zoom-stops flags packed into the high half of the HEADER_ZOOM_DEPENDENT_MASK dword.
export const HEADER_APPEARANCE_ZOOM_STOPS_SHIFT = 16;

/**
 * A packed value for writing into the UBO's data-driven properties array.
 *
 * Colors (property indices 0-1) — always non-premultiplied; the fragment shader premultiplies:
 *   non-zoom → [packed0, packed1, 0, 0]  (2 floats via packUint8ToFloat + 2 padding)
 *   zoom-dep → [packColor(min)[0], packColor(min)[1], packColor(max)[0], packColor(max)[1]]
 * Floats (property indices 2-7):
 *   non-zoom → single number
 *   zoom-dep → [min, max]
 * Vec2 (property index 8, translate):
 *   non-zoom → [tx, ty]
 *   zoom-dep → [tx_min, ty_min, tx_max, ty_max] (vec4-aligned in the data block)
 */
export type PropertyValue = number | [number, number] | [number, number, number, number];

/**
 * Manages Uniform Buffer Objects (UBOs) for symbol paint properties.
 *
 * Uses 3 separate GPU buffers per batch aligned with the GL Native UBO layout:
 *   - Header buffer  (SymbolPaintPropertiesHeaderUniform): 3 uvec4 layout descriptor
 *   - Properties buffer (SymbolPaintPropertiesUniform):   per-feature data-driven blocks
 *   - Block indices buffer (SymbolPaintPropertiesIndexUniform): feature→block index mapping
 *
 * Binding points: batchIndex*3 (header), batchIndex*3+1 (properties), batchIndex*3+2 (indices).
 *
 * Constant properties are NOT stored here — they are passed as u_spp_* uniforms.
 */
export class SymbolPropertiesUBO {
    static readonly HEADER_DWORDS = 12; // 3 uvec4s (never changes)
    static readonly HEADER_BYTES = 48;  // HEADER_DWORDS * 4

    // Flat evaluation buffer layout — per-property start offset in a Float32Array(EVAL_FLAT_TOTAL).
    // fill_color[0..3], halo_color[4..7], opacity[8..9], halo_width[10..11],
    // halo_blur[12..13], emissive_strength[14..15], occlusion_opacity[16..17],
    // z_offset[18..19], translate[20..23]
    // Each property also gets a 2-slot [zm, zM] zoom range starting at EVAL_FLAT_ZOOM_OFFSETS[i]
    // ([24,25] … [40,41]); only written for appearance-zoom-stops properties.
    // Colors and translate always use 4 slots; scalars always use 2 (second = 0 for non-zoom).
    static readonly EVAL_FLAT_OFFSETS: readonly number[] = [0, 4, 8, 10, 12, 14, 16, 18, 20];
    static readonly EVAL_FLAT_ZOOM_OFFSETS: readonly number[] = [24, 26, 28, 30, 32, 34, 36, 38, 40];
    static readonly EVAL_FLAT_TOTAL = 42;

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
    headerData: Uint32Array;       // 12 uint32s (3 uvec4s)
    propertiesData: Float32Array;  // propsDwords floats — data-driven blocks only
    headerBuffer: WebGLBuffer | null;
    propertiesBuffer: WebGLBuffer | null;
    blockIndicesBuffer: WebGLBuffer | null;
    batchIndex: number;
    context: Context | null;
    // Dirty tracking: each flag/range marks data that needs uploading to GPU.
    // headerDirty: the header is built once and passed in at construction, so this just
    // triggers a single upload, then stays false.
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
        const zoomDependentMask = h[HEADER_ZOOM_DEPENDENT_MASK];
        const appearanceZoomStopsMask = zoomDependentMask >>> HEADER_APPEARANCE_ZOOM_STOPS_SHIFT;
        for (let i = 0; i < 9; i++) {
            if ((dataDrivenMask & (1 << i)) === 0) continue;
            this._copyFromFlat(base + h[HEADER_OFFSETS + i], i, flat, SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[i], zoomDependentMask, appearanceZoomStopsMask);
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
     * Copy one property's values from the flat evaluation buffer into propertiesData.
     *
     * Colors (propIdx < 2) and zoom-dep translate always copy 4 dwords.
     * Non-zoom translate and zoom-dep scalars copy 2 dwords. Non-zoom scalars copy 1 dword.
     *
     * Appearance-zoom-stops properties additionally carry a [zm, zM] pair, written after
     * the value data: at relative dwords +4/+5 for colors/translate (the next vec4) and +2/+3 for
     * scalars (the third/fourth dword of the value's vec4).
     */
    private _copyFromFlat(dwordOffset: number, propIdx: number, flat: Float32Array, flatOffset: number, zoomDependentMask: number, appearanceZoomStopsMask: number): void {
        const isColor = propIdx < 2;
        const isVec2 = propIdx === 8;
        const isZoomDep = (zoomDependentMask & (1 << propIdx)) !== 0;
        const count = isColor || (isVec2 && isZoomDep) ? 4 : (isVec2 || isZoomDep) ? 2 : 1;

        this.propertiesData.set(flat.subarray(flatOffset, flatOffset + count), dwordOffset);

        if ((appearanceZoomStopsMask & (1 << propIdx)) !== 0) {
            const zoomRel = isColor || isVec2 ? 4 : 2;
            const zStart = SymbolPropertiesUBO.EVAL_FLAT_ZOOM_OFFSETS[propIdx];
            this.propertiesData[dwordOffset + zoomRel] = flat[zStart];
            this.propertiesData[dwordOffset + zoomRel + 1] = flat[zStart + 1];
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
