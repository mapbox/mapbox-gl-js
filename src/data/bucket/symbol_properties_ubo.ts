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
 * Properties 0-7 are GL Native-aligned (3 uvec4 header). Property 8 (translate) is GL JS-specific
 * and uses the previously-unused h[11] slot in the 3-uvec4 header.
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

        // Block indices are write-once identity mapping: blockIndices[i] = i.
        // Deduplication works by assigning duplicate features the same a_feature_index
        // (localFeatureIndex), so the shader maps each index to itself — no indirection needed.
        // This buffer never changes after construction.
        this.blockIndicesData = new Uint32Array(this.propsDwords);
        for (let i = 0; i < this.propsDwords; i++) {
            this.blockIndicesData[i] = i;
        }

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
        h[11] = header.offsets[8]; // translate (GL JS-specific, uses previously-unused slot)
    }

    /**
     * Write all data-driven properties for one feature.
     *
     * The feature's block starts at dword offset: featureIndex * dataDrivenBlockSizeDwords.
     * (No constant block — constant properties are passed as u_spp_* uniforms at draw time.)
     */
    writeDataDrivenBlock(values: Array<PropertyValue | null>, featureIndex: number, header: SymbolPropertyHeader): void {
        const dataDrivenBlockSizeDwords = header.dataDrivenBlockSizeVec4 * 4;
        if (dataDrivenBlockSizeDwords === 0) return;
        const base = featureIndex * dataDrivenBlockSizeDwords;
        if (base + dataDrivenBlockSizeDwords > this.propertiesData.length) {
            throw new Error(`UBO write out of bounds: feature index ${featureIndex} exceeds propertiesData capacity`);
        }
        for (let i = 0; i < 9; i++) {
            if ((header.dataDrivenMask & (1 << i)) === 0) continue;
            if (values[i] === null || values[i] === undefined) continue;
            this._writeProperty(base + header.offsets[i], i, values[i], header.zoomDependentMask);
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
     * Write a single property value at the given dword offset in propertiesData.
     *
     * Colors (propIdx < 2) always occupy 4 dwords — non-premultiplied, packed:
     *   non-zoom → [packed0, packed1, 0, 0]
     *   zoom-dep → [packMin[0], packMin[1], packMax[0], packMax[1]]
     * Floats occupy 1 dword (non-zoom) or 2 dwords (zoom-dep, [min, max]).
     */
    private _writeProperty(dwordOffset: number, propIdx: number, value: PropertyValue, zoomDependentMask: number): void {
        const pd = this.propertiesData;
        // Property order is fixed by the GL Native contract: 0=fill_color, 1=halo_color (colors),
        // 2-7=floats. Property 8 (translate) is GL JS-specific: a vec2.
        // This must stay in sync with _getPropDefs() in symbol_property_binder_ubo.ts.
        const isColor = propIdx < 2;
        const isVec2 = propIdx === 8; // translate: [tx, ty] non-zoom or [tx_min, ty_min, tx_max, ty_max] zoom-dep
        const isZoomDep = (zoomDependentMask & (1 << propIdx)) !== 0;

        if (isColor) {
            const v = value as [number, number, number, number];
            pd[dwordOffset]     = v[0];
            pd[dwordOffset + 1] = v[1];
            pd[dwordOffset + 2] = v[2];
            pd[dwordOffset + 3] = v[3];
        } else if (isVec2 && isZoomDep) {
            // zoom-dep translate: [tx_min, ty_min, tx_max, ty_max], vec4-aligned
            const v = value as [number, number, number, number];
            pd[dwordOffset]     = v[0]; // tx_min
            pd[dwordOffset + 1] = v[1]; // ty_min
            pd[dwordOffset + 2] = v[2]; // tx_max
            pd[dwordOffset + 3] = v[3]; // ty_max
        } else if (isVec2) {
            // non-zoom translate: [tx, ty], 2-aligned (both within same vec4)
            const v = value as [number, number];
            pd[dwordOffset]     = v[0]; // tx
            pd[dwordOffset + 1] = v[1]; // ty
        } else if (isZoomDep) {
            const v = value as [number, number];
            pd[dwordOffset]     = v[0]; // min
            pd[dwordOffset + 1] = v[1]; // max
        } else {
            pd[dwordOffset] = value as number;
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
