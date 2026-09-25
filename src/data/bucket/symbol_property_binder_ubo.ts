import {SymbolPropertiesUBO} from './symbol_properties_ubo';
import {HEADER_DATA_DRIVEN_MASK, HEADER_DZR_MASK, HEADER_BLOCK_SIZE_VEC4, HEADER_OFFSETS, HEADER_SHARED_ZOOM, floatToBits} from './paint_property_ubo';
import {PaintPropertyBinderUBO, isPaintStateDependent} from './paint_property_binder_ubo';
import {register} from '../../util/web_worker_transfer';

import type {PossiblyEvaluatedPropertyValue} from '../../style/properties';
import type {EvaluationContext, ZoomExpression} from './paint_property_binder_ubo';
import type EvaluationParameters from '../../style/evaluation_parameters';
import type SymbolStyleLayer from '../../style/style_layer/symbol_style_layer';
import type {Feature, FeatureState} from '../../style-spec/expression';
import type {FormattedSection} from '../../style-spec/expression/types/formatted';
import type {AppearancePaintProps} from '../../style/appearance_properties';
import type SymbolAppearance from '../../style/appearance';
import type {LUT} from '../../util/lut';
import type {CanonicalTileID} from '../../source/tile_id';
import type {ImageId} from '../../style-spec/expression/types/image_id';

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
const zoomRangeScratch = new Float32Array(2);

// Shared read-only translate default; passed to constantOr to avoid a per-feature [0, 0] allocation.
const ZERO_VEC2: [number, number] = [0, 0];

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
 *
 * See PaintPropertyBinderUBO for the shared feature-tracking/batching/zoom-range machinery.
 */
export class SymbolPropertyBinderUBO extends PaintPropertyBinderUBO<SymbolStyleLayer, ConstantUniformValues, SymbolPropertiesUBO> {
    isText: boolean;

    constructor(layer: SymbolStyleLayer, zoom: number, lut: LUT | null, isText: boolean, worldview: string = '', maxUniformBufferBindings?: number | null, uboSizeDwords?: number | null) {
        super(layer, zoom, lut, worldview, maxUniformBufferBindings, uboSizeDwords);
        this.isText = isText;
        this.allFormattedSections = [];
        this.activeAppearanceByVtIndex = null;
        this._finishInitialization();
    }

    protected _propNames(): readonly string[] {
        return PROP_NAMES[+this.isText];
    }

    protected _headerDwords(): number {
        return SymbolPropertiesUBO.HEADER_DWORDS;
    }

    protected _createUBO(batchIndex: number): SymbolPropertiesUBO {
        return new SymbolPropertiesUBO(null, batchIndex, this.uboSizeDwords, this.header);
    }

    protected _flatScratch(): Float32Array {
        return evalFlatScratch;
    }

    /**
     * Update the 12-dword header array that describes the UBO layout for the current layer.
     *
     * Only data-driven properties have meaningful offsets — constant properties are passed
     * as u_spp_* uniforms and their offsets in the header are unused (set to 0).
     */
    protected updateHeader(): void {
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
    protected _recomputeSharedRanges(): void {
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
            this._computeZoomRange(expr, floorZoom, zoomRangeScratch, 0);
            const zm = zoomRangeScratch[0];
            const zM = zoomRangeScratch[1];
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
     * Resolve a paint property by name, preferring the active appearance's override when it
     * defines that property, otherwise the layer's paint
     */
    protected override _resolveProp<T>(propName: string, activeAppearance: SymbolAppearance | null | undefined, isUseTheme: boolean = false, formattedSection?: FormattedSection): PossiblyEvaluatedPropertyValue<T> | undefined {
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
     * Evaluate the property at bit index `i` and write it into the flat scratch buffer, dispatching
     * to the color / translate / float evaluator by property kind.
     */
    protected _evaluatePropertyAt(i: number, ctx: EvaluationContext): void {
        const names = PROP_NAMES[+this.isText];
        const name = names[i];
        const isColor = i < 2;
        const isVec2 = i === 8;
        const dep = this.zoomDependency[i];
        const isZoomDep = dep !== ZOOM_INDEPENDENT;
        const hasAppearanceZoomStops = dep === ZOOM_DIFFERENT_RANGES;
        const flatOffset = SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[i];
        // The [zm, zM] pair immediately follows the value within the property's slot
        // (4 floats for colors/translate, 2 for scalars) — see the flat-layout doc in
        // symbol_properties_ubo.ts.
        const zoomFlatOffset = flatOffset + (isColor || isVec2 ? 4 : 2);

        if (isColor) {
            this._evaluateColorValue(name, i, isZoomDep, hasAppearanceZoomStops, zoomFlatOffset, ctx, flatOffset);
        } else if (isVec2) {
            this._evaluateTranslateValue(name, i, isZoomDep, hasAppearanceZoomStops, zoomFlatOffset, ctx, flatOffset);
        } else {
            const defaultVal = name.endsWith('opacity') ? 1.0 : 0.0;
            this._evaluateFloatValue(name, i, isZoomDep, hasAppearanceZoomStops, zoomFlatOffset, ctx, flatOffset, defaultVal);
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
    override hasStateDependentPaint(layer: SymbolStyleLayer): boolean {
        if (super.hasStateDependentPaint(layer)) return true;
        const names = PROP_NAMES[+this.isText];
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
     * Build the u_spp_* constant-property uniform values from the current layer.
     */
    protected _buildConstantUniforms(renderParams: EvaluationParameters | null, emptyFeature: Feature, brightness: number | null | undefined): ConstantUniformValues {
        const names = PROP_NAMES[+this.isText];
        return {
            'fill_np_color': this._constantColor(0, names[0], renderParams, emptyFeature, brightness, [0, 0, 0, 1]),
            'halo_np_color': this._constantColor(1, names[1], renderParams, emptyFeature, brightness, [0, 0, 0, 1]),
            opacity: this._constantFloat(2, names[2], renderParams, emptyFeature, 1.0),
            'halo_width': this._constantFloat(3, names[3], renderParams, emptyFeature, 0.0),
            'halo_blur': this._constantFloat(4, names[4], renderParams, emptyFeature, 0.0),
            'emissive_strength': this._constantFloat(5, names[5], renderParams, emptyFeature, 0.0),
            'occlusion_opacity': this._constantFloat(6, names[6], renderParams, emptyFeature, 1.0),
            'z_offset': this._constantFloat(7, names[7], renderParams, emptyFeature, 0.0),
        };
    }
}

// 'layer' is omitted because SymbolStyleLayer is not serializable. It must be re-assigned on
// the main thread before any main-thread method (getConstantUniformValues, bind, etc.) is called.
// See draw_symbol.ts: `buffers.uboBinder.layer = layer` before drawSymbolElements().
register(SymbolPropertyBinderUBO, 'SymbolPropertyBinderUBO', {omit: ['layer', 'cachedConstantUniforms', 'cachedConstantRenderZoom', 'cachedConstantBrightness', 'cachedConstantPaint', 'activeAppearanceByVtIndex', 'featureVertexRangesFromId', 'featureVertexRangesFromVtIndex']});
