import {register} from '../../util/web_worker_transfer';
import {PaintPropertiesUBO, HEADER_DZR_MASK} from './paint_property_ubo';

/**
 * Manages Uniform Buffer Objects (UBOs) for symbol paint properties.
 *
 * Property order (bit index 0-8): fill_color, halo_color, opacity, halo_width, halo_blur,
 * emissive_strength, occlusion_opacity, z_offset, translate.
 *
 * Uses 3 separate GPU buffers per batch aligned with the GL Native UBO layout:
 *   - Header buffer  (SymbolPaintPropertiesHeaderUniform): 4 uvec4 layout descriptor
 *   - Properties buffer (SymbolPaintPropertiesUniform):   per-feature data-driven blocks
 *   - Block indices buffer (SymbolPaintPropertiesIndexUniform): feature→block index mapping
 *
 * Binding points: batchIndex*3 (header), batchIndex*3+1 (properties), batchIndex*3+2 (indices).
 *
 * Constant properties are NOT stored here — they are passed as u_spp_* uniforms.
 *
 * See PaintPropertiesUBO for the shared buffer machinery (allocation, dirty tracking, upload,
 * bind, destroy).
 */
export class SymbolPropertiesUBO extends PaintPropertiesUBO {
    static readonly HEADER_DWORDS = 16; // 4 uvec4s (never changes)
    static readonly HEADER_BYTES = 64;  // HEADER_DWORDS * 4

    // Flat evaluation buffer layout — per-property start offset in a Float32Array(EVAL_FLAT_TOTAL),
    // mirroring the data-driven block's zoom-ready slot shape exactly (see the layout doc in
    // paint_property_ubo.ts), so writeDataDrivenBlock/_copyFromFlat below are unconditional
    // contiguous copies:
    //   fill_color[0..7], halo_color[8..15]        — [value(4), zoomRange(4)] each
    //   opacity[16..19], halo_width[20..23], halo_blur[24..27], emissive_strength[28..31],
    //   occlusion_opacity[32..35], z_offset[36..39] — [min, max, zm, zM] each
    //   translate[40..47]                           — [value(4), zoomRange(4)]
    static readonly EVAL_FLAT_OFFSETS: readonly number[] = [0, 8, 16, 20, 24, 28, 32, 36, 40];
    static readonly EVAL_FLAT_TOTAL = 48;

    protected _headerBytes(): number {
        return SymbolPropertiesUBO.HEADER_BYTES;
    }

    protected _propCount(): number {
        return 9;
    }

    protected _blockNames(): readonly [string, string, string] {
        return ['SymbolPaintPropertiesHeaderUniform', 'SymbolPaintPropertiesUniform', 'SymbolPaintPropertiesIndexUniform'];
    }

    /**
     * Copy one property's slot from the flat evaluation buffer into propertiesData. Scalars
     * always copy 4 dwords (just the packed value). Colors and translate copy 4 dwords (just the
     * value) unless this property's HEADER_DZR_MASK bit is set, where they copy 8 (value vec4 +
     * [zm, zM, pad, pad]) — see the HEADER_DZR_MASK doc in paint_property_ubo.ts. The flat buffer's
     * layout (see EVAL_FLAT_OFFSETS) always has room for the full 8, so slicing a smaller prefix
     * when not needed is safe.
     */
    protected _copyFromFlat(dwordOffset: number, propIdx: number, flat: Float32Array): void {
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
}

register(SymbolPropertiesUBO, 'SymbolPropertiesUBO', {omit: ['headerBuffer', 'propertiesBuffer', 'blockIndicesBuffer']});
