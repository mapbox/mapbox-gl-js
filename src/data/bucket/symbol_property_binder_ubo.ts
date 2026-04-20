import {SymbolPropertiesUBO, type SymbolPropertyHeader} from './symbol_properties_ubo';
import Color from '../../style-spec/util/color';
import EvaluationParameters from '../../style/evaluation_parameters';
import {register} from '../../util/web_worker_transfer';
import {packUint8ToFloat} from '../../shaders/encode_attribute';
import {warnOnce} from '../../util/util';

import type {PossiblyEvaluatedValue, PossiblyEvaluatedPropertyValue} from '../../style/properties';
import type SymbolStyleLayer from '../../style/style_layer/symbol_style_layer';
import type {LUT} from '../../util/lut';
import type {Feature, FeatureState} from '../../style-spec/expression';
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

    if (lutExpression.kind === 'composite' || lutExpression.kind === 'source') {
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

    if (typeof lutExpression === 'string') {
        return lutExpression === 'none';
    }

    return false;
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
};

/**
 * Property definition metadata.
 */
type PropDef = {
    name: string;
    useThemeName: string | null;
    isColor: boolean;
    isVec2?: boolean; // translate is a [number, number] vec2 property
};

/**
 * Tracks UBO location for a feature across multiple batches.
 */
export type LocalFeatureVertexRange = {
    batchIndex: number;        // Which UBO batch (0-N)
    localFeatureIndex: number; // Index within batch (0 to maxFeaturesPerBatch-1)
    vtFeatureIndex: number;    // Vector tile feature index
    featureId: string | number | undefined;
};

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

    // Hash map for O(1) feature-state lookup
    featureVertexRangesFromId: Map<string | number, LocalFeatureVertexRange[]>;
    // Track ALL features for full re-evaluation when images/properties change
    allFeatures: LocalFeatureVertexRange[];

    // UBO batches
    ubos: SymbolPropertiesUBO[];
    featureCount: number;       // Total across all batches

    // Header (built once, describes layout of each UBO batch)
    cachedHeader: SymbolPropertyHeader | null;
    maxFeaturesPerBatch: number; // computed from header

    // Deduplication: hash of data-driven property values → global feature index
    propertyHashToUBOIndex: Map<string, number>;
    canDeduplicate: boolean;

    isText: boolean;
    propDefs: PropDef[]; // built once from isText; never changes

    // Cached EvaluationParameters for evaluateAllProperties (excluded from serialization)
    cachedParams: EvaluationParameters | null;
    cachedParamsNext: EvaluationParameters | null;
    cachedBrightness: number | null | undefined;

    // Cached result of getConstantUniformValues (main-thread only, excluded from serialization).
    // Invalidated when the layer changes or when zoom/brightness change for camera expressions.
    cachedConstantUniforms: ConstantUniformValues | null;
    cachedConstantRenderZoom: number | null;
    cachedConstantBrightness: number | null | undefined;

    // Tracks current active appearance per vtFeatureIndex (main-thread only, excluded from serialization).
    activeAppearanceByVtIndex: Map<number, SymbolAppearance | null>;

    uboSizeDwords: number;

    // True when no data-driven property uses measure-light expressions.
    // When true, updateDynamicExpressions can be skipped on brightness-only changes.
    isLightConstant: boolean;

    // Flat scratch buffer for evaluateAllProperties — reused per call, eliminates per-feature inner array allocations.
    _evalFlat: Float32Array;

    constructor(layer: SymbolStyleLayer, zoom: number, lut: LUT | null, isText: boolean, worldview: string = '', maxUniformBufferBindings?: number | null, uboSizeDwords?: number | null) {
        this.layer = layer;
        this.zoom = zoom;
        this.lut = lut;
        this.isText = isText;
        this.propDefs = this._getPropDefs();
        this.worldview = worldview;
        this.maxUniformBufferBindings = maxUniformBufferBindings || WEBGL2_MIN_UNIFORM_BUFFER_BINDINGS;
        this.uboSizeDwords = uboSizeDwords || 4096;

        this.featureVertexRangesFromId = new Map();
        this.allFeatures = [];
        this.ubos = [];
        this.featureCount = 0;
        this.cachedHeader = null;
        this.maxFeaturesPerBatch = 0;

        this.propertyHashToUBOIndex = new Map();
        this.canDeduplicate = this._checkIfAllPropertiesAreConstant(layer, isText);

        this.cachedParams = null;
        this.cachedParamsNext = null;
        this.cachedBrightness = undefined;

        this.cachedConstantUniforms = null;
        this.cachedConstantRenderZoom = null;
        this.cachedConstantBrightness = undefined;

        this.activeAppearanceByVtIndex = new Map();
        this.isLightConstant = true; // updated in buildHeader()
        this._evalFlat = new Float32Array(SymbolPropertiesUBO.EVAL_FLAT_TOTAL);
    }

    /**
     * Returns an ordered list of property definitions for text or icon.
     * Order determines bit index: 0=fill_color, 1=halo_color, 2=opacity,
     * 3=halo_width, 4=halo_blur, 5=emissive_strength, 6=occlusion_opacity, 7=z_offset,
     * 8=translate.
     */
    private _getPropDefs(): PropDef[] {
        const p = this.isText ? 'text' : 'icon';
        return [
            {name: `${p}-color`,            useThemeName: `${p}-color-use-theme`,       isColor: true},
            {name: `${p}-halo-color`,        useThemeName: `${p}-halo-color-use-theme`,  isColor: true},
            {name: `${p}-opacity`,           useThemeName: null,                          isColor: false},
            {name: `${p}-halo-width`,        useThemeName: null,                          isColor: false},
            {name: `${p}-halo-blur`,         useThemeName: null,                          isColor: false},
            {name: `${p}-emissive-strength`, useThemeName: null,                          isColor: false},
            {name: `${p}-occlusion-opacity`, useThemeName: null,                          isColor: false},
            {name: 'symbol-z-offset',        useThemeName: null,                          isColor: false},
            {name: `${p}-translate`,         useThemeName: null,                          isColor: false, isVec2: true},
        ];
    }

    /**
     * Build a SymbolPropertyHeader that describes the UBO layout for the current layer.
     *
     * Only data-driven properties have meaningful offsets — constant properties are passed
     * as u_spp_* uniforms and their offsets in the header are unused (set to 0).
     */
    buildHeader(): SymbolPropertyHeader {
        const paint = this.layer.paint;
        const propDefs = this.propDefs;

        let dataDrivenMask = 0;
        let zoomDependentMask = 0;
        let cameraMask = 0;
        let dataDrivenOffset = 0;
        let allDataDrivenLightConstant = true;
        const offsets: [number, number, number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0, 0, 0];

        for (let i = 0; i < 9; i++) {
            const {name, isColor, isVec2} = propDefs[i];
            const prop = paint.get(name as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<unknown> | undefined;

            // DataConstantProperty returns a plain value (no isConstant method) — treat as constant.
            const layerIsDataDriven = prop && typeof prop.isConstant === 'function' ? !prop.isConstant() : false;
            // If any appearance defines this property, it must be in the UBO so per-feature values can differ.
            const appearanceForceDataDriven =
                this._appearancesHavePaintProperties(name as keyof AppearancePaintProps);
            const isDataDriven = layerIsDataDriven || appearanceForceDataDriven;
            const isZoomDep = !!(prop && prop.value && (prop.value as {kind?: string}).kind === 'composite');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
            const transVal: any = (this.layer._transitionablePaint._values as any)[name];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const origKind = (transVal && transVal.value && transVal.value.expression && transVal.value.expression.kind) as string | undefined;
            const isCamera = !isDataDriven && origKind === 'camera';

            if (isDataDriven) {
                dataDrivenMask |= (1 << i);
                if (isZoomDep) zoomDependentMask |= (1 << i);
                // Check if this data-driven expression depends on light/brightness.
                // Same pattern as program_configuration.ts:313-314.
                const expr = prop && prop.value as {isLightConstant?: boolean} | undefined;
                if (expr && expr.isLightConstant === false) allDataDrivenLightConstant = false;

                if (isColor) {
                    // Colors must be vec4-aligned within the data-driven block.
                    if (dataDrivenOffset % 4 !== 0) {
                        dataDrivenOffset = (dataDrivenOffset + 3) & ~3;
                    }
                    offsets[i] = dataDrivenOffset;
                    dataDrivenOffset += 4;
                } else if (isVec2) {
                    if (isZoomDep) {
                        // zoom-dep translate needs 4 floats [tx_min, ty_min, tx_max, ty_max], vec4-aligned.
                        if (dataDrivenOffset % 4 !== 0) {
                            dataDrivenOffset = (dataDrivenOffset + 3) & ~3;
                        }
                        offsets[i] = dataDrivenOffset;
                        dataDrivenOffset += 4;
                    } else {
                        // non-zoom translate needs 2 floats [tx, ty] within the same vec4.
                        // Ensure offset%4 != 3 (y would overflow to next vec4).
                        if (dataDrivenOffset % 4 === 3) dataDrivenOffset++;
                        offsets[i] = dataDrivenOffset;
                        dataDrivenOffset += 2;
                    }
                } else {
                    offsets[i] = dataDrivenOffset;
                    dataDrivenOffset += isZoomDep ? 2 : 1;
                }
            } else {
                if (isCamera) cameraMask |= (1 << i);
                // Constant properties use u_spp_* uniforms — offset is unused, leave at 0.
            }
        }

        // Round up data-driven block size to vec4 boundary, then express in vec4 units.
        const dataDrivenBlockSizeDwords = dataDrivenOffset === 0 ? 0 : (dataDrivenOffset + 3) & ~3;
        const dataDrivenBlockSizeVec4 = dataDrivenBlockSizeDwords / 4;

        this.isLightConstant = allDataDrivenLightConstant;

        return {dataDrivenMask, zoomDependentMask, cameraMask, dataDrivenBlockSizeVec4, offsets};
    }

    /**
     * Returns true if any paint property uses a camera (zoom-only) expression.
     */
    get hasCameraExpression(): boolean {
        return !!(this.cachedHeader && this.cachedHeader.cameraMask);
    }

    /**
     * Evaluate all 8 properties and return their UBO-ready values.
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
        const {params, paramsNext} = this._getCachedParams(brightness);
        const ctx: EvaluationContext = {feature, featureState, canonical, availableImages, params, paramsNext, formattedSection};
        const header = this.cachedHeader;
        const propDefs = this.propDefs;
        if (!this._evalFlat) this._evalFlat = new Float32Array(SymbolPropertiesUBO.EVAL_FLAT_TOTAL);
        const flat = this._evalFlat;

        for (let i = 0; i < 9; i++) {
            const {name, useThemeName, isColor, isVec2} = propDefs[i];
            const isZoomDep = !!(header && (header.zoomDependentMask & (1 << i)) !== 0);
            const flatOffset = SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[i];

            if (isColor) {
                this._evaluateColorValue(name, useThemeName, ctx, brightness, isZoomDep, activeAppearance, flat, flatOffset);
            } else if (isVec2) {
                this._evaluateTranslateValue(name, isZoomDep, ctx, activeAppearance, flat, flatOffset);
            } else {
                this._evaluateFloatValue(name, isZoomDep, ctx, activeAppearance, flat, flatOffset);
            }
        }

        return flat;
    }

    /**
     * Evaluate a color property and write it into the flat buffer in UBO-ready format (non-premultiplied, packed).
     *   non-zoom → flat[offset..offset+3] = [packed0, packed1, 0, 0]
     *   zoom-dep → flat[offset..offset+3] = [packMin0, packMin1, packMax0, packMax1]
     */
    private _evaluateColorValue(
        propName: string,
        useThemeName: string | null,
        ctx: EvaluationContext,
        brightness: number | null | undefined,
        isZoomDep: boolean,
        activeAppearance: SymbolAppearance | null | undefined,
        flat: Float32Array,
        flatOffset: number
    ): void {
        const paint = this.layer.paint;

        // Appearance overrides the color property.
        const appearanceName = propName as keyof AppearancePaintProps;
        const useAppearanceProp = activeAppearance && activeAppearance.hasPaintProperty(appearanceName);
        const prop = useAppearanceProp ?
            activeAppearance.paintProperties.get(appearanceName) as PossiblyEvaluatedPropertyValue<Color> | undefined :
            paint.get(propName as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<Color> | undefined;

        // Use-theme: prefer appearance's value when it defines the color, fall back to layer's.
        const appearanceUseThemeName = useThemeName as keyof AppearancePaintProps;
        const useAppearanceTheme = useThemeName && activeAppearance && activeAppearance.hasPaintProperty(appearanceUseThemeName);
        const useThemeProp = useAppearanceTheme ?
            activeAppearance.paintProperties.get(appearanceUseThemeName) as PossiblyEvaluatedPropertyValue<string> | undefined :
            (useThemeName ? paint.get(useThemeName as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<string> | undefined : undefined);

        if (!prop) {
            flat[flatOffset] = 0; flat[flatOffset + 1] = 0; flat[flatOffset + 2] = 0; flat[flatOffset + 3] = 1;
            return;
        }

        const useThemeValue = useThemeProp && typeof useThemeProp !== 'string' ? useThemeProp.value : undefined;
        const ignoreLut = shouldIgnoreLut(
            useThemeValue,
            ctx.feature, ctx.featureState, ctx.availableImages,
            ctx.canonical, brightness, ctx.formattedSection, this.worldview
        );
        const effectiveLut = ignoreLut ? null : this.lut;

        let colorMin: Color;
        let colorMax: Color;
        if (prop.isConstant()) {
            colorMin = colorMax = prop.constantOr(Color.transparent);
        } else {
            colorMin = prop.property.evaluate(
                prop.value, ctx.params, ctx.feature, ctx.featureState,
                ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
            );
            colorMax = isZoomDep ?
                prop.property.evaluate(
                    prop.value, ctx.paramsNext, ctx.feature, ctx.featureState,
                    ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
                ) :
                colorMin;
        }

        // Non-premultiplied — the fragment shader does vec4(np_color.rgb * np_color.a, np_color.a).
        // Inline packNonPremultColor to avoid allocating a [number, number] tuple.
        const minNP = (colorMin || Color.transparent).toNonPremultipliedRenderColor(effectiveLut);
        flat[flatOffset] = packUint8ToFloat(255 * minNP.r, 255 * minNP.g);
        flat[flatOffset + 1] = packUint8ToFloat(255 * minNP.b, 255 * minNP.a);
        if (isZoomDep) {
            const maxNP = (colorMax || Color.transparent).toNonPremultipliedRenderColor(effectiveLut);
            flat[flatOffset + 2] = packUint8ToFloat(255 * maxNP.r, 255 * maxNP.g);
            flat[flatOffset + 3] = packUint8ToFloat(255 * maxNP.b, 255 * maxNP.a);
        } else {
            // Non-zoom: last 2 dwords are padding (shader uses readVec2).
            flat[flatOffset + 2] = 0;
            flat[flatOffset + 3] = 0;
        }
    }

    /**
     * Evaluate a float property and write it into the flat buffer in UBO-ready format.
     *   non-zoom → flat[offset] = val, flat[offset+1] = 0
     *   zoom-dep → flat[offset] = min, flat[offset+1] = max
     */
    private _evaluateFloatValue(
        propName: string,
        isZoomDep: boolean,
        ctx: EvaluationContext,
        activeAppearance: SymbolAppearance | null | undefined,
        flat: Float32Array,
        flatOffset: number
    ): void {
        const paint = this.layer.paint;
        const defaultVal = propName.endsWith('opacity') ? 1.0 : 0.0;

        // Appearance overrides the float property.
        const appearanceName = propName as keyof AppearancePaintProps;
        const useAppearanceProp = activeAppearance && activeAppearance.hasPaintProperty(appearanceName);
        const prop = useAppearanceProp ?
            activeAppearance.paintProperties.get(appearanceName) as PossiblyEvaluatedPropertyValue<number> | undefined :
            paint.get(propName as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<number> | undefined;

        if (!prop) {
            flat[flatOffset] = defaultVal; flat[flatOffset + 1] = 0;
            return;
        }

        if (prop.isConstant()) {
            flat[flatOffset] = prop.constantOr(defaultVal); flat[flatOffset + 1] = 0;
            return;
        }

        const min = prop.property.evaluate(
            prop.value, ctx.params, ctx.feature, ctx.featureState,
            ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
        );
        flat[flatOffset] = min !== null && min !== undefined ? min : defaultVal;

        if (isZoomDep) {
            const max = prop.property.evaluate(
                prop.value, ctx.paramsNext, ctx.feature, ctx.featureState,
                ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
            );
            flat[flatOffset + 1] = max !== null && max !== undefined ? max : defaultVal;
        } else {
            flat[flatOffset + 1] = 0;
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
        ctx: EvaluationContext,
        activeAppearance: SymbolAppearance | null | undefined,
        flat: Float32Array,
        flatOffset: number
    ): void {
        const paint = this.layer.paint;
        const appearanceName = propName as keyof AppearancePaintProps;
        const useAppearanceProp = activeAppearance && activeAppearance.hasPaintProperty(appearanceName);
        const prop = useAppearanceProp ?
            activeAppearance.paintProperties.get(appearanceName) as unknown as PossiblyEvaluatedPropertyValue<[number, number]> | undefined :
            paint.get(propName as keyof typeof paint._values) as unknown as PossiblyEvaluatedPropertyValue<[number, number]> | undefined;

        if (!prop) {
            flat[flatOffset] = 0; flat[flatOffset + 1] = 0; flat[flatOffset + 2] = 0; flat[flatOffset + 3] = 0;
            return;
        }

        // translate is a DataConstantProperty at the layer level (not data-driven), so paint.get()
        // returns the raw [number, number] value directly — no isConstant() wrapper.
        // The appearance path uses DataDrivenProperty and goes through the branches below.
        if (typeof prop.isConstant !== 'function') {
            const tv = (prop as unknown as [number, number]) || [0, 0];
            flat[flatOffset] = tv[0]; flat[flatOffset + 1] = tv[1]; flat[flatOffset + 2] = 0; flat[flatOffset + 3] = 0;
            return;
        }

        if (prop.isConstant()) {
            const tv = prop.constantOr([0, 0]);
            flat[flatOffset] = tv[0]; flat[flatOffset + 1] = tv[1]; flat[flatOffset + 2] = 0; flat[flatOffset + 3] = 0;
            return;
        }

        const minVal: [number, number] = prop.property.evaluate(
            prop.value, ctx.params, ctx.feature, ctx.featureState,
            ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
        ) || [0, 0];

        flat[flatOffset] = minVal[0];
        flat[flatOffset + 1] = minVal[1];

        if (isZoomDep) {
            const maxVal: [number, number] = prop.property.evaluate(
                prop.value, ctx.paramsNext, ctx.feature, ctx.featureState,
                ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
            ) || [0, 0];
            flat[flatOffset + 2] = maxVal[0];
            flat[flatOffset + 3] = maxVal[1];
        } else {
            flat[flatOffset + 2] = 0;
            flat[flatOffset + 3] = 0;
        }
    }

    /**
     * Gets or creates cached EvaluationParameters for the current zoom and brightness.
     */
    private _getCachedParams(brightness?: number | null): {params: EvaluationParameters; paramsNext: EvaluationParameters} {
        if (this.cachedParams && this.cachedParamsNext && this.cachedBrightness === brightness) {
            return {params: this.cachedParams, paramsNext: this.cachedParamsNext};
        }
        this.cachedParams = new EvaluationParameters(this.zoom, {brightness, worldview: this.worldview});
        this.cachedParamsNext = new EvaluationParameters(this.zoom + 1, {brightness, worldview: this.worldview});
        this.cachedBrightness = brightness;
        return {params: this.cachedParams, paramsNext: this.cachedParamsNext};
    }

    /**
     * Returns true if any appearance defines paint properties.
     * When propName is provided, checks that specific property.
     * When omitted, checks whether any icon/text paint property (as appropriate) is defined.
     */
    private _appearancesHavePaintProperties(propName?: keyof AppearancePaintProps): boolean {
        const appearances = this.layer.getAppearances();
        if (propName !== undefined) {
            return appearances.some(a => a.hasPaintProperty(propName));
        }
        return this.isText ?
            appearances.some(a => a.hasTextPaintProperties()) :
            appearances.some(a => a.hasIconPaintProperties());
    }

    private _checkIfAllPropertiesAreConstant(layer: SymbolStyleLayer, isText: boolean): boolean {
        const paint = layer.paint;
        const prefix = isText ? 'text' : 'icon';
        const props = [
            `${prefix}-color`, `${prefix}-halo-color`, `${prefix}-opacity`,
            `${prefix}-halo-width`, `${prefix}-halo-blur`, `${prefix}-emissive-strength`,
            `${prefix}-occlusion-opacity`, 'symbol-z-offset', `${prefix}-translate`,
        ];
        for (const propName of props) {
            const prop = paint.get(propName as keyof typeof paint._values);
            if (prop && typeof prop === 'object' && 'isConstant' in prop && !prop.isConstant()) {
                return false;
            }
        }
        // Appearances can override paint properties per-feature, so deduplication is unsafe.
        if (this._appearancesHavePaintProperties()) return false;
        return true;
    }

    /**
     * Hash data-driven property values for deduplication.
     * Returns an empty string when there are no data-driven properties (all constant).
     */
    private _hashDataDrivenValues(flat: Float32Array, header: SymbolPropertyHeader): string {
        if (header.dataDrivenMask === 0) return ''; // All constant — single entry
        const parts: string[] = [];
        for (let i = 0; i < this.propDefs.length; i++) {
            if ((header.dataDrivenMask & (1 << i)) === 0) continue;
            const offset = SymbolPropertiesUBO.EVAL_FLAT_OFFSETS[i];
            const size = SymbolPropertiesUBO.EVAL_FLAT_SIZES[i];
            let entry = String(flat[offset]);
            for (let j = 1; j < size; j++) entry += `,${String(flat[offset + j])}`;
            parts.push(entry);
        }
        return parts.join('|');
    }

    /**
     * Get the current number of batches.
     */
    getCurrentBatchIndex(): number {
        if (!this.cachedHeader || this.maxFeaturesPerBatch === 0) return 0;
        return Math.floor(this.featureCount / this.maxFeaturesPerBatch);
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
        formattedSection?: FormattedSection,
        context?: Context
    ): number {
        const featureId = feature.id;

        // Build header on first feature
        if (!this.cachedHeader) {
            this.cachedHeader = this.buildHeader();
            const max = SymbolPropertiesUBO.getMaxFeatureCount(this.cachedHeader, this.uboSizeDwords);
            this.maxFeaturesPerBatch = isFinite(max) ? max : Number.MAX_SAFE_INTEGER;
        }
        const header = this.cachedHeader;

        // Evaluate all properties
        const allValues = this.evaluateAllProperties(feature, {}, canonical, availableImages, brightness, formattedSection);

        // Deduplication: all-constant case means dataDrivenMask=0 → all features share entry 0
        if (this.canDeduplicate) {
            const hash = this._hashDataDrivenValues(allValues, header);
            const existingIndex = this.propertyHashToUBOIndex.get(hash);
            if (existingIndex !== undefined) {
                const batchIndex = isFinite(this.maxFeaturesPerBatch) ? Math.floor(existingIndex / this.maxFeaturesPerBatch) : 0;
                const localIndex = isFinite(this.maxFeaturesPerBatch) ? existingIndex % this.maxFeaturesPerBatch : existingIndex;
                const featureRange: LocalFeatureVertexRange = {batchIndex, localFeatureIndex: localIndex, vtFeatureIndex, featureId};
                this.allFeatures.push(featureRange);
                if (featureId !== null && featureId !== undefined) {
                    if (!this.featureVertexRangesFromId.has(featureId)) this.featureVertexRangesFromId.set(featureId, []);
                    this.featureVertexRangesFromId.get(featureId).push(featureRange);
                }
                return localIndex;
            }
            this.propertyHashToUBOIndex.set(hash, this.featureCount);
        }

        // Allocate a new entry
        const globalFeatureIndex = this.featureCount++;

        // Determine batch and local index
        const batchIndex = isFinite(this.maxFeaturesPerBatch) ? Math.floor(globalFeatureIndex / this.maxFeaturesPerBatch) : 0;
        const localIndex = isFinite(this.maxFeaturesPerBatch) ? globalFeatureIndex % this.maxFeaturesPerBatch : globalFeatureIndex;

        // Validate batch index against device limit before allocating.
        // Each batch uses 3 binding points (header, properties, block-indices).
        // Clamp gracefully instead of crashing the worker — overflow features share slot 0
        // and render with the first feature's properties, but the tile still loads.
        const maxBindingPoints = context ? context.maxUniformBufferBindings : this.maxUniformBufferBindings;
        if (batchIndex * 3 + 2 >= maxBindingPoints) {
            warnOnce(`Too many symbol features: batch ${batchIndex} requires binding points up to ${batchIndex * 3 + 2}, device limit ${maxBindingPoints}. Some features will render incorrectly.`);
            const clampedRange: LocalFeatureVertexRange = {batchIndex: 0, localFeatureIndex: 0, vtFeatureIndex, featureId};
            this.allFeatures.push(clampedRange);
            if (featureId !== null && featureId !== undefined) {
                if (!this.featureVertexRangesFromId.has(featureId)) this.featureVertexRangesFromId.set(featureId, []);
                this.featureVertexRangesFromId.get(featureId).push(clampedRange);
            }
            return 0;
        }

        // Create new batch if needed and write the header
        if (!this.ubos[batchIndex]) {
            this.ubos[batchIndex] = new SymbolPropertiesUBO(context, batchIndex, this.uboSizeDwords);
            this.ubos[batchIndex].writeHeader(header);
        }

        // Write data-driven block for this feature (no constant block — u_spp_* handles constants)
        this.ubos[batchIndex].writeDataDrivenBlock(allValues, localIndex, header);

        // Track feature for future updates
        const featureRange: LocalFeatureVertexRange = {batchIndex, localFeatureIndex: localIndex, vtFeatureIndex, featureId};
        this.allFeatures.push(featureRange);
        if (featureId !== null && featureId !== undefined) {
            if (!this.featureVertexRangesFromId.has(featureId)) this.featureVertexRangesFromId.set(featureId, []);
            this.featureVertexRangesFromId.get(featureId).push(featureRange);
        }

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
        if (!this.cachedHeader) return;
        const header = this.cachedHeader;

        for (const featureId of featureIds) {
            const ranges = this.featureVertexRangesFromId.get(featureId);
            if (!ranges) continue;
            const featureState = featureStates[featureId] || {};

            for (const range of ranges) {
                if (!vtLayer) continue;
                const vtFeature = vtLayer.feature(range.vtFeatureIndex);
                if (!vtFeature) continue;

                const feature: Feature = {
                    type: vtFeature.type,
                    id: featureId,
                    properties: vtFeature.properties || {},
                    geometry: []
                };

                const activeAppearance = this.activeAppearanceByVtIndex ? this.activeAppearanceByVtIndex.get(range.vtFeatureIndex) : undefined;
                const allValues = this.evaluateAllProperties(feature, featureState, canonical, availableImages, brightness, undefined, activeAppearance);
                if (!this.ubos[range.batchIndex]) continue;
                this.ubos[range.batchIndex].writeDataDrivenBlock(allValues, range.localFeatureIndex, header);
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
        // Layer changed — constant uniform values may have new paint property values.
        this.cachedConstantUniforms = null;
        if (!this.cachedHeader) return;
        // Skip per-feature re-evaluation when no data-driven properties: constant properties
        // are read from this.layer at draw time via getConstantUniformValues(), which was
        // already invalidated above.
        if (this.cachedHeader.dataDrivenMask === 0) return;
        const header = this.cachedHeader;

        for (const range of this.allFeatures) {
            if (!vtLayer) continue;
            const vtFeature = vtLayer.feature(range.vtFeatureIndex);
            if (!vtFeature) continue;

            const featureState = range.featureId !== undefined && range.featureId !== null ?
                (featureStates[range.featureId] || {}) :
                {};

            const feature: Feature = {
                type: vtFeature.type,
                id: range.featureId,
                properties: vtFeature.properties || {},
                geometry: []
            };

            const activeAppearance = this.activeAppearanceByVtIndex ? this.activeAppearanceByVtIndex.get(range.vtFeatureIndex) : undefined;
            const allValues = this.evaluateAllProperties(feature, featureState, canonical, availableImages, brightness, undefined, activeAppearance);
            if (!this.ubos[range.batchIndex]) continue;
            this.ubos[range.batchIndex].writeDataDrivenBlock(allValues, range.localFeatureIndex, header);
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
        if (!this.cachedHeader) return false;
        const header = this.cachedHeader;
        if (header.dataDrivenMask === 0) return false; // All constant — nothing per-feature to write

        let wrote = false;
        for (const range of this.allFeatures) {
            if (range.vtFeatureIndex !== vtFeatureIndex) continue;
            const allValues = this.evaluateAllProperties(feature, featureState, canonical, availableImages, brightness, undefined, activeAppearance);
            if (!this.ubos[range.batchIndex]) continue;
            this.ubos[range.batchIndex].writeDataDrivenBlock(allValues, range.localFeatureIndex, header);
            wrote = true;
        }
        return wrote;
    }

    /**
     * Return values for the u_spp_* constant-property uniforms.
     *
     * Called once per draw call in draw_symbol.ts. Evaluates at the current render zoom
     * so that camera (zoom-only) expressions are up-to-date every frame.
     *
     * Result is cached: constant layers (cameraMask==0) cache indefinitely until the layer
     * changes; camera layers re-evaluate only when renderZoom or brightness changes.
     */
    getConstantUniformValues(renderZoom: number, brightness?: number | null): ConstantUniformValues {
        const header = this.cachedHeader;
        const hasCameraExpr = !!(header && header.cameraMask);

        // Cache hit: for layers with no camera expressions zoom is irrelevant, so any zoom
        // matches. For camera layers, both zoom and brightness must match.
        // Truthy check (not !== null) because the field may be undefined after worker→main
        // transfer (constructor is not called during deserialization, omitted fields stay undefined).
        if (this.cachedConstantUniforms &&
                this.cachedConstantBrightness === brightness &&
                (!hasCameraExpr || this.cachedConstantRenderZoom === renderZoom)) {
            return this.cachedConstantUniforms;
        }

        const paint = this.layer.paint;
        const propDefs = this.propDefs;
        const renderParams = hasCameraExpr ?
            new EvaluationParameters(renderZoom, {brightness, worldview: this.worldview}) :
            null;
        const emptyFeature: Feature = {type: 1, id: undefined, properties: {}, geometry: []};

        const getColor = (propIdx: number): [number, number, number, number] => {
            const def = propDefs[propIdx];
            const prop = paint.get(def.name as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<Color> | undefined;
            if (!prop) return [0, 0, 0, 1];

            const useThemeProp = def.useThemeName ? (paint.get(def.useThemeName as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<string> | undefined) : undefined;
            const useThemeValue = useThemeProp && typeof useThemeProp !== 'string' ? useThemeProp.value : undefined;
            const ignoreLut = shouldIgnoreLut(useThemeValue, emptyFeature, {}, [], undefined, brightness, undefined, this.worldview);
            const effectiveLut = ignoreLut ? null : this.lut;

            // Camera expressions need re-evaluation at render zoom; constants use the
            // already-evaluated value from the style layer (no EvaluationParameters needed).
            const isCamera = !!(header && (header.cameraMask & (1 << propIdx)));
            let color: Color;
            if (isCamera && renderParams) {
                color = prop.property.evaluate(prop.value, renderParams, emptyFeature, {}, undefined, []);
            } else {
                color = prop.constantOr(Color.transparent);
            }
            const np = (color || Color.transparent).toNonPremultipliedRenderColor(effectiveLut);
            return [np.r, np.g, np.b, np.a];
        };

        const getFloat = (propIdx: number, defaultVal: number): number => {
            const def = propDefs[propIdx];
            const prop = paint.get(def.name as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<number> | undefined;
            if (!prop) return defaultVal;
            const isCamera = !!(header && (header.cameraMask & (1 << propIdx)));
            if (isCamera && renderParams) {
                const evaluated = prop.property.evaluate(prop.value, renderParams, emptyFeature, {}, undefined, []);
                return evaluated !== null && evaluated !== undefined ? evaluated : defaultVal;
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
        return result;
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
        this.featureVertexRangesFromId.clear();
        this.allFeatures = [];
        this.featureCount = 0;
        this.cachedHeader = null;
        this.maxFeaturesPerBatch = 0;
        if (this.propertyHashToUBOIndex) {
            this.propertyHashToUBOIndex.clear();
        }
    }
}

// 'layer' is omitted because SymbolStyleLayer is not serializable. It must be re-assigned on
// the main thread before any main-thread method (getConstantUniformValues, bind, etc.) is called.
// See draw_symbol.ts: `buffers.uboBinder.layer = layer` before drawSymbolElements().
register(SymbolPropertyBinderUBO, 'SymbolPropertyBinderUBO', {omit: ['layer', 'cachedParams', 'cachedParamsNext', 'cachedBrightness', 'propertyHashToUBOIndex', 'cachedConstantUniforms', 'cachedConstantRenderZoom', 'cachedConstantBrightness', 'activeAppearanceByVtIndex', '_evalFlat']});
