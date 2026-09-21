import {register} from '../../util/web_worker_transfer';
import {PaintPropertiesUBO} from './paint_property_ubo';

/**
 * Number of data-driven paint properties the line UBO carries (see the bit table in
 * LinePropertyBinderUBO). Includes `line-dasharray` at bit 10 (a raw, non-zoom-mixed slot — see
 * class doc below) and `line-side-z-offset` at bit 11 (a GL-Native-only property, absent from
 * v8.json — the slot is always constant 0 in GL JS, reserved so GL Native can populate it once
 * Line Shader UBO support lands there).
 */
export const LINE_PROP_COUNT = 12;

/**
 * Number of consecutive UBO binding points a line UBO batch occupies: header + properties. One
 * fewer than symbol's 3 — see the class doc below for why line has no indirection block.
 */
export const LINE_UBO_BINDINGS_PER_BATCH = 2;

/**
 * Manages Uniform Buffer Objects (UBOs) for line paint properties.
 *
 * Uses 2 separate GPU buffers per batch aligned with the GL Native UBO layout:
 *   - Header buffer  (LinePaintPropertiesHeaderUniform): 5 uvec4 layout descriptor
 *   - Properties buffer (LinePaintPropertiesUniform):    per-feature data-driven blocks
 *
 * Binding points: batchIndex*2 (header), batchIndex*2+1 (properties). Unlike symbol, line has no
 * indirection (block-indices) buffer: that buffer exists to let symbol *appearances* deduplicate
 * property blocks, and line has no appearance concept, so `a_feature_index` addresses the
 * properties buffer directly (see readLinePaintProperties() in line.vertex.glsl).
 *
 * Constant properties are NOT stored here — they are passed as u_lpp_* uniforms.
 *
 * Line has none of symbol's appearance/formatted-section/DZR complexity: colors never carry a
 * per-feature-varying zoom range (always the "one shared range across the layer" case), so the
 * header layout is simpler than symbol's, but needs one more dword group to fit 12 properties
 * (vs symbol's 9) worth of offsets:
 *
 *   [HEADER_DATA_DRIVEN_MASK]        bitmask: 1 = property i goes in the per-feature data-driven
 *                                    block; property order (bit index 0-11): line-color,
 *                                    line-border-color, line-opacity, line-blur, line-width,
 *                                    line-gap-width, line-offset, line-floorwidth,
 *                                    line-border-width, line-emissive-strength, line-dasharray,
 *                                    line-side-z-offset (GL-Native-only — see LINE_PROP_COUNT doc
 *                                    above; this bit is never set in GL JS).
 *   [dword 1]                        reserved / always 0 for line (symbol's HEADER_DZR_MASK slot —
 *                                    line has no per-feature-varying zoom ranges at all, so this
 *                                    bit is never set and the shader never reads it).
 *   [HEADER_BLOCK_SIZE_VEC4]         size of the data-driven block in vec4 units.
 *   [HEADER_OFFSETS + i]             vec4-unit offset of property i within the data-driven block
 *                                    (dwords 3..14, one per property — only meaningful when
 *                                    property i's data-driven bit is set). With 12 properties this
 *                                    runs through dword 14 inclusive, leaving only dword 15 as
 *                                    padding — the header has no headroom left for a 13th
 *                                    property without growing HEADER_DWORDS from 20 to 24 (6 uvec4).
 *   [LINE_HEADER_SHARED_ZOOM + 0..3] [colorZm, colorZM, borderZm, borderZM] (as raw float bits,
 *                                    see floatToBits) — the shared [zm, zM] zoom range for
 *                                    line-color / line-border-color, read by the shader instead
 *                                    of a per-feature block slot (colors need all 4 floats of
 *                                    their vec4 for the packed min/max color, leaving no room for
 *                                    a per-feature zoom range). Starts at the next uvec4 boundary
 *                                    (dword 16) rather than immediately after HEADER_OFFSETS,
 *                                    since dword 14 is the last one in use.
 *
 * Every data-driven property occupies a fixed, zoom-ready slot so the shader decode is
 * branchless and uniform for constant / zoom-interpolated cases alike (one `zoomFactor` + one
 * `mix`); non-zoom values simply duplicate min into max. Every property here is exactly 1 vec4
 * (no symbol-style DZR 2-vec4 case exists for line):
 *   float:  1 vec4  [min, max, zm, zM]
 *   color:  1 vec4  [packMin0, packMin1, packMax0, packMax1] (zoom range read from LINE_HEADER_SHARED_ZOOM)
 *   dash:   1 vec4  raw, non-zoom-mixed atlas descriptor [y, halfHeight|coverage<<4, lengthInt,
 *                    lengthFract] (see LineAtlas.addDash) — dash is never zoom-interpolated or
 *                    feature-state dependent, so its slot is copied verbatim, not min/max mixed.
 *
 * Because every property is uniformly 4 dwords in both the flat evaluation buffer and the block,
 * `writeDataDrivenBlock`/`_copyFromFlat` is a single unconditional 4-float copy — no
 * isColor/isTranslate branching like symbol's version needs. This holds for dash too, since its
 * slot is also exactly 4 floats; only the *meaning* of those floats (raw vs. zoom-ready
 * [min,max,zm,zM]) differs, and that's a shader-side concern, not this class's.
 *
 * See PaintPropertiesUBO for the shared buffer machinery (allocation, dirty tracking, upload,
 * bind, destroy).
 */
export class LinePropertiesUBO extends PaintPropertiesUBO {
    static readonly HEADER_DWORDS = 20; // 5 uvec4s (never changes)
    static readonly HEADER_BYTES = 80;  // HEADER_DWORDS * 4

    // Line-local shared-zoom header offset (see class doc above for why this can't reuse
    // symbol's HEADER_SHARED_ZOOM = 12).
    static readonly LINE_HEADER_SHARED_ZOOM = 16;

    // Flat evaluation buffer layout — every property is exactly 4 floats (see class doc), so this
    // is a simple uniform stride, unlike symbol's per-property-kind offsets:
    //   color[0..3], border_color[4..7], opacity[8..11], blur[12..15], width[16..19],
    //   gap_width[20..23], offset[24..27], floorwidth[28..31], border_width[32..35],
    //   emissive_strength[36..39], dash[40..43], side_z_offset[44..47]
    static readonly EVAL_FLAT_OFFSETS: readonly number[] = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44];
    static readonly EVAL_FLAT_TOTAL = 48;

    protected _headerBytes(): number {
        return LinePropertiesUBO.HEADER_BYTES;
    }

    protected _propCount(): number {
        return LINE_PROP_COUNT;
    }

    protected _blockNames(): readonly [string, string] {
        return ['LinePaintPropertiesHeaderUniform', 'LinePaintPropertiesUniform'];
    }

    protected override _bindingsPerBatch(): number {
        return LINE_UBO_BINDINGS_PER_BATCH;
    }

    /**
     * Copy one property's slot from the flat evaluation buffer into propertiesData. Every
     * property (color, float, or raw dash) is exactly 4 dwords in both the flat buffer and the
     * block, so this is an unconditional copy — no DZR/isColor branching needed (see class doc).
     */
    protected _copyFromFlat(dwordOffset: number, propIdx: number, flat: Float32Array): void {
        const flatOffset = LinePropertiesUBO.EVAL_FLAT_OFFSETS[propIdx];
        this.propertiesData.set(flat.subarray(flatOffset, flatOffset + 4), dwordOffset);
    }
}

register(LinePropertiesUBO, 'LinePropertiesUBO', {omit: ['headerBuffer', 'propertiesBuffer', 'blockIndicesBuffer']});
