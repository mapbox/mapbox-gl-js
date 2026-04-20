import {register} from '../../util/web_worker_transfer';

import type Context from '../../gl/context';

/**
 * Describes how paint properties are laid out in the UBO.
 *
 * Property order (bit index 0-8): fill_color, halo_color, opacity,
 * halo_width, halo_blur, emissive_strength, occlusion_opacity, z_offset, translate.
 *
 * dataDrivenMask      – bitmask: 1 = property goes in per-feature data-driven block
 * zoomDependentMask   – bitmask: 1 = property uses zoom interpolation (composite kind)
 * cameraMask          – bitmask: 1 = property is a camera (zoom-only) expression
 * dataDrivenBlockSizeVec4 – size of data-driven block in vec4 units (0 when dataDrivenMask=0)
 * offsets[i]          – dword offset of property i within the data-driven block
 *                       (only meaningful for properties with the dataDrivenMask bit set)
 *
 */
export type SymbolPropertyHeader = {
    dataDrivenMask: number;
    zoomDependentMask: number;
    cameraMask: number;
    dataDrivenBlockSizeVec4: number;
    offsets: [number, number, number, number, number, number, number, number, number];
};

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

    // Flat evaluation buffer layout — per-property start offsets and slot counts in a Float32Array(EVAL_FLAT_TOTAL).
    // fill_color[0..3], halo_color[4..7], opacity[8..9], halo_width[10..11],
    // halo_blur[12..13], emissive_strength[14..15], occlusion_opacity[16..17],
    // z_offset[18..19], translate[20..23].
    // Colors and translate always use 4 slots; scalars always use 2 (second = 0 for non-zoom).
    static readonly EVAL_FLAT_OFFSETS: readonly number[] = [0, 4, 8, 10, 12, 14, 16, 18, 20];
    static readonly EVAL_FLAT_SIZES: readonly number[]   = [4, 4, 2,  2,  2,  2,  2,  2,  4];
    static readonly EVAL_FLAT_TOTAL = 24;

    // Until we support layout properties in UBOs, blockIndicesData is just
    // an identity mapping since deduplication happens at the vertex attribute level
    // (duplicate features get the same index written into the vertex buffer, so no
    // indirection is needed). When we move layout properties to UBO we'll use this
    // array to deduplicate paint properties and add a new array for layout properties
    // deduplication.
    // Until we need that, we just create the identity-mapping once and create a copy
    // of it
    private static _blockIndicesTemplate: Uint32Array | null = null;

    propsDwords: number;           // dword count for u_properties
    totalBytes: number;            // byte size of each of properties / block-indices buffers
    headerData: Uint32Array;       // 12 uint32s (3 uvec4s)
    propertiesData: Float32Array;  // propsDwords floats — data-driven blocks only
    blockIndicesData: Uint32Array; // propsDwords uint32s — identity: blockIndicesData[i] = i
    headerBuffer: WebGLBuffer | null;
    propertiesBuffer: WebGLBuffer | null;
    blockIndicesBuffer: WebGLBuffer | null;
    batchIndex: number;
    context: Context | null;

    constructor(context: Context | null | undefined = null, batchIndex: number = 0, uboSizeDwords: number = 4096) {
        this.batchIndex = batchIndex;
        this.headerBuffer = null;
        this.propertiesBuffer = null;
        this.blockIndicesBuffer = null;
        this.context = context || null;
        this.propsDwords = uboSizeDwords;
        this.totalBytes = this.propsDwords * 4;
        this.headerData = new Uint32Array(SymbolPropertiesUBO.HEADER_DWORDS);
        this.propertiesData = new Float32Array(this.propsDwords);

        if (!SymbolPropertiesUBO._blockIndicesTemplate) {
            SymbolPropertiesUBO._blockIndicesTemplate = new Uint32Array(this.propsDwords);
            for (let i = 0; i < this.propsDwords; i++) {
                SymbolPropertiesUBO._blockIndicesTemplate[i] = i;
            }
        }
        this.blockIndicesData = new Uint32Array(SymbolPropertiesUBO._blockIndicesTemplate);

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
     * Write the 3-uvec4 header from a SymbolPropertyHeader descriptor.
     *
     * Layout (matching GL Native):
     *   u_header[0] = { dataDrivenMask, zoomDependentMask, dataDrivenBlockSizeVec4, offsets[0] }
     *   u_header[1] = { offsets[1], offsets[2], offsets[3], offsets[4] }
     *   u_header[2] = { offsets[5], offsets[6], offsets[7], 0 }
     */
    writeHeader(header: SymbolPropertyHeader): void {
        const h = this.headerData;
        h[0]  = header.dataDrivenMask;
        h[1]  = header.zoomDependentMask;
        h[2]  = header.dataDrivenBlockSizeVec4;
        h[3]  = header.offsets[0]; // fill_np_color
        h[4]  = header.offsets[1]; // halo_np_color
        h[5]  = header.offsets[2]; // opacity
        h[6]  = header.offsets[3]; // halo_width
        h[7]  = header.offsets[4]; // halo_blur
        h[8]  = header.offsets[5]; // emissive_strength
        h[9]  = header.offsets[6]; // occlusion_opacity
        h[10] = header.offsets[7]; // z_offset
        h[11] = header.offsets[8]; // translate
    }

    /**
     * Write all data-driven properties for one feature from a flat evaluation buffer.
     *
     * The feature's block starts at dword offset: featureIndex * dataDrivenBlockSizeDwords.
     * (No constant block — constant properties are passed as u_spp_* uniforms at draw time.)
     * `flat` is a Float32Array(EVAL_FLAT_TOTAL) produced by evaluateAllProperties().
     */
    writeDataDrivenBlock(flat: Float32Array, featureIndex: number, header: SymbolPropertyHeader): void {
        const dataDrivenBlockSizeDwords = header.dataDrivenBlockSizeVec4 * 4;
        if (dataDrivenBlockSizeDwords === 0) return;
        const base = featureIndex * dataDrivenBlockSizeDwords;
        if (base + dataDrivenBlockSizeDwords > this.propertiesData.length) {
            throw new Error(`UBO write out of bounds: feature index ${featureIndex} exceeds propertiesData capacity`);
        }
        for (let i = 0; i < 9; i++) {
            if ((header.dataDrivenMask & (1 << i)) === 0) continue;
            this._copyFromFlat(base + header.offsets[i], i, flat, SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[i], header.zoomDependentMask);
        }
    }

    /**
     * Maximum number of features that fit in one UBO batch given a header.
     * Returns Infinity when dataDrivenBlockSizeVec4 is 0 (all properties constant).
     */
    static getMaxFeatureCount(header: SymbolPropertyHeader, propsDwords: number = 4096): number {
        const dataDrivenBlockSizeDwords = header.dataDrivenBlockSizeVec4 * 4;
        if (dataDrivenBlockSizeDwords === 0) return Infinity;
        return Math.floor(propsDwords / dataDrivenBlockSizeDwords);
    }

    /**
     * Copy one property's values from the flat evaluation buffer into propertiesData.
     *
     * Colors (propIdx < 2) and zoom-dep translate always copy 4 dwords.
     * Non-zoom translate and zoom-dep scalars copy 2 dwords. Non-zoom scalars copy 1 dword.
     */
    private _copyFromFlat(dwordOffset: number, propIdx: number, flat: Float32Array, flatOffset: number, zoomDependentMask: number): void {
        const pd = this.propertiesData;
        const isColor = propIdx < 2;
        const isVec2 = propIdx === 8;
        const isZoomDep = (zoomDependentMask & (1 << propIdx)) !== 0;

        if (isColor || (isVec2 && isZoomDep)) {
            pd[dwordOffset]     = flat[flatOffset];
            pd[dwordOffset + 1] = flat[flatOffset + 1];
            pd[dwordOffset + 2] = flat[flatOffset + 2];
            pd[dwordOffset + 3] = flat[flatOffset + 3];
        } else if (isVec2 || isZoomDep) {
            pd[dwordOffset]     = flat[flatOffset];
            pd[dwordOffset + 1] = flat[flatOffset + 1];
        } else {
            pd[dwordOffset] = flat[flatOffset];
        }
    }

    /**
     * Upload all 3 buffers to GPU.
     */
    upload(context: Context): void {
        if (!this.context) this.context = context;
        const gl = context.gl;

        if (!this.headerBuffer || !this.propertiesBuffer || !this.blockIndicesBuffer) {
            this._initBuffers(context);
        }

        gl.bindBuffer(gl.UNIFORM_BUFFER, this.headerBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.headerData);

        gl.bindBuffer(gl.UNIFORM_BUFFER, this.propertiesBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.propertiesData);

        gl.bindBuffer(gl.UNIFORM_BUFFER, this.blockIndicesBuffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.blockIndicesData);

        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
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
