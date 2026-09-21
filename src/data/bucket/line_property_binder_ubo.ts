import {LinePropertiesUBO, LINE_PROP_COUNT, LINE_UBO_BINDINGS_PER_BATCH} from './line_properties_ubo';
import {HEADER_DATA_DRIVEN_MASK, HEADER_BLOCK_SIZE_VEC4, HEADER_OFFSETS, floatToBits} from './paint_property_ubo';
import {PaintPropertyBinderUBO} from './paint_property_binder_ubo';
import {register} from '../../util/web_worker_transfer';

import type {EvaluationContext} from './paint_property_binder_ubo';
import type EvaluationParameters from '../../style/evaluation_parameters';
import type LineStyleLayer from '../../style/style_layer/line_style_layer';
import type {LUT} from '../../util/lut';
import type {Feature, FeatureState} from '../../style-spec/expression';
import type {SpritePosition} from '../../util/image';
import type {CanonicalTileID} from '../../source/tile_id';
import type {ImageId} from '../../style-spec/expression/types/image_id';
import type {FormattedSection} from '../../style-spec/expression/types/formatted';
import type SymbolAppearance from '../../style/appearance';

// Bit index → paint property name (see LinePropertiesUBO's class doc for the full layout).
// `line-floorwidth` is not a real v8.json paint property — it's derived at
// layer.recalculate() time (see line_style_layer.ts) and stashed into paint._values, so it's
// read the same way as any other property here via `_paintGet` (which bypasses paint.get()'s
// compile-time key restriction). `line-dasharray` is a real paint property but is special-cased
// throughout this file (see DASH_BIT_INDEX below) — it carries no expression to evaluate against
// a feature; its value comes from the tile's LineAtlas instead.
const PROP_NAMES: readonly string[] = [
    'line-color',
    'line-border-color',
    'line-opacity',
    'line-blur',
    'line-width',
    'line-gap-width',
    'line-offset',
    'line-floorwidth',
    'line-border-width',
    'line-emissive-strength',
    'line-dasharray',
    // GL-Native-only: absent from v8.json, so `_paintGet`/`_layerUnevaluated` always return
    // undefined for it here and it is always treated as constant (value 0) in GL JS. The slot
    // exists so GL Native can populate it once Line Shader UBO support lands there.
    'line-side-z-offset'
];

// Bitmask bit for 'line-floorwidth' in LinePropertyBinderUBO.header[HEADER_DATA_DRIVEN_MASK] —
// used by draw_line.ts to decide whether the constant-zoom-stabilization floorwidth override
// (which only applies when floorwidth is NOT data-driven) is safe to apply.
export const FLOORWIDTH_BIT = 1 << PROP_NAMES.indexOf('line-floorwidth');

// Bit index for 'line-dasharray'. Unlike every other property here, its data-driven-ness depends
// on `line-cap` too (see updateHeader), it never carries a zoom range, and it is populated from
// the tile's LineAtlas rather than from `prop.evaluate()` — see the dash-specific overrides below.
const DASH_BIT_INDEX = PROP_NAMES.indexOf('line-dasharray');
// Exported so LineBucket.addFeature can tell whether *this* layer's dash is data-driven before
// treating `feature.patterns[layer.id]` as a dash key — that map is keyed by layer id but reused
// for pattern image keys (set by addPatternDependencies) on layers that have a line-pattern
// instead, so the bit check is needed to avoid misreading one for the other.
export const DASH_BIT = 1 << DASH_BIT_INDEX;
const DASH_FLAT_OFFSET = LinePropertiesUBO.EVAL_FLAT_OFFSETS[DASH_BIT_INDEX];

// Default value per property, indexed like PROP_NAMES (colors default via getColor/the "no prop"
// branch in _evaluateColorValue, so their entries here are unused placeholders; dash's entry is
// likewise unused — its flat slot is always written explicitly, see evaluateAllProperties below).
const PROP_DEFAULTS: readonly number[] = [0, 0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0, 0.0];

// Flat scratch buffer for evaluateAllProperties — reused per call, eliminates per-feature inner array allocations.
const evalFlatScratch = new Float32Array(LinePropertiesUBO.EVAL_FLAT_TOTAL);

/**
 * Constant property values ready to be set as u_lpp_* uniforms.
 */
export type LineConstantUniformValues = {
    color_np_color: [number, number, number, number];
    border_np_color: [number, number, number, number];
    opacity: number;
    blur: number;
    width: number;
    gap_width: number;
    offset: number;
    floorwidth: number;
    border_width: number;
    emissive_strength: number;
    side_z_offset: number;
};

/**
 * Manages UBO-based line paint properties.
 *
 * Modeled on SymbolPropertyBinderUBO (via the shared PaintPropertyBinderUBO base) but
 * substantially simpler: line has no appearances, no formatted sections, and no
 * per-feature-varying zoom ranges (DZR) — every zoom-dependent property's range is shared across
 * the whole layer. See line_properties_ubo.ts for the exact header/block layout.
 *
 * `line-dasharray` (bit DASH_BIT_INDEX) rides along in the same block/header machinery as the
 * other 11 properties, but is populated differently: it carries no style expression to evaluate
 * per feature — its value is an atlas position resolved by LineBucket from the tile's LineAtlas.
 * See `_pendingDashPosition` and the `populateUBO`/`evaluateAllProperties` overrides below, and
 * `_immutableAfterPopulateMask` for why feature-state/dynamic-expression updates must never
 * rewrite it.
 */
export class LinePropertyBinderUBO extends PaintPropertyBinderUBO<LineStyleLayer, LineConstantUniformValues, LinePropertiesUBO> {
    constructor(layer: LineStyleLayer, zoom: number, lut: LUT | null, worldview: string = '', maxUniformBufferBindings?: number | null, uboSizeDwords?: number | null) {
        super(layer, zoom, lut, worldview, maxUniformBufferBindings, uboSizeDwords);
        this._finishInitialization();
    }

    protected _propNames(): readonly string[] {
        return PROP_NAMES;
    }

    protected _headerDwords(): number {
        return LinePropertiesUBO.HEADER_DWORDS;
    }

    protected _createUBO(batchIndex: number): LinePropertiesUBO {
        return new LinePropertiesUBO(null, batchIndex, this.uboSizeDwords, this.header);
    }

    protected override _bindingsPerBatch(): number {
        return LINE_UBO_BINDINGS_PER_BATCH;
    }

    protected _flatScratch(): Float32Array {
        return evalFlatScratch;
    }

    // Staged by the populateUBO override below for the feature currently being populated, then
    // spliced into the flat scratch buffer by the evaluateAllProperties override and immediately
    // cleared. Single-use, so a later main-thread _reevaluateAt call (which never sets it, and
    // must not rewrite the dash slot anyway — see _immutableAfterPopulateMask) can't replay a
    // stale position. Needs no register() omit: it's guaranteed null/undefined by the time
    // worker→main transfer happens, since populateUBO runs synchronously to completion.
    // Also cleared directly by the populateUBO override when the base class skips
    // evaluateAllProperties entirely (all-constant binder), since that's the only place that
    // would otherwise consume/clear it.
    private _pendingDashPosition: SpritePosition | null | undefined;

    /**
     * Populate this feature's UBO entry. `dashPosition` additionally resolves `line-dasharray`
     * from the tile's LineAtlas rather than from an expression — dash carries no meaningful style
     * expression to evaluate per feature (see class doc) — and is undefined/null when dash isn't
     * data-driven for this layer (draw_line.ts sets the u_lpp_dash uniform for that case instead).
     */
    override populateUBO(
        feature: Feature,
        vtFeatureIndex: number,
        canonical: CanonicalTileID,
        availableImages: ImageId[],
        brightness?: number | null,
        formattedSection?: FormattedSection,
        dashPosition?: SpritePosition | null
    ): number {
        this._pendingDashPosition = dashPosition;
        const localIndex = super.populateUBO(feature, vtFeatureIndex, canonical, availableImages, brightness, formattedSection);
        // The base class skips evaluateAllProperties — which normally consumes and clears the
        // staged position — when there's no block to write (all-constant binder). Never let a
        // staged position leak into a later feature.
        this._pendingDashPosition = null;
        return localIndex;
    }

    /**
     * Runs the generic per-property evaluation loop (which skips dash — see _evaluatePropertyAt),
     * then splices the staged dash atlas position into the flat scratch buffer verbatim — no
     * zoom-mixing, unlike every other property (see LinePropertiesUBO's class doc) — before the
     * base class copies the whole flat buffer into the block.
     *
     * Written unconditionally, even when there's no staged position: `flat` is the module-level
     * `evalFlatScratch`, shared across every feature and every layer's binder, so skipping the
     * write on a miss would silently replay whatever the previous write left in the dash slot
     * (LineBucket asserts a staged dash key always resolves, so a miss shouldn't happen — but
     * zero is a safe, deterministic fallback either way; the vertex shader already guards
     * `totalLength == 0.0`, see line.vertex.glsl).
     */
    override evaluateAllProperties(
        feature: Feature,
        featureState: FeatureState,
        canonical: CanonicalTileID,
        availableImages: ImageId[],
        brightness?: number | null,
        formattedSection?: FormattedSection,
        activeAppearance?: SymbolAppearance | null
    ): Float32Array {
        const flat = super.evaluateAllProperties(feature, featureState, canonical, availableImages, brightness, formattedSection, activeAppearance);

        const pos = this._pendingDashPosition;
        this._pendingDashPosition = null;
        flat[DASH_FLAT_OFFSET] = pos ? pos.tl[0] : 0;
        flat[DASH_FLAT_OFFSET + 1] = pos ? pos.tl[1] : 0;
        flat[DASH_FLAT_OFFSET + 2] = pos ? pos.br[0] : 0;
        flat[DASH_FLAT_OFFSET + 3] = pos ? pos.br[1] : 0;

        return flat;
    }

    /**
     * Dash is populated once from the atlas (see populateUBO override above), not from an
     * expression — feature-state / dynamic-expression updates must never rewrite its slot, since
     * `evaluateAllProperties` on that path has no fresh atlas position to splice in and would
     * otherwise leave stale data (or another feature's) in place.
     */
    protected override _immutableAfterPopulateMask(): number {
        return (this.header[HEADER_DATA_DRIVEN_MASK] & DASH_BIT) !== 0 ? DASH_BIT : 0;
    }

    /**
     * Update the header array that describes the UBO layout for the current layer.
     *
     * Only data-driven properties have meaningful offsets — constant properties are passed
     * as u_lpp_* uniforms and their offsets in the header are unused (set to 0).
     */
    protected updateHeader(): void {
        let dataDrivenMask = 0;
        let cameraMask = 0;
        let dataDrivenOffsetVec4 = 0;
        let allDataDrivenLightConstant = true;

        const floorZoom = this._floorZoom;
        for (let i = 0; i < LINE_PROP_COUNT; i++) {
            if (i === DASH_BIT_INDEX) {
                // Dash has no expression-driven zoom range or camera mask — see class doc — so it
                // skips the generic isDataDriven/zoom-range machinery below entirely.
                if (this._isDashDataDriven()) {
                    dataDrivenMask |= DASH_BIT;
                    this.zoomDependency[i] = 0;
                    this.header[HEADER_OFFSETS + i] = dataDrivenOffsetVec4;
                    dataDrivenOffsetVec4 += 1;
                }
                continue;
            }

            const name = PROP_NAMES[i];
            const isColor = i < 2;
            const prop = this._paintGet<unknown>(name);

            // DataConstantProperty returns a plain value (no isConstant method) — treat as constant.
            const layerIsDataDriven = prop && typeof prop.isConstant === 'function' ? !prop.isConstant() : false;
            // A color whose value is constant can still need a per-feature UBO block if its
            // `-use-theme` companion property varies per feature — the LUT-vs-no-LUT decision
            // differs per feature even though the raw color doesn't, so a single u_lpp_* constant
            // uniform can't represent every feature correctly (see shouldIgnoreLut in
            // _evaluateColorValue, which reads the use-theme value per feature).
            const isDataDriven = layerIsDataDriven || (isColor && this._isUseThemeDataDriven(name));

            // Constant properties use u_lpp_* uniforms — they get no data-driven block (offset 0).
            if (!isDataDriven) {
                const unevaluated = this._layerUnevaluated(name);
                if (unevaluated && unevaluated.expression && unevaluated.expression.kind === 'camera') cameraMask |= (1 << i);
                continue;
            }

            dataDrivenMask |= (1 << i);

            const zoomExpr = this._zoomExprOf(this._layerUnevaluated(name));
            const isZoomDep = !!zoomExpr;
            this.zoomDependency[i] = isZoomDep ? 1 : 0;

            // Check if this data-driven expression depends on light/brightness.
            const expr = prop && prop.value as {isLightConstant?: boolean} | undefined;
            if (expr && expr.isLightConstant === false) allDataDrivenLightConstant = false;

            // Fixed, vec4-aligned slot size: every property (color or float) takes exactly 1 vec4 —
            // line has no DZR 2-vec4 case (see line_properties_ubo.ts class doc).
            this.header[HEADER_OFFSETS + i] = dataDrivenOffsetVec4;
            dataDrivenOffsetVec4 += 1;

            if (isZoomDep) {
                this._computeZoomRange(zoomExpr, floorZoom, this.sharedZoomRanges, i * 2);
                // Colors additionally get their shared range written into the header, since their
                // block carries no per-feature zoom slot at all (unlike floats, whose block slot
                // has room for [zm, zM] alongside [min, max]).
                if (isColor) {
                    this.header[LinePropertiesUBO.LINE_HEADER_SHARED_ZOOM + i * 2] = floatToBits(this.sharedZoomRanges[i * 2]);
                    this.header[LinePropertiesUBO.LINE_HEADER_SHARED_ZOOM + i * 2 + 1] = floatToBits(this.sharedZoomRanges[i * 2 + 1]);
                }
            }
        }

        this.header[HEADER_DATA_DRIVEN_MASK] = dataDrivenMask;
        this.header[HEADER_BLOCK_SIZE_VEC4] = dataDrivenOffsetVec4;

        this.isLightConstant = allDataDrivenLightConstant;
        this.cameraMask = cameraMask;
    }

    /**
     * Refresh sharedZoomRanges and cameraMask from the current layer's unevaluated expressions.
     * Called after a runtime property change.
     */
    protected _recomputeSharedRanges(): void {
        const floorZoom = this._floorZoom;
        let cameraMask = 0;
        let colorHeaderChanged = false;

        for (let i = 0; i < LINE_PROP_COUNT; i++) {
            // Dash never carries a zoom range or a camera expression (see class doc) — nothing to
            // recompute. Its own data-driven-ness (dash/cap constant vs. not) also can't change
            // without a bucket rebuild, unlike the shared-zoom-range refresh this method exists for.
            if (i === DASH_BIT_INDEX) continue;

            const name = PROP_NAMES[i];
            const isDataDriven = (this.header[HEADER_DATA_DRIVEN_MASK] & (1 << i)) !== 0;
            const isZoomDep = this.zoomDependency[i] === 1;

            if (!isDataDriven) {
                const unevaluated = this._layerUnevaluated(name);
                if (unevaluated && unevaluated.expression && unevaluated.expression.kind === 'camera') cameraMask |= (1 << i);
            } else if (isZoomDep) {
                const zoomExpr = this._zoomExprOf(this._layerUnevaluated(name));
                if (zoomExpr) {
                    this._computeZoomRange(zoomExpr, floorZoom, this.sharedZoomRanges, i * 2);
                    if (i < 2) {
                        this.header[LinePropertiesUBO.LINE_HEADER_SHARED_ZOOM + i * 2] = floatToBits(this.sharedZoomRanges[i * 2]);
                        this.header[LinePropertiesUBO.LINE_HEADER_SHARED_ZOOM + i * 2 + 1] = floatToBits(this.sharedZoomRanges[i * 2 + 1]);
                        colorHeaderChanged = true;
                    }
                }
            }
        }

        this.cameraMask = cameraMask;
        // The header buffer is shared by reference across every batch's UBO, so a color's shared-
        // zoom slot changing here must be re-uploaded on the next upload() for every batch.
        if (colorHeaderChanged) {
            for (const ubo of this.ubos) ubo.markHeaderDirty();
        }
    }

    /** True if `${colorPropName}-use-theme` is itself a data-driven (source/composite) expression. */
    private _isUseThemeDataDriven(colorPropName: string): boolean {
        const useThemeProp = this._paintGet<string>(`${colorPropName}-use-theme`);
        return !!useThemeProp && typeof useThemeProp.isConstant === 'function' && !useThemeProp.isConstant();
    }

    /**
     * True when `line-dasharray`'s atlas position can vary per feature: either the dasharray
     * expression itself is data-driven, or — mirroring LineBucket.addConstantDashes /
     * program_configuration.ts's `isVariableLineCap` — `line-cap` is. A constant dasharray still
     * needs a different atlas row per feature when the cap varies (round caps get a taller SDF
     * row; see LineAtlas.addDash).
     */
    private _isDashDataDriven(): boolean {
        const dashProp = this._paintGet<unknown>('line-dasharray');
        const dashIsDataDriven = dashProp && typeof dashProp.isConstant === 'function' ? !dashProp.isConstant() : false;
        const capProp = this.layer.layout.get('line-cap');
        const capIsDataDriven = !!capProp && typeof capProp.isConstant === 'function' && !capProp.isConstant();
        return dashIsDataDriven || capIsDataDriven;
    }

    /**
     * Evaluate the property at bit index `i` and write it into the flat scratch buffer. Line has
     * no translate property and no appearance-zoom-stops (DZR) case, so this only dispatches
     * between the shared color/float evaluators: colors never carry a per-feature zoom slot
     * (zoomFlatOffset -1 — their range lives only in the header), floats always do. Dash is
     * skipped here — it has no expression to evaluate; `evaluateAllProperties` splices its flat
     * slot separately from the staged atlas position (see `_pendingDashPosition`).
     */
    protected _evaluatePropertyAt(i: number, ctx: EvaluationContext): void {
        if (i === DASH_BIT_INDEX) return;

        const name = PROP_NAMES[i];
        const isColor = i < 2;
        const isZoomDep = this.zoomDependency[i] === 1;
        const flatOffset = LinePropertiesUBO.EVAL_FLAT_OFFSETS[i];

        if (isColor) {
            this._evaluateColorValue(name, i, isZoomDep, false, -1, ctx, flatOffset);
        } else {
            this._evaluateFloatValue(name, i, isZoomDep, false, flatOffset + 2, ctx, flatOffset, PROP_DEFAULTS[i]);
        }
    }

    /**
     * Build the u_lpp_* constant-property uniform values from the current layer.
     */
    protected _buildConstantUniforms(renderParams: EvaluationParameters | null, emptyFeature: Feature, brightness: number | null | undefined): LineConstantUniformValues {
        return {
            'color_np_color': this._constantColor(0, PROP_NAMES[0], renderParams, emptyFeature, brightness, [0, 0, 0, 1]),
            'border_np_color': this._constantColor(1, PROP_NAMES[1], renderParams, emptyFeature, brightness, [0, 0, 0, 0]),
            opacity: this._constantFloat(2, PROP_NAMES[2], renderParams, emptyFeature, PROP_DEFAULTS[2]),
            blur: this._constantFloat(3, PROP_NAMES[3], renderParams, emptyFeature, PROP_DEFAULTS[3]),
            width: this._constantFloat(4, PROP_NAMES[4], renderParams, emptyFeature, PROP_DEFAULTS[4]),
            'gap_width': this._constantFloat(5, PROP_NAMES[5], renderParams, emptyFeature, PROP_DEFAULTS[5]),
            offset: this._constantFloat(6, PROP_NAMES[6], renderParams, emptyFeature, PROP_DEFAULTS[6]),
            floorwidth: this._constantFloat(7, PROP_NAMES[7], renderParams, emptyFeature, PROP_DEFAULTS[7]),
            'border_width': this._constantFloat(8, PROP_NAMES[8], renderParams, emptyFeature, PROP_DEFAULTS[8]),
            'emissive_strength': this._constantFloat(9, PROP_NAMES[9], renderParams, emptyFeature, PROP_DEFAULTS[9]),
            'side_z_offset': this._constantFloat(11, PROP_NAMES[11], renderParams, emptyFeature, PROP_DEFAULTS[11]),
        };
    }
}

// 'layer' is omitted because LineStyleLayer is not serializable. It must be re-assigned on
// the main thread before any main-thread method (getConstantUniformValues, bind, etc.) is called
// — see reassignLayer(), called from line_bucket.ts wherever the bucket is handed a fresh layer.
// featureVertexRangesFromVtIndex is symbol-only in spirit (backs appearance updates), but the
// shared base's _ensureRangeMaps builds it unconditionally, so line instances carry an (unused,
// empty) copy that must be omitted here too.
register(LinePropertyBinderUBO, 'LinePropertyBinderUBO', {omit: ['layer', 'cachedConstantUniforms', 'cachedConstantRenderZoom', 'cachedConstantBrightness', 'cachedConstantPaint', 'featureVertexRangesFromId', 'featureVertexRangesFromVtIndex']});
