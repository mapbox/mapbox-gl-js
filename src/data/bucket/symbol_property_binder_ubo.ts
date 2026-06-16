import {SymbolPropertiesUBO, HEADER_DATA_DRIVEN_MASK, HEADER_ZOOM_DEPENDENT_MASK, HEADER_BLOCK_SIZE_VEC4, HEADER_OFFSETS, HEADER_APPEARANCE_ZOOM_STOPS_SHIFT} from './symbol_properties_ubo';
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

/**
 * Constant property values ready to be set as u_spp_* uniforms.
 *
 * `zoomFactors` carries one precomputed interpolation factor per property — the same role
 * `u_opacity_t` etc. played in the pre-UBO pragma-mapbox approach. Each factor is the
 * `t` in `mix(min, max, t)` for that property at the current render zoom. 9 floats total,
 * indexed by property bit position; entries for non-zoom-dep properties are unused.
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
    zoomFactors: Float32Array;
};

/**
 * Manages UBO-based symbol paint properties.
 *
 * Uses the GL Native-aligned layout: header (3 uvec4) + per-feature data-driven blocks.
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
    // of 12 dwords (3 uvec4) shared with every batch's headerData; index it with the HEADER_* constants.
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

    // [zm, zM] pairs per zoom-dep property (9 pairs = 18 floats), computed in updateHeader.
    // Each draw call, getConstantUniformValues turns these into a single u_spp_*_zoom_factor
    // per property using the current render zoom. Only meaningful for properties whose zoom range
    // is shared across features
    // appearance-zoom-stops properties carry their [zm, zM] in the UBO block instead.
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

        this.activeAppearanceByVtIndex = null;

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
        let zoomDependentMask = 0;
        let appearanceZoomStopsMask = 0;
        let cameraMask = 0;
        let dataDrivenOffset = 0;
        let allDataDrivenLightConstant = true;

        const floorZoom = this._floorZoom;
        const names = PROP_NAMES[+this.isText];
        for (let i = 0; i < PROP_COUNT; i++) {
            const name = names[i];
            const isColor = i < 2;
            const isVec2 = i === 8;
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
            // appearance overriding it:
            //   not zoom-dependent → constant per feature, no interpolation.
            //   one shared range   → shared u_spp_*_zoom_factor uniform, sourced from that expression.
            //   ranges disagree    → appearances disagree on the stops → store [zm, zM] per feature.
            const zoom = this._collectZoomSignatures(name as keyof AppearancePaintProps, floorZoom);
            const isZoomDep = zoom.hasZoom;
            const hasAppearanceZoomStops = zoom.differs;

            if (isZoomDep) zoomDependentMask |= (1 << i);
            if (hasAppearanceZoomStops) appearanceZoomStopsMask |= (1 << i);

            // Check if this data-driven expression depends on light/brightness.
            // Same pattern as program_configuration.ts:313-314.
            const expr = prop && prop.value as {isLightConstant?: boolean} | undefined;
            if (expr && expr.isLightConstant === false) allDataDrivenLightConstant = false;

            // Block size in dwords, and how it must align within the vec4-packed block:
            //   appearance-zoom-stops  → vec4-aligned, with room for the [zm, zM] pair:
            //        color / translate → 8 dwords (value vec4 + [zm, zM, pad, pad])
            //        scalar            → 4 dwords (min, max, zm, zM)
            //   color / zoom-dep translate → 4 dwords (a full vec4), vec4-aligned
            //   non-zoom translate         → 2 dwords [tx, ty] kept within one vec4 (no straddle)
            //   scalar                     → 2 dwords if zoom-dep ([min, max]) else 1, unaligned
            let vec4Aligned: boolean;
            let size: number;
            if (hasAppearanceZoomStops) {
                vec4Aligned = true;
                size = (isColor || isVec2) ? 8 : 4;
            } else {
                vec4Aligned = isColor || (isVec2 && isZoomDep);
                size = vec4Aligned ? 4 : (isVec2 || isZoomDep) ? 2 : 1;
            }

            if (vec4Aligned && dataDrivenOffset % 4 !== 0) {
                dataDrivenOffset = (dataDrivenOffset + 3) & ~3;
            } else if (isVec2 && dataDrivenOffset % 4 === 3) {
                dataDrivenOffset++;
            }
            this.header[HEADER_OFFSETS + i] = dataDrivenOffset;
            dataDrivenOffset += size;

            // Single-signature properties get their shared [zm, zM] now
            // appearance-zoom-stops properties compute it per feature
            if (isZoomDep && !hasAppearanceZoomStops && zoom.representative) {
                this._computeZoomRange(zoom.representative, floorZoom, this.sharedZoomRanges, i * 2);
            }
        }

        // Round up data-driven block size to vec4 boundary, then express in vec4 units.
        const dataDrivenBlockSizeDwords = dataDrivenOffset === 0 ? 0 : (dataDrivenOffset + 3) & ~3;

        this.header[HEADER_DATA_DRIVEN_MASK] = dataDrivenMask;
        this.header[HEADER_ZOOM_DEPENDENT_MASK] = zoomDependentMask | (appearanceZoomStopsMask << HEADER_APPEARANCE_ZOOM_STOPS_SHIFT);
        this.header[HEADER_BLOCK_SIZE_VEC4] = dataDrivenBlockSizeDwords / 4;

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

        for (let i = 0; i < PROP_COUNT; i++) {
            const name = names[i];
            const isDataDriven = (this.header[HEADER_DATA_DRIVEN_MASK] & (1 << i)) !== 0;
            const isZoomDep = (this.header[HEADER_ZOOM_DEPENDENT_MASK] & (1 << i)) !== 0;
            const hasAppearanceZoomStops = ((this.header[HEADER_ZOOM_DEPENDENT_MASK] >>> HEADER_APPEARANCE_ZOOM_STOPS_SHIFT) & (1 << i)) !== 0;

            if (!isDataDriven) {
                const unevaluated = this._layerUnevaluated(name);
                if (unevaluated && unevaluated.expression && unevaluated.expression.kind === 'camera') cameraMask |= (1 << i);
            } else if (isZoomDep && !hasAppearanceZoomStops) {
                // Appearance-zoom-stops properties skip this because their per-feature
                // [zm, zM] is recomputed in evaluateAllProperties._writeZoomRange.
                const zoom = this._collectZoomSignatures(name as keyof AppearancePaintProps, floorZoom);
                if (zoom.representative) {
                    this._computeZoomRange(zoom.representative, floorZoom, this.sharedZoomRanges, i * 2);
                }
            }
        }

        this.cameraMask = cameraMask;
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
        const header = this.header;

        const names = PROP_NAMES[+this.isText];
        const appearanceZoomStopsMask = header[HEADER_ZOOM_DEPENDENT_MASK] >>> HEADER_APPEARANCE_ZOOM_STOPS_SHIFT;
        for (let i = 0; i < PROP_COUNT; i++) {
            const name = names[i];
            const isColor = i < 2;
            const isVec2 = i === 8;
            const isZoomDep = (header[HEADER_ZOOM_DEPENDENT_MASK] & (1 << i)) !== 0;
            const hasAppearanceZoomStops = (appearanceZoomStopsMask & (1 << i)) !== 0;
            const flatOffset = SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[i];
            const zoomFlatOffset = SymbolPropertiesUBO.EVAL_FLAT_ZOOM_OFFSETS[i];

            if (isColor) {
                this._evaluateColorValue(name, isZoomDep, hasAppearanceZoomStops, zoomFlatOffset, ctx, flatOffset);
            } else if (isVec2) {
                this._evaluateTranslateValue(name, isZoomDep, hasAppearanceZoomStops, zoomFlatOffset, ctx, flatOffset);
            } else {
                this._evaluateFloatValue(name, isZoomDep, hasAppearanceZoomStops, zoomFlatOffset, ctx, flatOffset);
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
     * Evaluate a color property and write it into the flat buffer in UBO-ready format (non-premultiplied, packed).
     *   non-zoom → flat[offset..offset+3] = [packed0, packed1, 0, 0]
     *   zoom-dep → flat[offset..offset+3] = [packMin0, packMin1, packMax0, packMax1]
     */
    private _evaluateColorValue(
        propName: string,
        isZoomDep: boolean,
        hasAppearanceZoomStops: boolean,
        zoomFlatOffset: number,
        ctx: EvaluationContext,
        flatOffset: number
    ): void {
        const prop = this._resolveProp<Color>(propName, ctx.activeAppearance, false, ctx.formattedSection);

        if (hasAppearanceZoomStops) this._writeZoomRange(prop, zoomFlatOffset);

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
            evalFlatScratch[flatOffset + 2] = 0;
            evalFlatScratch[flatOffset + 3] = 0;
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
     * Evaluate a float property and write it into the flat buffer in UBO-ready format.
     *   non-zoom → flat[offset] = val, flat[offset+1] = 0
     *   zoom-dep → flat[offset] = min, flat[offset+1] = max
     */
    private _evaluateFloatValue(
        propName: string,
        isZoomDep: boolean,
        hasAppearanceZoomStops: boolean,
        zoomFlatOffset: number,
        ctx: EvaluationContext,
        flatOffset: number
    ): void {
        const defaultVal = propName.endsWith('opacity') ? 1.0 : 0.0;
        const prop = this._resolveProp<number>(propName, ctx.activeAppearance);

        if (hasAppearanceZoomStops) this._writeZoomRange(prop, zoomFlatOffset);

        // Constants (no prop / constant DataDrivenProperty) are never zoom-dependent, so they
        // feed min and the max slot below stays 0.
        const min =
            !prop ? defaultVal :
            prop.isConstant() ? prop.constantOr(defaultVal) :
            this._evalAt(prop, ctx.params, ctx);

        evalFlatScratch[flatOffset] = min != null ? min : defaultVal;

        if (isZoomDep) {
            const max = this._evalAt(prop, ctx.paramsNext, ctx);
            evalFlatScratch[flatOffset + 1] = max != null ? max : defaultVal;
        } else {
            evalFlatScratch[flatOffset + 1] = 0;
        }
    }

    /**
     * Evaluate a translate property and write it into the flat buffer in UBO-ready format.
     *   non-zoom → flat[offset..offset+3] = [tx, ty, 0, 0]
     *   zoom-dep → flat[offset..offset+3] = [tx_min, ty_min, tx_max, ty_max]
     */
    private _evaluateTranslateValue(
        propName: string,
        isZoomDep: boolean,
        hasAppearanceZoomStops: boolean,
        zoomFlatOffset: number,
        ctx: EvaluationContext,
        flatOffset: number
    ): void {
        const prop = this._resolveProp<[number, number]>(propName, ctx.activeAppearance);

        if (hasAppearanceZoomStops) this._writeZoomRange(prop, zoomFlatOffset);

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
            evalFlatScratch[flatOffset + 2] = 0;
            evalFlatScratch[flatOffset + 3] = 0;
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
        const header = this.header;
        const hasCameraExpr = !!this.cameraMask;
        const hasZoomDep = !!header[HEADER_ZOOM_DEPENDENT_MASK];

        // Cache hit: zoom factors depend on renderZoom too, so we must also invalidate on
        // renderZoom change when any property is zoom-dependent.
        // Truthy check (not !== null) because the field may be undefined after worker→main
        // transfer (constructor is not called during deserialization, omitted fields stay undefined).
        if (this.cachedConstantUniforms &&
                this.cachedConstantBrightness === brightness &&
                ((!hasCameraExpr && !hasZoomDep) || this.cachedConstantRenderZoom === renderZoom)) {
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

        // Precompute the zoom-interpolation factor for every zoom-dep property.
        // Step expressions encode the snap as zm == zM.
        const zoomFactors = new Float32Array(PROP_COUNT);
        if (hasZoomDep) {
            const uZoom = renderZoom - Math.floor(renderZoom);
            for (let i = 0; i < PROP_COUNT; i++) {
                if ((header[HEADER_ZOOM_DEPENDENT_MASK] & (1 << i)) === 0) continue;
                const zm = this.sharedZoomRanges[i * 2];
                const zM = this.sharedZoomRanges[i * 2 + 1];
                zoomFactors[i] = zm === zM ?
                    (uZoom >= zm ? 1.0 : 0.0) :
                    Math.max(0, Math.min(1, (uZoom - zm) / (zM - zm)));
            }
        }

        const result: ConstantUniformValues = {
            'fill_np_color': getColor(0),
            'halo_np_color': getColor(1),
            opacity: getFloat(2, 1.0),
            'halo_width': getFloat(3, 0.0),
            'halo_blur': getFloat(4, 0.0),
            'emissive_strength': getFloat(5, 0.0),
            'occlusion_opacity': getFloat(6, 1.0),
            'z_offset': getFloat(7, 0.0),
            zoomFactors,
        };

        this.cachedConstantUniforms = result;
        this.cachedConstantRenderZoom = renderZoom;
        this.cachedConstantBrightness = brightness;
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
register(SymbolPropertyBinderUBO, 'SymbolPropertyBinderUBO', {omit: ['layer', 'cachedConstantUniforms', 'cachedConstantRenderZoom', 'cachedConstantBrightness', 'activeAppearanceByVtIndex', 'featureVertexRangesFromId', 'featureVertexRangesFromVtIndex']});
