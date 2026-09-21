import {HEADER_DATA_DRIVEN_MASK, HEADER_BLOCK_SIZE_VEC4} from './paint_property_ubo';
import Color from '../../style-spec/util/color';
import EvaluationParameters from '../../style/evaluation_parameters';
import {PossiblyEvaluatedPropertyValue, type PossiblyEvaluatedValue} from '../../style/properties';
import {packUint8ToFloat} from '../../shaders/encode_attribute';
import {warnOnce} from '../../util/util';

import type {PaintPropertiesUBO} from './paint_property_ubo';
import type StyleLayer from '../../style/style_layer';
import type {LUT} from '../../util/lut';
import type {Feature, FeatureState, CameraExpression, CompositeExpression, StylePropertyExpression} from '../../style-spec/expression';
import type {CanonicalTileID} from '../../source/tile_id';
import type {ImageId} from '../../style-spec/expression/types/image_id';
import type Context from '../../gl/context';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {FormattedSection} from '../../style-spec/expression/types/formatted';
import type SymbolAppearance from '../../style/appearance';

// WebGL2 minimum guaranteed value for MAX_UNIFORM_BUFFER_BINDINGS (OpenGL ES 3.0.6 table 6.33)
const WEBGL2_MIN_UNIFORM_BUFFER_BINDINGS = 24;

/**
 * True if `prop` is a data-driven paint property whose expression reads feature-state.
 * Constants and camera-only expressions return false.
 */
export function isPaintStateDependent(prop: unknown): boolean {
    if (!(prop instanceof PossiblyEvaluatedPropertyValue)) return false;
    const inner = prop.value;
    return (inner.kind === 'source' || inner.kind === 'composite') && inner.isStateDependent;
}

/**
 * Determines if LUT should be ignored based on use-theme property.
 */
export function shouldIgnoreLut(
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
 * Shared context for property evaluation. `formattedSection`/`activeAppearance` are meaningful
 * only for symbol (per-section color overrides, active appearance overrides); line always leaves
 * them undefined.
 */
export type EvaluationContext = {
    feature: Feature;
    featureState: FeatureState;
    canonical: CanonicalTileID;
    availableImages: ImageId[];
    params: EvaluationParameters;
    paramsNext: EvaluationParameters;
    formattedSection?: FormattedSection;
    activeAppearance?: SymbolAppearance | null;
};

export type ZoomExpression = CameraExpression | CompositeExpression;

// Keys are the live unevaluated-expression objects a camera expression was un-baked from
// (disjoint per layer, since each layer owns its own transitionable-paint / appearance objects),
// so a single cache safely serves every binder instance.
const cameraWrapCache = new WeakMap<object, PossiblyEvaluatedPropertyValue<unknown>>();

/**
 * Shared base for per-layer paint-property UBO binders (SymbolPropertyBinderUBO,
 * LinePropertyBinderUBO). Owns feature tracking, batching, zoom-range bookkeeping, and the
 * constant-uniform cache; layer-specific layout (property names/count, header shape, per-property
 * evaluation) is supplied through the abstract hooks below.
 *
 * `TLayer` is the concrete style layer type, `TConstantUniforms` the shape returned by
 * getConstantUniformValues(), `TUBO` the concrete PaintPropertiesUBO subclass this binder manages.
 */
export abstract class PaintPropertyBinderUBO<TLayer extends StyleLayer, TConstantUniforms, TUBO extends PaintPropertiesUBO> {
    layer: TLayer;
    zoom: number;
    lut: LUT | null;
    worldview: string;
    maxUniformBufferBindings: number;

    // Per-feature tracking, in insertion (populate) order. One entry per populateUBO call;
    // the entry's index IS the feature's global index (see _writeFeatureBlock).
    // These parallel arrays are the only feature-tracking state transferred worker→main;
    // the lookup maps below are rebuilt lazily on the main thread.
    allFeatureVtIndices: number[];                          // vector-tile feature index per entry
    allFeatureIds: Array<string | number | undefined>;      // feature id per entry (if any)
    // Formatted section per entry (for per-section color overrides). Symbol-only: line leaves
    // this undefined, and populateUBO/_reevaluateAt guard every read/write on its presence.
    allFormattedSections?: Array<FormattedSection | null>;

    // Lazily built on the main thread (omitted from serialization). Map a featureId / vtFeatureIndex
    // to the positions in allFeature* that reference it, for O(1) targeted updates.
    // featureVertexRangesFromId backs feature-state updates; featureVertexRangesFromVtIndex backs
    // symbol's appearance updates, which dispatch by vt index rather than featureId — line never
    // reads it, but _ensureRangeMaps builds both maps unconditionally, so it exists on line
    // instances too (empty, unused; omitted from serialization all the same).
    featureVertexRangesFromId: Map<string | number, number[]>;
    featureVertexRangesFromVtIndex: Map<number, number[]>;

    // UBO batches
    ubos: TUBO[];
    featureCount: number;       // Total across all batches

    // Header (built once in the constructor, describes layout of each UBO batch), shared with
    // every batch's headerData; index it with the HEADER_* constants (and any layer-specific ones).
    header: Uint32Array;
    maxFeaturesPerBatch: number; // computed from header

    // True when no paint property is data-driven (dataDrivenMask === 0). Such binders carry no
    // per-feature block — constants go through uniforms — so every feature shares entry 0.
    isAllConstant: boolean;

    // Cached result of getConstantUniformValues (main-thread only, excluded from serialization).
    // Invalidated when the layer changes or when zoom/brightness change for camera expressions.
    cachedConstantUniforms: TConstantUniforms | null;
    cachedConstantRenderZoom: number | null;
    cachedConstantBrightness: number | null | undefined;
    // Identity of the layer.paint object the cache was computed from. layer.recalculate() produces a
    // fresh paint object on every Style.update() a paint/config change triggers, so an identity change
    // means constant paint values may have changed. Guards against a stale cached color when a paint
    // update does not come with a live transition (e.g. root transition {duration: 0}); see #13702.
    cachedConstantPaint: object | null;

    // Tracks current active appearance per vtFeatureIndex (main-thread only, excluded from
    // serialization). Symbol-only: set up lazily by updateFeaturePaintForAppearance; line never
    // touches it, so _reevaluateAt's read is guarded on its presence.
    activeAppearanceByVtIndex?: Map<number, SymbolAppearance | null> | null;

    uboSizeDwords: number;

    // True when no data-driven property uses measure-light expressions.
    // When true, updateDynamicExpressions can be skipped on brightness-only changes.
    isLightConstant!: boolean;

    // Bitmask: 1 = property is a constant camera (zoom-only) expression, computed in updateHeader.
    // CPU-only — camera properties go through uniforms (re-evaluated at render zoom), not the GPU
    // UBO, so this is not part of the header.
    cameraMask!: number;

    // Per-property zoom classification, one byte per property, computed in updateHeader (subclass:
    // symbol's 3-way ZOOM_* enum, line's plain 0/1 boolean). CPU-side bookkeeping that decides what
    // evaluateAllProperties computes; the shader only gets the DZR bit through the header.
    // Serialized (see register() calls in the subclasses) so the main-thread instance can read it
    // after worker transfer, since `layer` is omitted there.
    zoomDependency: Uint8Array;

    // [zm, zM] pairs per zoom-dependent property, computed in updateHeader. evaluateAllProperties
    // copies the shared pair into every feature's zoom-ready block slot; symbol's
    // appearance-zoom-stops properties compute their [zm, zM] per feature instead.
    sharedZoomRanges: Float32Array;
    _zoomRangeScratch: Float32Array;
    _floorZoom: number;

    protected abstract _propNames(): readonly string[];
    protected abstract _headerDwords(): number;
    protected abstract _createUBO(batchIndex: number): TUBO;
    protected abstract _flatScratch(): Float32Array;
    protected abstract updateHeader(): void;
    protected abstract _recomputeSharedRanges(): void;
    protected abstract _evaluatePropertyAt(i: number, ctx: EvaluationContext): void;
    protected abstract _buildConstantUniforms(
        renderParams: EvaluationParameters | null,
        emptyFeature: Feature,
        brightness: number | null | undefined
    ): TConstantUniforms;

    /**
     * Bitmask of properties that must not be rewritten by the update path (feature-state /
     * dynamic-expression changes), because they aren't populated from an expression at all and
     * `evaluateAllProperties` has nothing meaningful to re-evaluate for them — e.g. line's
     * `line-dasharray`, populated once from the tile's line atlas at bucket-population time (see
     * LinePropertyBinderUBO). Default: no such properties.
     */
    protected _immutableAfterPopulateMask(): number {
        return 0;
    }

    /**
     * Number of consecutive UBO binding points each batch occupies — must match the concrete
     * TUBO's PaintPropertiesUBO._bindingsPerBatch() (3 with an indirection block, symbol; 2
     * without, line). Used only for the device-limit check below, since the binder never binds
     * UBOs itself.
     */
    protected _bindingsPerBatch(): number {
        return 3;
    }

    constructor(layer: TLayer, zoom: number, lut: LUT | null, worldview: string = '', maxUniformBufferBindings?: number | null, uboSizeDwords?: number | null) {
        this.layer = layer;
        this.zoom = zoom;
        this.lut = lut;
        this.worldview = worldview;
        this.maxUniformBufferBindings = maxUniformBufferBindings || WEBGL2_MIN_UNIFORM_BUFFER_BINDINGS;
        this.uboSizeDwords = uboSizeDwords || 4096;

        this.allFeatureVtIndices = [];
        this.allFeatureIds = [];
        this.featureVertexRangesFromId = null;
        this.featureVertexRangesFromVtIndex = null;
        this.ubos = [];
        this.featureCount = 0;

        this.cachedConstantUniforms = null;
        this.cachedConstantRenderZoom = null;
        this.cachedConstantBrightness = undefined;
        this.cachedConstantPaint = null;
    }

    /**
     * Completes construction once the subclass has set its own fields (e.g. symbol's `isText`),
     * which `updateHeader()` (called here, polymorphically) may depend on. Must be the last call
     * in every subclass constructor.
     */
    protected _finishInitialization(): void {
        const propCount = this._propNames().length;
        this.zoomDependency = new Uint8Array(propCount);
        this.sharedZoomRanges = new Float32Array(propCount * 2);
        this._zoomRangeScratch = new Float32Array(2);
        this._floorZoom = Math.floor(this.zoom);
        this.header = new Uint32Array(this._headerDwords());
        this.updateHeader();
        this.isAllConstant = this.header[HEADER_DATA_DRIVEN_MASK] === 0;

        // Max features per UBO batch = how many data-driven blocks fit in one buffer.
        // All-constant layers have no per-feature block, so a single batch holds every feature.
        const blockDwords = this.header[HEADER_BLOCK_SIZE_VEC4] * 4;
        this.maxFeaturesPerBatch = blockDwords === 0 ? Number.MAX_SAFE_INTEGER : Math.floor(this.uboSizeDwords / blockDwords);
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
    protected _computeZoomRange(expr: unknown, floorZoom: number, out: Float32Array, outOffset: number): void {
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
     * Resolve a paint property by name, un-baking a camera (zoom-only) expression that
     * possiblyEvaluate collapsed to a constant so it interpolates across zoom like a composite.
     * This is line's simple form (paint.get() + un-bake); symbol overrides it with its
     * appearance/formatted-section-aware version, using the same call signature so the shared
     * `_evaluateColorValue`/`_evaluateFloatValue` below can call it polymorphically.
     */
    protected _resolveProp<T>(propName: string, activeAppearance?: unknown, isUseTheme: boolean = false, formattedSection?: FormattedSection): PossiblyEvaluatedPropertyValue<T> | undefined {
        const pe = this._paintGet<T>(propName);
        if (!pe || typeof pe.isConstant !== 'function' || !pe.isConstant()) return pe;
        const source = this._layerUnevaluated(propName);
        return this._unbakeCamera(pe, source);
    }

    /**
     * If `source` is a zoom-only expression, return a PossiblyEvaluatedPropertyValue wrapping
     * the live expression so it interpolates across zoom like a composite.
     */
    protected _unbakeCamera<T>(pe: PossiblyEvaluatedPropertyValue<T>, source: unknown): PossiblyEvaluatedPropertyValue<T> {
        const expr = source && (source as {expression?: {kind?: string}}).expression;
        if (!expr || expr.kind !== 'camera') return pe;
        let wrapped = cameraWrapCache.get(source as object) as PossiblyEvaluatedPropertyValue<T> | undefined;
        if (!wrapped) {
            wrapped = new PossiblyEvaluatedPropertyValue<T>(pe.property, expr as unknown as never, pe.parameters, pe.iconImageUseTheme);
            cameraWrapCache.set(source as object, wrapped);
        }
        return wrapped;
    }

    protected _layerUnevaluated(propName: string): {expression?: StylePropertyExpression} | undefined {
        const tv = (this.layer._transitionablePaint._values as Record<string, {value?: {expression?: StylePropertyExpression}}>)[propName];
        return tv && tv.value;
    }

    /**
     * The zoom-dependent expression behind an unevaluated PropertyValue or null if it isn't zoom-dependent.
     */
    protected _zoomExprOf(source: {expression?: StylePropertyExpression} | undefined): ZoomExpression | null {
        const expr = source && source.expression;
        if (!expr) return null;
        return (expr.kind === 'composite' || expr.kind === 'camera') ? expr : null;
    }

    /** Evaluate a property at the given zoom params, with the verbose shared argument list filled in. */
    protected _evalAt<T>(prop: PossiblyEvaluatedPropertyValue<T>, params: EvaluationParameters, ctx: EvaluationContext): T {
        return prop.property.evaluate(
            prop.value, params, ctx.feature, ctx.featureState,
            ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
        );
    }

    /**
     * Read a paint property directly off `this.layer.paint._values`, bypassing paint.get()'s
     * compile-time key restriction — this is line's original approach (needed there for the
     * synthetic `line-floorwidth` property, which has no entry in PaintProps) and is provably
     * identical to paint.get() for every real property too (see properties.ts:621's PossiblyEvaluated#get,
     * which is exactly `this._values[name]`), so it serves both layers here.
     */
    protected _paintGet<T>(propName: string): PossiblyEvaluatedPropertyValue<T> | undefined {
        const paint = this.layer.paint as unknown as {_values: Record<string, PossiblyEvaluatedPropertyValue<T> | undefined>};
        return paint._values[propName];
    }

    /**
     * Resolve the LUT to apply to a color property: `null` when the property's `-use-theme` value
     * opts out of the layer LUT, `this.lut` otherwise.
     */
    protected _effectiveLut(
        useThemeProp: PossiblyEvaluatedPropertyValue<string> | undefined,
        feature: Feature,
        featureState: FeatureState,
        availableImages: ImageId[],
        canonical?: CanonicalTileID,
        brightness?: number | null,
        formattedSection?: FormattedSection
    ): LUT | null {
        const useThemeValue = useThemeProp && typeof useThemeProp !== 'string' ? useThemeProp.value : undefined;
        return shouldIgnoreLut(
            useThemeValue, feature, featureState, availableImages,
            canonical, brightness, formattedSection, this.worldview
        ) ? null : this.lut;
    }

    /**
     * Compute the per-feature zoom range [zm, zM] for the resolved property and write it as two
     * floats into the flat buffer at zoomFlatOffset/+1. The shader derives the interpolation factor
     * from these and the current render-zoom fraction.
     */
    protected _writeZoomRange(prop: unknown, zoomFlatOffset: number): void {
        const expr = prop && (prop as {value?: unknown}).value;
        this._computeZoomRange(expr, this._floorZoom, this._flatScratch(), zoomFlatOffset);
    }

    /**
     * Write a data-driven property's [zm, zM] range into the flat buffer:
     *   appearance-zoom-stops (symbol only) → per-feature range, derived from this feature's
     *                         resolved expression.
     *   shared-stop zoom-dep  → the layer's shared range (computed once in updateHeader), so every
     *                           feature's block carries the same [zm, zM] the shader mixes against.
     *   non-zoom              → [0, 0] (irrelevant — the value slot duplicates min into max).
     */
    protected _writePropertyZoomRange(i: number, isZoomDep: boolean, hasAppearanceZoomStops: boolean, prop: unknown, zoomFlatOffset: number): void {
        const flat = this._flatScratch();
        if (hasAppearanceZoomStops) {
            this._writeZoomRange(prop, zoomFlatOffset);
        } else if (isZoomDep) {
            flat[zoomFlatOffset] = this.sharedZoomRanges[i * 2];
            flat[zoomFlatOffset + 1] = this.sharedZoomRanges[i * 2 + 1];
        } else {
            flat[zoomFlatOffset] = 0;
            flat[zoomFlatOffset + 1] = 0;
        }
    }

    /**
     * Evaluate a color property and write it into the flat buffer in UBO-ready, zoom-ready format
     * (non-premultiplied, packed): flat[offset..offset+3] = [packMin0, packMin1, packMax0, packMax1].
     * Non-zoom properties duplicate min into max so the shader's branchless mix degenerates to it.
     *
     * `zoomFlatOffset` doubles as a "does this property's block have a per-feature zoom slot?"
     * flag: symbol passes the real flat offset (colors get one for DifferentZoomRanges), line
     * always passes -1 (its color block has no zoom slot — the range lives only in the header).
     */
    protected _evaluateColorValue(
        propName: string,
        i: number,
        isZoomDep: boolean,
        hasAppearanceZoomStops: boolean,
        zoomFlatOffset: number,
        ctx: EvaluationContext,
        flatOffset: number
    ): void {
        const prop = this._resolveProp<Color>(propName, ctx.activeAppearance, false, ctx.formattedSection);
        const flat = this._flatScratch();

        if (zoomFlatOffset >= 0) {
            this._writePropertyZoomRange(i, isZoomDep, hasAppearanceZoomStops, prop, zoomFlatOffset);
        }

        if (!prop) {
            flat[flatOffset] = 0;
            flat[flatOffset + 1] = 0;
            flat[flatOffset + 2] = 0;
            flat[flatOffset + 3] = 1;
            return;
        }

        // Use-theme: prefer appearance's value when it defines the color, fall back to layer's.
        const useThemeProp = this._resolveProp<string>(`${propName}-use-theme`, ctx.activeAppearance, true);
        const effectiveLut = this._effectiveLut(
            useThemeProp,
            ctx.feature, ctx.featureState, ctx.availableImages,
            ctx.canonical, ctx.params.brightness, ctx.formattedSection
        );

        const colorMin = prop.isConstant() ? prop.constantOr(Color.transparent) : this._evalAt(prop, ctx.params, ctx) || Color.transparent;

        // Non-premultiplied — the fragment shader does vec4(np_color.rgb * np_color.a, np_color.a).
        // Inline packNonPremultColor to avoid allocating a [number, number] tuple.
        const minNP = colorMin.toNonPremultipliedRenderColor(effectiveLut);
        flat[flatOffset] = packUint8ToFloat(255 * minNP.r, 255 * minNP.g);
        flat[flatOffset + 1] = packUint8ToFloat(255 * minNP.b, 255 * minNP.a);

        if (isZoomDep) {
            // zoom-dependent ⟹ data-driven composite (never constant), so evaluate the next-zoom color directly.
            const maxNP = (this._evalAt(prop, ctx.paramsNext, ctx) || Color.transparent).toNonPremultipliedRenderColor(effectiveLut);
            flat[flatOffset + 2] = packUint8ToFloat(255 * maxNP.r, 255 * maxNP.g);
            flat[flatOffset + 3] = packUint8ToFloat(255 * maxNP.b, 255 * maxNP.a);
        } else {
            flat[flatOffset + 2] = flat[flatOffset];
            flat[flatOffset + 3] = flat[flatOffset + 1];
        }
    }

    /**
     * Evaluate a float property and write it into the flat buffer in UBO-ready, zoom-ready format:
     * flat[offset..offset+1] = [min, max]. Non-zoom properties duplicate min into max so the
     * shader's branchless mix degenerates to it. `defaultVal` differs per layer: symbol special-
     * cases `*-opacity` to default to 1, line reads a per-property default table.
     */
    protected _evaluateFloatValue(
        propName: string,
        i: number,
        isZoomDep: boolean,
        hasAppearanceZoomStops: boolean,
        zoomFlatOffset: number,
        ctx: EvaluationContext,
        flatOffset: number,
        defaultVal: number
    ): void {
        const prop = this._resolveProp<number>(propName, ctx.activeAppearance);
        const flat = this._flatScratch();

        this._writePropertyZoomRange(i, isZoomDep, hasAppearanceZoomStops, prop, zoomFlatOffset);

        // Constants (no prop / constant DataDrivenProperty) are never zoom-dependent, so they
        // feed min and the max slot below duplicates it.
        const min =
            !prop ? defaultVal :
            prop.isConstant() ? prop.constantOr(defaultVal) :
            this._evalAt(prop, ctx.params, ctx);

        const minVal = min ?? defaultVal;
        flat[flatOffset] = minVal;

        if (isZoomDep) {
            const max = this._evalAt(prop, ctx.paramsNext, ctx);
            flat[flatOffset + 1] = max ?? defaultVal;
        } else {
            flat[flatOffset + 1] = minVal;
        }
    }

    /**
     * Evaluate every paint property and return their UBO-ready values in the subclass's flat
     * scratch buffer (see `_flatScratch`/`_flatOffsets`). Loops over `_propNames()`, dispatching
     * each property's color/float/(symbol-only translate) evaluation to `_evaluatePropertyAt`.
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

        const propCount = this._propNames().length;
        for (let i = 0; i < propCount; i++) {
            this._evaluatePropertyAt(i, ctx);
        }

        return this._flatScratch();
    }

    /**
     * Returns true if any layer paint property read by this binder depends on feature-state.
     * When false, feature-state changes alone cannot alter UBO contents, so updateFeatures can be
     * skipped on feature-state updates. Symbol additionally checks its appearances (see override).
     *
     * Called per bucket.update with the fresh `layer` argument (not `this.layer`, which may not
     * have been reassigned yet) so runtime setPaintProperty edits are picked up.
     */
    hasStateDependentPaint(layer: TLayer): boolean {
        const paint = layer.paint as unknown as {_values: Record<string, unknown>};
        for (const name of this._propNames()) {
            if (isPaintStateDependent(paint._values[name])) return true;
        }
        return false;
    }

    /**
     * Get the current number of batches.
     */
    getCurrentBatchIndex(): number {
        if (this.maxFeaturesPerBatch === 0) return 0;
        const batchIndex = Math.floor(this.featureCount / this.maxFeaturesPerBatch);

        if (this._checkBatchExceedsDeviceLimitAndWarn(batchIndex)) {
            return 0;
        }

        return batchIndex;
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
    protected _writeFeatureBlock(i: number, allValues: Float32Array): boolean {
        const globalFeatureIndex = this.isAllConstant ? 0 : i;
        const batchIndex = Math.floor(globalFeatureIndex / this.maxFeaturesPerBatch);
        if (this._checkBatchExceedsDeviceLimitAndWarn(batchIndex)) {
            // match populateUBO's clamp: overflow features share slot 0 and render
            // with the first feature's properties, but the tile still loads.
            return false;
        }
        const localFeatureIndex = globalFeatureIndex % this.maxFeaturesPerBatch;
        const ubo = this.ubos[batchIndex];
        if (!ubo) return false;
        ubo.writeDataDrivenBlock(allValues, localFeatureIndex, this._immutableAfterPopulateMask());
        return true;
    }

    // Each UBO batch consumes _bindingsPerBatch() binding points (header, properties, and,
    // for symbol, block-indices), so a batch whose highest binding point exceeds the device
    // limit can't be bound. Such features fall back to batch 0 / local 0 (sharing slot 0).
    // populateUBO (worker) and _writeFeatureBlock (main, on update) apply this identical rule
    // so a feature's update lands in the slot populate originally chose.
    protected _checkBatchExceedsDeviceLimitAndWarn(batchIndex: number): boolean {
        const bindings = this._bindingsPerBatch();
        const highestBindingPoint = batchIndex * bindings + (bindings - 1);
        if (highestBindingPoint < this.maxUniformBufferBindings) return false;
        warnOnce(`Too many features for UBO paint properties: batch ${batchIndex} requires binding points up to ${highestBindingPoint}, device limit ${this.maxUniformBufferBindings}. Some features will render incorrectly.`);
        return true;
    }

    /**
     * Rebuild the Feature for the entry at insertion position `i` from the vector tile, re-evaluate
     * its paint properties (honoring feature-state and, for symbol, the current active appearance),
     * and write the result into its UBO slot. Shared by the feature-state and dynamic-expression
     * update paths. Symbol's appearance/formatted-section reads degrade to line's plain behavior
     * (undefined) when those fields aren't populated.
     */
    protected _reevaluateAt(
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
    protected _ensureRangeMaps(): void {
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

        // Resolve the global entry index. All-constant binders carry no per-feature block (constants
        // go through uniforms), so every feature shares entry 0 and only the first allocates.
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
            if (this._checkBatchExceedsDeviceLimitAndWarn(batchIndex)) {
                // Clamp gracefully instead of crashing the worker — overflow features share slot 0
                // and render with the first feature's properties, but the tile still loads.
                batchIndex = 0;
                localIndex = 0;
            } else {
                // Create new batch if needed (shares the layer's header array). GPU buffers are
                // allocated lazily on the main thread after transfer; the worker passes no context.
                if (!this.ubos[batchIndex]) {
                    this.ubos[batchIndex] = this._createUBO(batchIndex);
                }

                // Evaluate only when the result will actually be stored: an all-constant binder's
                // block is zero-sized (writeDataDrivenBlock no-ops below, constants go through
                // uniforms instead), so evaluating here would just discard the full per-property
                // evaluation (color packing, LUT resolution, ...) for every feature of every tile.
                if (!this.isAllConstant) {
                    const allValues = this.evaluateAllProperties(feature, {}, canonical, availableImages, brightness, formattedSection);
                    // Write data-driven block for this feature (no constant block — uniforms handle constants)
                    this.ubos[batchIndex].writeDataDrivenBlock(allValues, localIndex);
                }
            }
        }

        // Record the feature in insertion order. Its position is its global index, from which
        // _writeFeatureBlock re-derives batch/local; the lookup maps are built lazily on the main thread.
        this.allFeatureVtIndices.push(vtFeatureIndex);
        this.allFeatureIds.push(featureId);
        if (this.allFormattedSections) this.allFormattedSections.push(formattedSection || null);

        return localIndex;
    }

    /**
     * Update specific features when feature-state changes.
     */
    updateFeatures(
        featureIds: Set<string | number>,
        styleLayer: TLayer,
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
        styleLayer: TLayer,
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
     * Reassign the style layer this binder reads from (e.g. a bucket shared by multiple style
     * layers must always point at that layer's current, possibly just-recalculated instance).
     * Only clears the constant-uniform cache when the layer identity actually changed, since
     * recomputing it is otherwise wasted work.
     */
    reassignLayer(layer: TLayer): void {
        if (this.layer === layer) return;
        this.layer = layer;
        this.cachedConstantUniforms = null;
    }

    /**
     * Evaluate a constant color property for the uniform block, given its bit index and paint
     * property name. `fallback` differs per property (e.g. line-border-color has no default paint
     * spec value, so it falls back to transparent rather than opaque black).
     */
    protected _constantColor(
        propIdx: number,
        propName: string,
        renderParams: EvaluationParameters | null,
        emptyFeature: Feature,
        brightness: number | null | undefined,
        fallback: [number, number, number, number]
    ): [number, number, number, number] {
        const prop = this._paintGet<Color>(propName);
        if (!prop) return fallback;

        const useThemeProp = this._paintGet<string>(`${propName}-use-theme`);
        const effectiveLut = this._effectiveLut(useThemeProp, emptyFeature, {}, [], undefined, brightness, undefined);

        // Camera expressions need re-evaluation at render zoom; constants use the
        // already-evaluated value from the style layer (no EvaluationParameters needed).
        const isCamera = !!(this.cameraMask & (1 << propIdx));
        const color = isCamera && renderParams ?
            prop.property.evaluate(prop.value, renderParams, emptyFeature, {}, undefined, []) || Color.transparent :
            prop.constantOr(Color.transparent);
        return color.toNonPremultipliedRenderColor(effectiveLut).toArray01();
    }

    /**
     * Evaluate a constant float property for the uniform block, given its bit index and paint
     * property name.
     */
    protected _constantFloat(
        propIdx: number,
        propName: string,
        renderParams: EvaluationParameters | null,
        emptyFeature: Feature,
        defaultVal: number
    ): number {
        const prop = this._paintGet<number>(propName);
        if (!prop) return defaultVal;
        const isCamera = !!(this.cameraMask & (1 << propIdx));
        if (isCamera && renderParams) {
            const evaluated = prop.property.evaluate(prop.value, renderParams, emptyFeature, {}, undefined, []);
            return evaluated ?? defaultVal;
        }
        return prop.constantOr(defaultVal);
    }

    /**
     * Return values for the constant-property uniforms.
     *
     * Called once per draw call. Evaluates at the current render zoom so that camera (zoom-only)
     * expressions are up-to-date every frame.
     *
     * Result is cached: constant layers without camera or zoom-dep properties cache
     * indefinitely until the layer changes; otherwise the cache invalidates on renderZoom
     * or brightness change.
     */
    getConstantUniformValues(renderZoom: number, brightness?: number | null): TConstantUniforms {
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

        const renderParams = hasCameraExpr ?
            new EvaluationParameters(renderZoom, {brightness, worldview: this.worldview}) :
            null;
        const emptyFeature: Feature = {type: 1, id: undefined, properties: {}, geometry: []};

        const result = this._buildConstantUniforms(renderParams, emptyFeature, brightness);

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
     * The UBO for a given batch, e.g. for re-binding it to a second program (debug wireframe).
     */
    getUBO(batchIndex: number = 0): PaintPropertiesUBO | undefined {
        return this.ubos[batchIndex];
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
