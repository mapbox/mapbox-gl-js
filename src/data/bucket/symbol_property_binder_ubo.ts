import {SymbolPropertiesUBO, HEADER_DATA_DRIVEN_MASK, HEADER_DZR_MASK, HEADER_BLOCK_SIZE_VEC4, HEADER_OFFSETS, HEADER_SHARED_ZOOM, floatToBits} from './symbol_properties_ubo';
import Color from '../../style-spec/util/color';
import EvaluationParameters from '../../style/evaluation_parameters';
import {PossiblyEvaluatedPropertyValue} from '../../style/properties';
import {register} from '../../util/web_worker_transfer';
import {packUint8ToFloat} from '../../shaders/encode_attribute';
import {warnOnce} from '../../util/util';

import type {PossiblyEvaluatedValue} from '../../style/properties';
import type SymbolStyleLayer from '../../style/style_layer/symbol_style_layer';
import type {LUT} from '../../util/lut';
import type {Feature, FeatureState, CameraExpression, CompositeExpression, StylePropertyExpression} from '../../style-spec/expression';
import type {CanonicalTileID} from '../../source/tile_id';
import type {ImageId} from '../../style-spec/expression/types/image_id';
import type Context from '../../gl/context';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {FormattedSection} from '../../style-spec/expression/types/formatted';
import type {AppearancePaintProps} from '../../style/appearance_properties';
import type SymbolAppearance from '../../style/appearance';

// WebGL2 minimum guaranteed value for MAX_UNIFORM_BUFFER_BINDINGS (OpenGL ES 3.0.6 table 6.33)
const WEBGL2_MIN_UNIFORM_BUFFER_BINDINGS = 24;

/**
 * Determines if LUT should be ignored based on use-theme property.
 */
function shouldIgnoreLut(
    lutExpression: PossiblyEvaluatedValue<string> | undefined,
    feature: Feature,
    featureState: FeatureState,
    availableImages: ImageId[],
    canonical?: CanonicalTileID,
    brightness?: number | null,
    formattedSection?: FormattedSection,
    worldview?: string
): boolean {
    if (!lutExpression) return false;

    if (lutExpression.kind === 'constant') {
        return lutExpression.value === 'none';
    }

    // Data-driven (source/composite) use-theme: evaluate against the feature.
    const value = lutExpression.evaluate(
        {zoom: 0, brightness, worldview},
        feature,
        featureState,
        canonical,
        availableImages,
        formattedSection
    );
    return value === 'none';
}

/**
 * True iff `prop` is a data-driven paint property whose expression reads feature-state.
 * Constants and camera-only expressions return false.
 */
function isPaintStateDependent(prop: unknown): boolean {
    if (!(prop instanceof PossiblyEvaluatedPropertyValue)) return false;
    const inner = prop.value;
    return (inner.kind === 'source' || inner.kind === 'composite') && inner.isStateDependent;
}

/**
 * Shared context for property evaluation.
 */
type EvaluationContext = {
    feature: Feature;
    featureState: FeatureState;
    canonical: CanonicalTileID;
    availableImages: ImageId[];
    params: EvaluationParameters;
    paramsNext: EvaluationParameters;
    formattedSection?: FormattedSection;
    activeAppearance?: SymbolAppearance | null;
};

// Indexed [icon, text] to match `+isText` (false → 0 → icon, true → 1 → text).
const PROP_NAMES = ['icon', 'text'].map((p) => [
    `${p}-color`,
    `${p}-halo-color`,
    `${p}-opacity`,
    `${p}-halo-width`,
    `${p}-halo-blur`,
    `${p}-emissive-strength`,
    `${p}-occlusion-opacity`,
    'symbol-z-offset',
    `${p}-translate`
]);

const PROP_COUNT = 9; // paint properties, indexed by bit position. Must be less than 16 to coexist
// with the appearance-zoom-stops mask

// Flat scratch buffer for evaluateAllProperties — reused per call, eliminates per-feature inner array allocations.
const evalFlatScratch = new Float32Array(SymbolPropertiesUBO.EVAL_FLAT_TOTAL);

// Shared read-only translate default; passed to constantOr to avoid a per-feature [0, 0] allocation.
const ZERO_VEC2: [number, number] = [0, 0];
const cameraWrapCache = new WeakMap<object, PossiblyEvaluatedPropertyValue<unknown>>();

type ZoomExpression = CameraExpression | CompositeExpression;

// Per-property zoom classification (mirrors GL Native's ZoomDependency enum). CPU-side bookkeeping
// that decides which zoom range the evaluator computes; the shader only receives the DZR bit via
// the header (HEADER_DZR_MASK). Stored on the binder (SymbolPropertyBinderUBO.zoomDependency) and
// serialized, so the main-thread instance — which omits `layer` — can read it after worker transfer
// instead of recomputing from the (absent) layer.
const ZOOM_INDEPENDENT = 0;      // not zoom-dependent
const ZOOM_SAME_RANGE = 1;       // zoom-dependent; one [zm, zM] shared by every appearance
const ZOOM_DIFFERENT_RANGES = 2; // appearances disagree on stops → per-feature [zm, zM] (DZR)

/**
 * Constant property values ready to be set as u_spp_* uniforms.
 */
export type ConstantUniformValues = {
    fill_np_color: [number, number, number, number];
    halo_np_color: [number, number, number, number];
    opacity: number;
    halo_width: number;
    halo_blur: number;
    emissive_strength: number;
    occlusion_opacity: number;
    z_offset: number;
};

/**
 * Manages UBO-based symbol paint properties.
 *
 * Uses the GL Native-aligned layout: header (4 uvec4) + per-feature data-driven blocks.
 * Constant properties are NOT stored in the UBO — they are passed as u_spp_* uniforms
 * at draw time via getConstantUniformValues().
 */
export class SymbolPropertyBinderUBO {
    layer: SymbolStyleLayer;
    zoom: number;
    lut: LUT | null;
    worldview: string;
    maxUniformBufferBindings: number;

    // Per-feature tracking, in insertion (populate) order. One entry per populateUBO call;
    // the entry's index IS the feature's global index (see _writeFeatureBlock).
    // These parallel arrays are the only feature-tracking state transferred worker→main,
    // the lookup maps below are rebuilt lazily on the main thread.
    allFeatureVtIndices: number[];                          // vector-tile feature index per entry
    allFeatureIds: Array<string | number | undefined>;      // feature id per entry (if any)
    allFormattedSections: Array<FormattedSection | null>;   // formatted section per entry (for per-section color overrides)

    // Lazily built on the main thread (omitted from serialization). Map a featureId / vtFeatureIndex
    // to the positions in allFeature* that reference it, for O(1) targeted updates.
    // featureVertexRangesFromId backs feature-state updates; featureVertexRangesFromVtIndex backs
    // appearance updates, which dispatch by vt index rather than featureId.
    featureVertexRangesFromId: Map<string | number, number[]>;
    featureVertexRangesFromVtIndex: Map<number, number[]>;

    // UBO batches
    ubos: SymbolPropertiesUBO[];
    featureCount: number;       // Total across all batches

    // Header (built once in the constructor, describes layout of each UBO batch). A flat Uint32Array
    // of 16 dwords (4 uvec4) shared with every batch's headerData; index it with the HEADER_* constants.
    header: Uint32Array;
    maxFeaturesPerBatch: number; // computed from header

    // True when no paint property is data-driven (dataDrivenMask === 0). Such binders carry no
    // per-feature block — constants go through u_spp_* uniforms — so every feature shares entry 0.
    isAllConstant: boolean;

    isText: boolean;

    // Cached result of getConstantUniformValues (main-thread only, excluded from serialization).
    // Invalidated when the layer changes or when zoom/brightness change for camera expressions.
    cachedConstantUniforms: ConstantUniformValues | null;
    cachedConstantRenderZoom: number | null;
    cachedConstantBrightness: number | null | undefined;
    // Identity of the layer.paint object the cache was computed from. layer.recalculate() produces a
    // fresh paint object on every Style.update() a paint/config change triggers, so an identity change
    // means constant paint values may have changed. Guards against a stale cached color when a paint
    // update does not come with a live transition (e.g. root transition {duration: 0}); see #13702.
    cachedConstantPaint: object | null;

    // Tracks current active appearance per vtFeatureIndex (main-thread only, excluded from serialization).
    activeAppearanceByVtIndex?: Map<number, SymbolAppearance | null>;

    uboSizeDwords: number;

    // True when no data-driven property uses measure-light expressions.
    // When true, updateDynamicExpressions can be skipped on brightness-only changes.
    isLightConstant: boolean;

    // Bitmask: 1 = property is a constant camera (zoom-only) expression, computed in updateHeader.
    // CPU-only — camera properties go through u_spp_* uniforms (re-evaluated at render zoom),
    // not the GPU UBO, so this is not part of the header.
    cameraMask: number;

    // Per-property zoom classification (ZOOM_* enum), one byte per property, computed in
    // updateHeader. CPU-side bookkeeping that decides which zoom range the evaluator computes; the
    // shader only gets the DZR bit through the header. Serialized (see register() below) so the
    // main-thread instance can read it after worker transfer, since `layer` is omitted there.
    zoomDependency: Uint8Array;

    // [zm, zM] pairs per zoom-dep property (9 pairs = 18 floats), computed in updateHeader.
    // evaluateAllProperties copies the shared pair into every feature's zoom-ready block slot;
    // appearance-zoom-stops properties compute their [zm, zM] per feature instead.
    sharedZoomRanges: Float32Array;
    _zoomRangeScratch: Float32Array;
    _floorZoom: number;

    constructor(layer: SymbolStyleLayer, zoom: number, lut: LUT | null, isText: boolean, worldview: string = '', maxUniformBufferBindings?: number | null, uboSizeDwords?: number | null) {
        this.layer = layer;
        this.zoom = zoom;
        this.lut = lut;
        this.isText = isText;
        this.worldview = worldview;
        this.maxUniformBufferBindings = maxUniformBufferBindings || WEBGL2_MIN_UNIFORM_BUFFER_BINDINGS;
        this.uboSizeDwords = uboSizeDwords || 4096;

        this.allFeatureVtIndices = [];
        this.allFeatureIds = [];
        this.allFormattedSections = [];
        this.featureVertexRangesFromId = null;
        this.featureVertexRangesFromVtIndex = null;
        this.ubos = [];
        this.featureCount = 0;

        this.cachedConstantUniforms = null;
        this.cachedConstantRenderZoom = null;
        this.cachedConstantBrightness = undefined;
        this.cachedConstantPaint = null;

        this.activeAppearanceByVtIndex = null;

        this.zoomDependency = new Uint8Array(PROP_COUNT);
        this.sharedZoomRanges = new Float32Array(PROP_COUNT * 2);
        this._zoomRangeScratch = new Float32Array(2);
        this._floorZoom = Math.floor(this.zoom);
        this.header = new Uint32Array(SymbolPropertiesUBO.HEADER_DWORDS);
        this.updateHeader();
        this.isAllConstant = this.header[HEADER_DATA_DRIVEN_MASK] === 0;

        // Max features per UBO batch = how many data-driven blocks fit in one buffer.
        // All-constant layers have no per-feature block, so a single batch holds every feature.
        const blockDwords = this.header[HEADER_BLOCK_SIZE_VEC4] * 4;
        this.maxFeaturesPerBatch = blockDwords === 0 ? Number.MAX_SAFE_INTEGER : Math.floor(this.uboSizeDwords / blockDwords);
    }

    /**
     * Update the 12-dword header array that describes the UBO layout for the current layer.
     *
     * Only data-driven properties have meaningful offsets — constant properties are passed
     * as u_spp_* uniforms and their offsets in the header are unused (set to 0).
     */
    private updateHeader(): void {
        const paint = this.layer.paint;

        let dataDrivenMask = 0;
        let dzrMask = 0;
        let cameraMask = 0;
        let dataDrivenOffsetVec4 = 0;
        let allDataDrivenLightConstant = true;

        const floorZoom = this._floorZoom;
        const names = PROP_NAMES[+this.isText];
        for (let i = 0; i < PROP_COUNT; i++) {
            const name = names[i];
            const isColor = i < 2;
            const prop = paint.get(name as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<unknown> | undefined;

            // DataConstantProperty returns a plain value (no isConstant method) — treat as constant.
            const layerIsDataDriven = prop && typeof prop.isConstant === 'function' ? !prop.isConstant() : false;
            // If any appearance defines this property, it must be in the UBO so per-feature values can differ.
            const appearanceForceDataDriven = this._appearancesHavePaintProperties(name as keyof AppearancePaintProps);
            const isDataDriven = layerIsDataDriven || appearanceForceDataDriven;

            // Constant properties use u_spp_* uniforms — they get no data-driven block (offset 0).
            if (!isDataDriven) {
                const unevaluated = this._layerUnevaluated(name);
                if (unevaluated && unevaluated.expression && unevaluated.expression.kind === 'camera') cameraMask |= (1 << i);
                continue;
            }

            dataDrivenMask |= (1 << i);

            // Examine the zoom ranges that can drive this property across the layer paint and every
            // appearance overriding it. This is internal bookkeeping only (decides what
            // evaluateAllProperties computes) — it no longer affects block sizing/offsets, since
            // every data-driven property occupies a fixed, zoom-ready slot (see
            // symbol_properties_ubo.ts):
            //   not zoom-dependent → block stores [min, min] and [zm, zM] = [0, 0].
            //   one shared range   → block stores the layer's shared [zm, zM] on every feature.
            //   ranges disagree    → appearances disagree on the stops → store [zm, zM] per feature.
            const zoom = this._collectZoomSignatures(name as keyof AppearancePaintProps, floorZoom);
            const isZoomDep = zoom.hasZoom;
            const hasAppearanceZoomStops = zoom.differs;
            const isTranslate = i === 8;

            this.zoomDependency[i] = hasAppearanceZoomStops ? ZOOM_DIFFERENT_RANGES : isZoomDep ? ZOOM_SAME_RANGE : ZOOM_INDEPENDENT;
            // Colors get a per-feature zoom slot only for DifferentZoomRanges (SameZoomRange reads
            // the header's shared range instead). Translate has no header slot to share its zoom
            // range in, so it needs its own per-feature [zm, zM] whenever it's zoom-dependent at all.
            const needsBlockZoom = hasAppearanceZoomStops || (isTranslate && isZoomDep);
            if (needsBlockZoom) dzrMask |= (1 << i);

            // Check if this data-driven expression depends on light/brightness.
            // Same pattern as program_configuration.ts:313-314.
            const expr = prop && prop.value as {isLightConstant?: boolean} | undefined;
            if (expr && expr.isLightConstant === false) allDataDrivenLightConstant = false;

            // Fixed, vec4-aligned slot size: scalars always take 1 vec4; colors and translate take
            // 1 vec4 (Independent/SameZoomRange, zoom range read from the header — translate never
            // needs this since it has no shared-zoom header slot) or 2 vec4 (DifferentZoomRanges,
            // zoom range stored per feature — for translate, whenever it's zoom-dependent at all) —
            // see HEADER_DZR_MASK.
            this.header[HEADER_OFFSETS + i] = dataDrivenOffsetVec4;
            dataDrivenOffsetVec4 += needsBlockZoom ? 2 : 1;

            // Single-signature properties get their shared [zm, zM] now;
            // appearance-zoom-stops properties compute it per feature.
            if (isZoomDep && !hasAppearanceZoomStops && zoom.representative) {
                this._computeZoomRange(zoom.representative, floorZoom, this.sharedZoomRanges, i * 2);
                // Colors additionally get their shared range written into the header, since their
                // block (when not DifferentZoomRanges) carries no per-feature zoom slot at all.
                if (isColor) {
                    this.header[HEADER_SHARED_ZOOM + i * 2] = floatToBits(this.sharedZoomRanges[i * 2]);
                    this.header[HEADER_SHARED_ZOOM + i * 2 + 1] = floatToBits(this.sharedZoomRanges[i * 2 + 1]);
                }
            }
        }

        this.header[HEADER_DATA_DRIVEN_MASK] = dataDrivenMask;
        this.header[HEADER_DZR_MASK] = dzrMask;
        this.header[HEADER_BLOCK_SIZE_VEC4] = dataDrivenOffsetVec4;

        this.isLightConstant = allDataDrivenLightConstant;
        this.cameraMask = cameraMask;
    }

    /**
     * Refresh sharedZoomRanges and cameraMask from the current layer's unevaluated expressions.
     * Called after a runtime property change
     */
    private _recomputeSharedRanges(): void {
        const floorZoom = this._floorZoom;
        const names = PROP_NAMES[+this.isText];
        let cameraMask = 0;
        let colorHeaderChanged = false;

        for (let i = 0; i < PROP_COUNT; i++) {
            const name = names[i];
            const isDataDriven = (this.header[HEADER_DATA_DRIVEN_MASK] & (1 << i)) !== 0;
            const dep = this.zoomDependency[i];
            const isZoomDep = dep !== ZOOM_INDEPENDENT;
            const hasAppearanceZoomStops = dep === ZOOM_DIFFERENT_RANGES;

            if (!isDataDriven) {
                const unevaluated = this._layerUnevaluated(name);
                if (unevaluated && unevaluated.expression && unevaluated.expression.kind === 'camera') cameraMask |= (1 << i);
            } else if (isZoomDep && !hasAppearanceZoomStops) {
                // Appearance-zoom-stops properties skip this because their per-feature
                // [zm, zM] is recomputed in evaluateAllProperties._writeZoomRange.
                const zoom = this._collectZoomSignatures(name as keyof AppearancePaintProps, floorZoom);
                if (zoom.representative) {
                    this._computeZoomRange(zoom.representative, floorZoom, this.sharedZoomRanges, i * 2);
                    if (i < 2) {
                        // Colors: also refresh the header's shared-zoom slot (see updateHeader) —
                        // it's their only copy of the zoom range, unlike scalars/translate whose
                        // per-feature block slot gets rewritten via evaluateAllProperties instead.
                        this.header[HEADER_SHARED_ZOOM + i * 2] = floatToBits(this.sharedZoomRanges[i * 2]);
                        this.header[HEADER_SHARED_ZOOM + i * 2 + 1] = floatToBits(this.sharedZoomRanges[i * 2 + 1]);
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

    /**
     * Examine the zoom ranges that can drive property `name` across the layer paint and every appearance
     * that overrides it:
     *   hasZoom:  the property uses zoom interpolation
     *   differs:  ≥2 sources bake DIFFERENT [zm, zM] ranges
     *   representative: one zoom-dependent expression used to source the shared
     *             uniform's range in the single-range case
     */
    private _collectZoomSignatures(
        name: keyof AppearancePaintProps,
        floorZoom: number
    ): {hasZoom: boolean; differs: boolean; representative: ZoomExpression | null} {
        let hasZoom = false;
        let differs = false;
        let representative: ZoomExpression | null = null;
        let firstZm = 0;
        let firstZM = 0;

        const consider = (expr: ZoomExpression | null) => {
            if (!expr) return;
            this._computeZoomRange(expr, floorZoom, this._zoomRangeScratch, 0);
            const zm = this._zoomRangeScratch[0];
            const zM = this._zoomRangeScratch[1];
            if (!hasZoom) {
                hasZoom = true;
                firstZm = zm;
                firstZM = zM;
                representative = expr;
            } else if (zm !== firstZm || zM !== firstZM) {
                differs = true;
            }
        };

        consider(this._zoomExprOf(this._layerUnevaluated(name)));
        for (const appearance of this.layer.getAppearances() || []) {
            if (!appearance.hasPaintProperty(name)) continue;
            consider(this._zoomExprOf(appearance.getUnevaluatedPaintProperty(name)));
        }
        return {hasZoom, differs, representative};
    }

    /**
     * Evaluate all 9 properties and return their UBO-ready values.
     *
     * Color encoding (non-premultiplied — the fragment shader premultiplies):
     *   non-zoom → [packed0, packed1, 0, 0]
     *   zoom-dep → [packMin[0], packMin[1], packMax[0], packMax[1]]
     * Float encoding:
     *   non-zoom → single number
     *   zoom-dep → [min, max]
     */
    evaluateAllProperties(
        feature: Feature,
        featureState: FeatureState,
        canonical: CanonicalTileID,
        availableImages: ImageId[],
        brightness?: number | null,
        formattedSection?: FormattedSection,
        activeAppearance?: SymbolAppearance | null
    ): Float32Array {
        const options = {brightness, worldview: this.worldview};
        const params = new EvaluationParameters(this.zoom, options);
        const paramsNext = new EvaluationParameters(this.zoom + 1, options);
        const ctx: EvaluationContext = {feature, featureState, canonical, availableImages, params, paramsNext, formattedSection, activeAppearance};

        const names = PROP_NAMES[+this.isText];
        for (let i = 0; i < PROP_COUNT; i++) {
            const name = names[i];
            const isColor = i < 2;
            const isVec2 = i === 8;
            const dep = this.zoomDependency[i];
            const isZoomDep = dep !== ZOOM_INDEPENDENT;
            const hasAppearanceZoomStops = dep === ZOOM_DIFFERENT_RANGES;
            const flatOffset = SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[i];
            // The [zm, zM] pair immediately follows the value within the property's slot
            // (4 floats for colors/translate, 2 for scalars) — see the flat-layout doc above.
            const zoomFlatOffset = flatOffset + (isColor || isVec2 ? 4 : 2);

            if (isColor) {
                this._evaluateColorValue(name, i, isZoomDep, hasAppearanceZoomStops, zoomFlatOffset, ctx, flatOffset);
            } else if (isVec2) {
                this._evaluateTranslateValue(name, i, isZoomDep, hasAppearanceZoomStops, zoomFlatOffset, ctx, flatOffset);
            } else {
                this._evaluateFloatValue(name, i, isZoomDep, hasAppearanceZoomStops, zoomFlatOffset, ctx, flatOffset);
            }
        }

        return evalFlatScratch;
    }

    /**
     * Resolve a paint property by name, preferring the active appearance's override when it
     * defines that property, otherwise the layer's paint
     */
    private _resolveProp<T>(propName: string, activeAppearance: SymbolAppearance | null | undefined, isUseTheme: boolean = false, formattedSection?: FormattedSection): PossiblyEvaluatedPropertyValue<T> | undefined {
        const paint = this.layer.paint;
        const layerProp = paint.get(propName as keyof typeof paint._values) as unknown as PossiblyEvaluatedPropertyValue<T>;
        const appearanceName = propName as keyof AppearancePaintProps;
        const fromAppearance = !!(activeAppearance && activeAppearance.hasPaintProperty(appearanceName));
        const pe = (fromAppearance ?
            (formattedSection && layerProp && layerProp.property.overrides && layerProp.property.overrides.hasOverride(formattedSection) ?
                layerProp :
                activeAppearance.paintProperties.get(appearanceName)) :
            paint.get(propName as keyof typeof paint._values)) as unknown as PossiblyEvaluatedPropertyValue<T> | undefined;

        // Only a zoom-only expression that possiblyEvaluate collapsed to a constant needs
        // un-baking
        if (isUseTheme || !pe || typeof pe.isConstant !== 'function' || !pe.isConstant()) return pe;
        const source = fromAppearance ?
            activeAppearance.getUnevaluatedPaintProperty(appearanceName) :
            this._layerUnevaluated(propName);
        return this._unbakeCamera(pe, source);
    }

    /**
     * If `source` is a zoom-only expression, return a PossiblyEvaluatedPropertyValue wrapping
     * the live expression so it interpolates across zoom like a composite     */
    private _unbakeCamera<T>(pe: PossiblyEvaluatedPropertyValue<T>, source: unknown): PossiblyEvaluatedPropertyValue<T> {
        const expr = source && (source as {expression?: {kind?: string}}).expression;
        if (!expr || expr.kind !== 'camera') return pe;
        let wrapped = cameraWrapCache.get(source as object) as PossiblyEvaluatedPropertyValue<T> | undefined;
        if (!wrapped) {
            wrapped = new PossiblyEvaluatedPropertyValue<T>(pe.property, expr as unknown as PossiblyEvaluatedValue<T>, pe.parameters, pe.iconImageUseTheme);
            cameraWrapCache.set(source as object, wrapped);
        }
        return wrapped;
    }

    private _layerUnevaluated(propName: string): {expression?: StylePropertyExpression} | undefined {
        const tv = (this.layer._transitionablePaint._values as Record<string, {value?: {expression?: StylePropertyExpression}}>)[propName];
        return tv && tv.value;
    }

    /**
     * The zoom-dependent expression behind an unevaluated PropertyValue or null if it isn't zoom-dependent
     */
    private _zoomExprOf(source: {expression?: StylePropertyExpression} | undefined): ZoomExpression | null {
        const expr = source && source.expression;
        if (!expr) return null;
        return (expr.kind === 'composite' || expr.kind === 'camera') ? expr : null;
    }

    /** Evaluate a property at the given zoom params, with the verbose shared argument list filled in. */
    private _evalAt<T>(prop: PossiblyEvaluatedPropertyValue<T>, params: EvaluationParameters, ctx: EvaluationContext): T {
        return prop.property.evaluate(
            prop.value, params, ctx.feature, ctx.featureState,
            ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
        );
    }

    /**
     * Evaluate a color property and write it into the flat buffer in UBO-ready, zoom-ready format
     * (non-premultiplied, packed): flat[offset..offset+3] = [packMin0, packMin1, packMax0, packMax1].
     * Non-zoom properties duplicate min into max so the shader's branchless mix degenerates to it.
     */
    private _evaluateColorValue(
        propName: string,
        i: number,
        isZoomDep: boolean,
        hasAppearanceZoomStops: boolean,
        zoomFlatOffset: number,
        ctx: EvaluationContext,
        flatOffset: number
    ): void {
        const prop = this._resolveProp<Color>(propName, ctx.activeAppearance, false, ctx.formattedSection);

        this._writePropertyZoomRange(i, isZoomDep, hasAppearanceZoomStops, prop, zoomFlatOffset);

        if (!prop) {
            evalFlatScratch[flatOffset] = 0;
            evalFlatScratch[flatOffset + 1] = 0;
            evalFlatScratch[flatOffset + 2] = 0;
            evalFlatScratch[flatOffset + 3] = 1;
            return;
        }

        // Use-theme: prefer appearance's value when it defines the color, fall back to layer's.
        const useThemeProp = this._resolveProp<string>(`${propName}-use-theme`, ctx.activeAppearance, true);
        const useThemeValue = useThemeProp && typeof useThemeProp !== 'string' ? useThemeProp.value : undefined;
        const ignoreLut = shouldIgnoreLut(
            useThemeValue,
            ctx.feature, ctx.featureState, ctx.availableImages,
            ctx.canonical, ctx.params.brightness, ctx.formattedSection, this.worldview
        );
        const effectiveLut = ignoreLut ? null : this.lut;

        const colorMin = prop.isConstant() ? prop.constantOr(Color.transparent) : this._evalAt(prop, ctx.params, ctx) || Color.transparent;

        // Non-premultiplied — the fragment shader does vec4(np_color.rgb * np_color.a, np_color.a).
        // Inline packNonPremultColor to avoid allocating a [number, number] tuple.
        const minNP = colorMin.toNonPremultipliedRenderColor(effectiveLut);
        evalFlatScratch[flatOffset] = packUint8ToFloat(255 * minNP.r, 255 * minNP.g);
        evalFlatScratch[flatOffset + 1] = packUint8ToFloat(255 * minNP.b, 255 * minNP.a);

        if (isZoomDep) {
            // zoom-dependent ⟹ data-driven composite (never constant), so evaluate the next-zoom color directly.
            const maxNP = (this._evalAt(prop, ctx.paramsNext, ctx) || Color.transparent).toNonPremultipliedRenderColor(effectiveLut);
            evalFlatScratch[flatOffset + 2] = packUint8ToFloat(255 * maxNP.r, 255 * maxNP.g);
            evalFlatScratch[flatOffset + 3] = packUint8ToFloat(255 * maxNP.b, 255 * maxNP.a);
        } else {
            evalFlatScratch[flatOffset + 2] = evalFlatScratch[flatOffset];
            evalFlatScratch[flatOffset + 3] = evalFlatScratch[flatOffset + 1];
        }
    }

    /**
     * Compute [zm, zM] for the zoom-interpolation range that contains floorZoom and write
     * it into `out[outOffset..outOffset+1]`
     *
     * The shader (and getConstantUniformValues) mixes LINEARLY between the min/max sampled at the
     * surrounding integer zooms, so the interpolation curve shape (exponential base, cubic-bezier) is
     * approximated as linear within each integer zoom step
     *
     * For step expressions (interpolationType == null):
     *   If a boundary falls in (floorZoom, floorZoom+1], write [t, t] where t = boundary - floorZoom.
     *   The shader interprets zm == zM as a step: output = u_zoom >= zm ? max : min.
     *   If no boundary in range, write [1.0, 1.0] (stays at floorZoom's value throughout).
     *
     * For interpolate expressions (interpolationType != null):
     *   If a stop falls in (floorZoom, floorZoom+1), use zm = stop - floorZoom to delay the
     *   transition start.
     *   zM is always 1.0 (transition ends at the next integer zoom).
     *
     * Writes the pair into `out[outOffset..outOffset+1]`. `expr` is a live composite/camera
     * expression (or anything else, which yields the default [0, 1]).
     */
    private _computeZoomRange(expr: unknown, floorZoom: number, out: Float32Array, outOffset: number): void {
        // Default mix range: interpolate across the whole integer zoom step.
        let zm = 0.0;
        let zM = 1.0;

        const e = expr as ZoomExpression | undefined;
        const stops = e && (e.kind === 'composite' || e.kind === 'camera') ? e.zoomStops : null;

        // zoomStops are validated to be in strictly ascending order, so stops[0] is the lowest.
        if (stops && stops.length > 0) {
            if (e.interpolationType == null) {
                // Step expression: the value holds constant across the step (zm == zM == 1.0)
                // unless a boundary falls strictly inside it, where it jumps at that normalized
                // position (zm == zM == stop - floorZoom).
                zm = zM = 1.0;
                for (const stop of stops) {
                    if (stop > floorZoom && stop < floorZoom + 1) {
                        zm = zM = stop - floorZoom;
                        break;
                    }
                }
            } else if (stops[0] > floorZoom && stops[0] < floorZoom + 1) {
                // Interpolation whose first stop falls inside this step: the value is clamped
                // constant until that stop, so delay the transition start to its normalized
                // position — e.g. ["interpolate", ["linear"], ["zoom"], 1.5, 0, 2, 1] at
                // floorZoom=1 begins at zm=0.5. Otherwise the transition spans the whole step
                // from zm=0, matching the plain mix(min, max, u_zoom) path.
                zm = stops[0] - floorZoom;
            }
        }

        out[outOffset] = zm;
        out[outOffset + 1] = zM;
    }

    /**
     * Compute the per-feature zoom range [zm, zM] for the resolved property and write it as two
     * floats into the flat buffer at zoomFlatOffset/+1. The shader derives the interpolation factor
     * from these and the current render-zoom fraction
     */
    private _writeZoomRange(prop: unknown, zoomFlatOffset: number): void {
        const expr = prop && (prop as {value?: unknown}).value;
        this._computeZoomRange(expr, this._floorZoom, evalFlatScratch, zoomFlatOffset);
    }

    /**
     * Write a data-driven property's [zm, zM] range into the flat buffer:
     *   appearance-zoom-stops → per-feature range, derived from this feature's resolved expression.
     *   shared-stop zoom-dep  → the layer's shared range (computed once in updateHeader), so every
     *                           feature's block carries the same [zm, zM] the shader mixes against.
     *   non-zoom              → [0, 0] (irrelevant — the value slot duplicates min into max).
     */
    private _writePropertyZoomRange(i: number, isZoomDep: boolean, hasAppearanceZoomStops: boolean, prop: unknown, zoomFlatOffset: number): void {
        if (hasAppearanceZoomStops) {
            this._writeZoomRange(prop, zoomFlatOffset);
        } else if (isZoomDep) {
            evalFlatScratch[zoomFlatOffset] = this.sharedZoomRanges[i * 2];
            evalFlatScratch[zoomFlatOffset + 1] = this.sharedZoomRanges[i * 2 + 1];
        } else {
            evalFlatScratch[zoomFlatOffset] = 0;
            evalFlatScratch[zoomFlatOffset + 1] = 0;
        }
    }

    /**
     * Evaluate a float property and write it into the flat buffer in UBO-ready, zoom-ready format:
     * flat[offset..offset+1] = [min, max]. Non-zoom properties duplicate min into max so the
     * shader's branchless mix degenerates to it.
     */
    private _evaluateFloatValue(
        propName: string,
        i: number,
        isZoomDep: boolean,
        hasAppearanceZoomStops: boolean,
        zoomFlatOffset: number,
        ctx: EvaluationContext,
        flatOffset: number
    ): void {
        const defaultVal = propName.endsWith('opacity') ? 1.0 : 0.0;
        const prop = this._resolveProp<number>(propName, ctx.activeAppearance);

        this._writePropertyZoomRange(i, isZoomDep, hasAppearanceZoomStops, prop, zoomFlatOffset);

        // Constants (no prop / constant DataDrivenProperty) are never zoom-dependent, so they
        // feed min and the max slot below duplicates it.
        const min =
            !prop ? defaultVal :
            prop.isConstant() ? prop.constantOr(defaultVal) :
            this._evalAt(prop, ctx.params, ctx);

        const minVal = min != null ? min : defaultVal;
        evalFlatScratch[flatOffset] = minVal;

        if (isZoomDep) {
            const max = this._evalAt(prop, ctx.paramsNext, ctx);
            evalFlatScratch[flatOffset + 1] = max != null ? max : defaultVal;
        } else {
            evalFlatScratch[flatOffset + 1] = minVal;
        }
    }

    /**
     * Evaluate a translate property and write it into the flat buffer in UBO-ready, zoom-ready
     * format: flat[offset..offset+3] = [tx_min, ty_min, tx_max, ty_max]. Non-zoom properties
     * duplicate min into max so the shader's branchless mix degenerates to it.
     */
    private _evaluateTranslateValue(
        propName: string,
        i: number,
        isZoomDep: boolean,
        hasAppearanceZoomStops: boolean,
        zoomFlatOffset: number,
        ctx: EvaluationContext,
        flatOffset: number
    ): void {
        const prop = this._resolveProp<[number, number]>(propName, ctx.activeAppearance);

        this._writePropertyZoomRange(i, isZoomDep, hasAppearanceZoomStops, prop, zoomFlatOffset);

        // translate is a DataConstantProperty at the layer level, so paint.get() returns the raw
        // [number, number] with no isConstant() wrapper; the appearance path is a DataDrivenProperty
        // (constant or not). A missing/null value falls back to 0 at the write below
        const evaluatable = !!prop && typeof prop.isConstant === 'function' && !prop.isConstant();
        const min =
            !prop ? undefined :
            typeof prop.isConstant !== 'function' ? (prop as unknown as [number, number]) :
            evaluatable ? this._evalAt(prop, ctx.params, ctx) :
            prop.constantOr(ZERO_VEC2);

        evalFlatScratch[flatOffset] = min ? min[0] : 0;
        evalFlatScratch[flatOffset + 1] = min ? min[1] : 0;

        if (isZoomDep) {
            const max = evaluatable ? this._evalAt(prop, ctx.paramsNext, ctx) : min;
            evalFlatScratch[flatOffset + 2] = max ? max[0] : 0;
            evalFlatScratch[flatOffset + 3] = max ? max[1] : 0;
        } else {
            evalFlatScratch[flatOffset + 2] = evalFlatScratch[flatOffset];
            evalFlatScratch[flatOffset + 3] = evalFlatScratch[flatOffset + 1];
        }
    }

    /**
     * Returns true if any appearance defines the given paint property (which forces it data-driven
     * so per-feature values can differ).
     */
    private _appearancesHavePaintProperties(propName: keyof AppearancePaintProps): boolean {
        return this.layer.getAppearances().some(a => a.hasPaintProperty(propName));
    }

    /**
     * Returns true if any layer paint property OR any appearance paint property read by
     * this binder depends on feature-state. When false, feature-state changes alone
     * cannot alter UBO contents (appearance condition flips are handled by
     * updateAppearances), so updateFeatures can be skipped on feature-state updates.
     *
     * Called per bucket.update with the fresh layer so runtime setPaintProperty edits
     * are picked up
     */
    hasStateDependentPaint(layer: SymbolStyleLayer): boolean {
        const paint = layer.paint;
        const names = PROP_NAMES[+this.isText];
        for (const name of names) {
            if (isPaintStateDependent(paint.get(name as keyof typeof paint._values))) return true;
        }
        for (const appearance of layer.getAppearances() || []) {
            for (const name of names) {
                const key = name as keyof AppearancePaintProps;
                if (appearance.hasPaintProperty(key) && isPaintStateDependent(appearance.paintProperties.get(key))) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * True when translate (property bit 8) is data-driven — its per-feature value lives in the UBO
     * and is applied per-vertex in the shader, so the draw-time matrix must omit translate.
     */
    hasPerFeatureTranslate(): boolean {
        return (this.header[HEADER_DATA_DRIVEN_MASK] & (1 << 8)) !== 0;
    }

    /**
     * Get the current number of batches.
     */
    getCurrentBatchIndex(): number {
        if (this.maxFeaturesPerBatch === 0) return 0;
        return Math.floor(this.featureCount / this.maxFeaturesPerBatch);
    }

    /**
     * Write an already-evaluated property set into the UBO slot for the feature at insertion
     * position `i`, re-deriving its batch/local index inline. Returns whether a write happened.
     *
     * The feature's global index equals its insertion position in the data-driven case (populateUBO
     * pushes once and increments featureCount once per feature) and is 0 in the all-constant case
     * (every feature deduplicates to entry 0). batch/local then follow from maxFeaturesPerBatch, with
     * the same device-limit clamp populateUBO applies — so this reproduces the slot populateUBO chose
     * without storing it per feature.
     */
    private _writeFeatureBlock(i: number, allValues: Float32Array): boolean {
        const globalFeatureIndex = this.isAllConstant ? 0 : i;
        let batchIndex = Math.floor(globalFeatureIndex / this.maxFeaturesPerBatch);
        let localFeatureIndex = globalFeatureIndex % this.maxFeaturesPerBatch;
        if (this._batchExceedsDeviceLimit(batchIndex)) {
            batchIndex = 0;
            localFeatureIndex = 0;
        }
        const ubo = this.ubos[batchIndex];
        if (!ubo) return false;
        ubo.writeDataDrivenBlock(allValues, localFeatureIndex);
        return true;
    }

    // Each UBO batch consumes 3 binding points (header, properties, block-indices), so a batch whose
    // highest binding point exceeds the device limit can't be bound. Such features fall back to batch 0
    // / local 0 (sharing slot 0). populateUBO (worker) and _writeFeatureBlock (main, on update) apply
    // this identical rule so a feature's update lands in the slot populate originally chose.
    private _batchExceedsDeviceLimit(batchIndex: number): boolean {
        return batchIndex * 3 + 2 >= this.maxUniformBufferBindings;
    }

    /**
     * Rebuild the Feature for the entry at insertion position `i` from the vector tile, re-evaluate
     * its paint properties (honoring feature-state and the current active appearance), and write the
     * result into its UBO slot. Shared by the feature-state and dynamic-expression update paths.
     */
    private _reevaluateAt(
        i: number,
        vtLayer: VectorTileLayer,
        canonical: CanonicalTileID,
        availableImages: ImageId[],
        featureStates: {[key: string | number]: FeatureState},
        brightness?: number | null
    ): void {
        if (!vtLayer) return;
        const vtFeatureIndex = this.allFeatureVtIndices[i];
        const vtFeature = vtLayer.feature(vtFeatureIndex);
        if (!vtFeature) return;

        const featureId = this.allFeatureIds[i];
        const featureState = featureId != null ? (featureStates[featureId] || {}) : {};

        const feature: Feature = {
            type: vtFeature.type,
            id: featureId,
            properties: vtFeature.properties || {},
            geometry: []
        };

        const activeAppearance = this.activeAppearanceByVtIndex ? this.activeAppearanceByVtIndex.get(vtFeatureIndex) : undefined;
        const formattedSection = this.allFormattedSections ? this.allFormattedSections[i] : undefined;
        const allValues = this.evaluateAllProperties(feature, featureState, canonical, availableImages, brightness, formattedSection || undefined, activeAppearance);
        this._writeFeatureBlock(i, allValues);
    }

    /**
     * Build the featureId / vtFeatureIndex → positions lookup maps from the insertion-order arrays.
     * Both maps are omitted from serialization and rebuilt lazily here on first main-thread use.
     */
    private _ensureRangeMaps(): void {
        if (this.featureVertexRangesFromId) return;
        this.featureVertexRangesFromId = new Map();
        this.featureVertexRangesFromVtIndex = new Map();
        for (let i = 0; i < this.allFeatureVtIndices.length; i++) {
            const featureId = this.allFeatureIds[i];
            if (featureId != null) {
                let byId = this.featureVertexRangesFromId.get(featureId);
                if (!byId) this.featureVertexRangesFromId.set(featureId, byId = []);
                byId.push(i);
            }
            const vtFeatureIndex = this.allFeatureVtIndices[i];
            let byVtIndex = this.featureVertexRangesFromVtIndex.get(vtFeatureIndex);
            if (!byVtIndex) this.featureVertexRangesFromVtIndex.set(vtFeatureIndex, byVtIndex = []);
            byVtIndex.push(i);
        }
    }

    /**
     * Populates a UBO entry for a feature and returns its local index within the batch.
     */
    populateUBO(
        feature: Feature,
        vtFeatureIndex: number,
        canonical: CanonicalTileID,
        availableImages: ImageId[],
        brightness?: number | null,
        formattedSection?: FormattedSection
    ): number {
        const featureId = feature.id;
        const header = this.header;

        // Evaluate all properties
        const allValues = this.evaluateAllProperties(feature, {}, canonical, availableImages, brightness, formattedSection);

        // Resolve the global entry index. All-constant binders carry no per-feature block (constants
        // go through u_spp_* uniforms), so every feature shares entry 0 and only the first allocates.
        // Otherwise each feature gets a fresh entry.
        let globalFeatureIndex: number;
        let isNewEntry: boolean;
        if (this.isAllConstant) {
            globalFeatureIndex = 0;
            isNewEntry = this.featureCount === 0;
            if (isNewEntry) this.featureCount = 1;
        } else {
            globalFeatureIndex = this.featureCount++;
            isNewEntry = true;
        }

        // Determine batch and local index
        let batchIndex = Math.floor(globalFeatureIndex / this.maxFeaturesPerBatch);
        let localIndex = globalFeatureIndex % this.maxFeaturesPerBatch;

        if (isNewEntry) {
            // Validate batch index against device limit before allocating.
            if (this._batchExceedsDeviceLimit(batchIndex)) {
                // Clamp gracefully instead of crashing the worker — overflow features share slot 0
                // and render with the first feature's properties, but the tile still loads.
                warnOnce(`Too many symbol features: batch ${batchIndex} requires binding points up to ${batchIndex * 3 + 2}, device limit ${this.maxUniformBufferBindings}. Some features will render incorrectly.`);
                batchIndex = 0;
                localIndex = 0;
            } else {
                // Create new batch if needed (shares the layer's header array). GPU buffers are
                // allocated lazily on the main thread after transfer; the worker passes no context.
                if (!this.ubos[batchIndex]) {
                    this.ubos[batchIndex] = new SymbolPropertiesUBO(null, batchIndex, this.uboSizeDwords, header);
                }

                // Write data-driven block for this feature (no constant block — u_spp_* handles constants)
                this.ubos[batchIndex].writeDataDrivenBlock(allValues, localIndex);
            }
        }

        // Record the feature in insertion order. Its position is its global index, from which
        // _writeFeatureBlock re-derives batch/local; the lookup maps are built lazily on the main thread.
        this.allFeatureVtIndices.push(vtFeatureIndex);
        this.allFeatureIds.push(featureId);
        this.allFormattedSections.push(formattedSection || null);

        return localIndex;
    }

    /**
     * Update specific features when feature-state changes.
     */
    updateFeatures(
        featureIds: Set<string | number>,
        styleLayer: SymbolStyleLayer,
        vtLayer: VectorTileLayer,
        canonical: CanonicalTileID,
        availableImages: ImageId[],
        featureStates: {[key: string | number]: FeatureState},
        brightness?: number | null
    ): void {
        this.layer = styleLayer;
        // Layer changed — constant uniform values may have new paint property values.
        this.cachedConstantUniforms = null;

        this._ensureRangeMaps();
        for (const featureId of featureIds) {
            const positions = this.featureVertexRangesFromId.get(featureId);
            if (!positions) continue;
            for (const i of positions) {
                this._reevaluateAt(i, vtLayer, canonical, availableImages, featureStates, brightness);
            }
        }
    }

    /**
     * Update all features when dynamic expressions change (brightness, config, images, paint props).
     *
     * Constant property changes are reflected through getConstantUniformValues() at draw time,
     * so only data-driven blocks need to be rewritten here.
     */
    updateDynamicExpressions(
        styleLayer: SymbolStyleLayer,
        vtLayer: VectorTileLayer,
        canonical: CanonicalTileID,
        availableImages: ImageId[],
        featureStates: {[key: string | number]: FeatureState},
        brightness?: number | null
    ): void {
        this.layer = styleLayer;
        // Layer changed — constant uniform values may have new property values, and zoom
        // stop values may have changed
        this.cachedConstantUniforms = null;
        this._recomputeSharedRanges();
        // Skip per-feature re-evaluation when no data-driven properties: constant properties
        // are read from this.layer at draw time via getConstantUniformValues(), which was
        // already invalidated above.
        if (this.header[HEADER_DATA_DRIVEN_MASK] === 0) return;

        for (let i = 0; i < this.allFeatureVtIndices.length; i++) {
            this._reevaluateAt(i, vtLayer, canonical, availableImages, featureStates, brightness);
        }
    }

    /**
     * Update UBO paint values for a single feature when its active appearance changes.
     * Called from updateAppearances() in symbol_bucket.ts whenever a feature's active
     * appearance transitions. Stores the appearance so updateDynamicExpressions/updateFeatures
     * also evaluate with the correct appearance.
     */
    updateFeaturePaintForAppearance(
        vtFeatureIndex: number,
        feature: Feature,
        featureState: FeatureState,
        canonical: CanonicalTileID,
        availableImages: ImageId[],
        brightness: number | null | undefined,
        activeAppearance: SymbolAppearance | null | undefined
    ): boolean {
        if (!this.layer) return false;
        // activeAppearanceByVtIndex is omitted from serialization and must be lazily re-initialized
        // on deserialized instances (worker → main thread transfer).
        if (!this.activeAppearanceByVtIndex) this.activeAppearanceByVtIndex = new Map();
        this.activeAppearanceByVtIndex.set(vtFeatureIndex, activeAppearance || null);
        if (this.header[HEADER_DATA_DRIVEN_MASK] === 0) return false; // All constant — nothing per-feature to write

        this._ensureRangeMaps();
        const positions = this.featureVertexRangesFromVtIndex.get(vtFeatureIndex);
        if (!positions) return false;

        // Evaluate per slot: sections of a formatted text-field each have their own UBO entry
        // and may have per-section paint overrides (e.g. text-color from format expression).
        // Re-use the stored formattedSection so those overrides take precedence over the appearance.
        let wrote = false;
        for (const i of positions) {
            const formattedSection = this.allFormattedSections ? this.allFormattedSections[i] : undefined;
            const allValues = this.evaluateAllProperties(feature, featureState, canonical, availableImages, brightness, formattedSection || undefined, activeAppearance);
            wrote = this._writeFeatureBlock(i, allValues) || wrote;
        }
        return wrote;
    }

    /**
     * Return values for the u_spp_* constant-property uniforms.
     *
     * Called once per draw call in draw_symbol.ts. Evaluates at the current render zoom
     * so that camera (zoom-only) expressions are up-to-date every frame.
     *
     * Result is cached: constant layers without camera or zoom-dep properties cache
     * indefinitely until the layer changes; otherwise the cache invalidates on renderZoom
     * or brightness change.
     */
    getConstantUniformValues(renderZoom: number, brightness?: number | null): ConstantUniformValues {
        const hasCameraExpr = !!this.cameraMask;

        // Cache hit: camera (zoom-only) expressions must be re-evaluated at the current render
        // zoom, so invalidate on renderZoom change when one is present.
        // cachedConstantPaint guards against stale constant colors when a paint update arrives without
        // a live transition (e.g. root transition {duration: 0}); layer.recalculate() produces a fresh
        // layer.paint object whenever a paint/config change is applied.
        // Truthy check (not !== null) because the field may be undefined after worker→main
        // transfer (constructor is not called during deserialization, omitted fields stay undefined).
        if (this.cachedConstantUniforms &&
                this.cachedConstantPaint === this.layer.paint &&
                this.cachedConstantBrightness === brightness &&
                (!hasCameraExpr || this.cachedConstantRenderZoom === renderZoom)) {
            return this.cachedConstantUniforms;
        }

        const paint = this.layer.paint;
        const renderParams = hasCameraExpr ?
            new EvaluationParameters(renderZoom, {brightness, worldview: this.worldview}) :
            null;
        const emptyFeature: Feature = {type: 1, id: undefined, properties: {}, geometry: []};
        const names = PROP_NAMES[+this.isText];

        const getColor = (propIdx: number): [number, number, number, number] => {
            const name = names[propIdx];
            const prop = paint.get(name as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<Color> | undefined;
            if (!prop) return [0, 0, 0, 1];

            const useThemeProp = paint.get(`${name}-use-theme` as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<string> | undefined;
            const useThemeValue = useThemeProp && typeof useThemeProp !== 'string' ? useThemeProp.value : undefined;
            const ignoreLut = shouldIgnoreLut(useThemeValue, emptyFeature, {}, [], undefined, brightness, undefined, this.worldview);
            const effectiveLut = ignoreLut ? null : this.lut;

            // Camera expressions need re-evaluation at render zoom; constants use the
            // already-evaluated value from the style layer (no EvaluationParameters needed).
            const isCamera = !!(this.cameraMask & (1 << propIdx));
            const color = isCamera && renderParams ?
                prop.property.evaluate(prop.value, renderParams, emptyFeature, {}, undefined, []) || Color.transparent :
                prop.constantOr(Color.transparent);
            return color.toNonPremultipliedRenderColor(effectiveLut).toArray01();
        };

        const getFloat = (propIdx: number, defaultVal: number): number => {
            const name = names[propIdx];
            const prop = paint.get(name as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<number> | undefined;
            if (!prop) return defaultVal;
            const isCamera = !!(this.cameraMask & (1 << propIdx));
            if (isCamera && renderParams) {
                const evaluated = prop.property.evaluate(prop.value, renderParams, emptyFeature, {}, undefined, []);
                return evaluated != null ? evaluated : defaultVal;
            }
            return prop.constantOr(defaultVal);
        };

        const result: ConstantUniformValues = {
            'fill_np_color': getColor(0),
            'halo_np_color': getColor(1),
            opacity: getFloat(2, 1.0),
            'halo_width': getFloat(3, 0.0),
            'halo_blur': getFloat(4, 0.0),
            'emissive_strength': getFloat(5, 0.0),
            'occlusion_opacity': getFloat(6, 1.0),
            'z_offset': getFloat(7, 0.0),
        };

        this.cachedConstantUniforms = result;
        this.cachedConstantRenderZoom = renderZoom;
        this.cachedConstantBrightness = brightness;
        this.cachedConstantPaint = this.layer.paint;
        return result;
    }

    /**
     * Called once on the worker after all features are populated, before transfer. Trims each
     * batch's oversized `propertiesData` staging array down to the bytes actually written so the
     * dead tail doesn't cross the worker→main boundary.
     */
    finalize(): void {
        for (const ubo of this.ubos) {
            ubo.rightSizeForTransfer();
        }
    }

    /**
     * Upload all UBO batches to GPU.
     */
    upload(context: Context): void {
        for (const ubo of this.ubos) {
            ubo.upload(context);
        }
    }

    /**
     * Bind UBO for rendering.
     */
    bind(context: Context, program: WebGLProgram, batchIndex: number = 0): void {
        if (this.ubos[batchIndex]) {
            this.ubos[batchIndex].bind(context, program);
        }
    }

    /**
     * Release GPU resources and clear feature tracking data.
     */
    destroy(): void {
        for (const ubo of this.ubos) {
            ubo.destroy();
        }
        this.ubos = [];
        this.featureVertexRangesFromId = null;
        this.featureVertexRangesFromVtIndex = null;
        this.allFeatureVtIndices = [];
        this.allFeatureIds = [];
        this.featureCount = 0;
        this.maxFeaturesPerBatch = 0;
    }
}

// 'layer' is omitted because SymbolStyleLayer is not serializable. It must be re-assigned on
// the main thread before any main-thread method (getConstantUniformValues, bind, etc.) is called.
// See draw_symbol.ts: `buffers.uboBinder.layer = layer` before drawSymbolElements().
register(SymbolPropertyBinderUBO, 'SymbolPropertyBinderUBO', {omit: ['layer', 'cachedConstantUniforms', 'cachedConstantRenderZoom', 'cachedConstantBrightness', 'cachedConstantPaint', 'activeAppearanceByVtIndex', 'featureVertexRangesFromId', 'featureVertexRangesFromVtIndex']});
