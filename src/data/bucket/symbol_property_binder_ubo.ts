import {SymbolPropertiesUBO, type SymbolPropertyHeader, type PropertyValue} from './symbol_properties_ubo';
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

// WebGL2 minimum guaranteed value for MAX_UNIFORM_BUFFER_BINDINGS (OpenGL ES 3.0.6 table 6.33)
const WEBGL2_MIN_UNIFORM_BUFFER_BINDINGS = 24;

/**
 * Pack a non-premultiplied color into 2 floats using packUint8ToFloat.
 * The shader uses decode_color() to reverse this and the fragment shader
 * premultiplies the result.
 */
function packNonPremultColor(r: number, g: number, b: number, a: number): [number, number] {
    return [
        packUint8ToFloat(255 * r, 255 * g),
        packUint8ToFloat(255 * b, 255 * a)
    ];
}

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

    uboSizeDwords: number;

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
    }

    /**
     * Returns an ordered list of property definitions for text or icon.
     * Order determines bit index: 0=fill_color, 1=halo_color, 2=opacity,
     * 3=halo_width, 4=halo_blur, 5=emissive_strength, 6=occlusion_opacity, 7=z_offset.
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
        const offsets: [number, number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0, 0];

        for (let i = 0; i < 8; i++) {
            const {name, isColor} = propDefs[i];
            const prop = paint.get(name as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<unknown> | undefined;

            const isDataDriven = prop ? !prop.isConstant() : false;
            const isZoomDep = !!(prop && prop.value && (prop.value as {kind?: string}).kind === 'composite');

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
            const transVal: any = (this.layer._transitionablePaint._values as any)[name];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const origKind = (transVal && transVal.value && transVal.value.expression && transVal.value.expression.kind) as string | undefined;
            const isCamera = !isDataDriven && origKind === 'camera';

            if (isDataDriven) {
                dataDrivenMask |= (1 << i);
                if (isZoomDep) zoomDependentMask |= (1 << i);

                // Colors must be vec4-aligned within the data-driven block
                if (isColor && dataDrivenOffset % 4 !== 0) {
                    dataDrivenOffset = (dataDrivenOffset + 3) & ~3;
                }
                offsets[i] = dataDrivenOffset;
                dataDrivenOffset += isColor ? 4 : (isZoomDep ? 2 : 1);
            } else {
                if (isCamera) cameraMask |= (1 << i);
                // Constant properties use u_spp_* uniforms — offset is unused, leave at 0.
            }
        }

        // Round up data-driven block size to vec4 boundary, then express in vec4 units.
        const dataDrivenBlockSizeDwords = dataDrivenOffset === 0 ? 0 : (dataDrivenOffset + 3) & ~3;
        const dataDrivenBlockSizeVec4 = dataDrivenBlockSizeDwords / 4;

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
        formattedSection?: FormattedSection
    ): Array<PropertyValue | null> {
        const {params, paramsNext} = this._getCachedParams(brightness);
        const ctx: EvaluationContext = {feature, featureState, canonical, availableImages, params, paramsNext, formattedSection};
        const header = this.cachedHeader;
        const propDefs = this.propDefs;
        const result: Array<PropertyValue | null> = new Array<PropertyValue | null>(8).fill(null);

        for (let i = 0; i < 8; i++) {
            const {name, useThemeName, isColor} = propDefs[i];
            const isZoomDep = !!(header && (header.zoomDependentMask & (1 << i)) !== 0);

            if (isColor) {
                result[i] = this._evaluateColorValue(name, useThemeName, ctx, brightness, isZoomDep);
            } else {
                result[i] = this._evaluateFloatValue(name, isZoomDep, ctx);
            }
        }

        return result;
    }

    /**
     * Evaluate a color property and return it in UBO-ready format (non-premultiplied, packed).
     *   non-zoom → [packed0, packed1, 0, 0]
     *   zoom-dep → [packMin[0], packMin[1], packMax[0], packMax[1]]
     */
    private _evaluateColorValue(
        propName: string,
        useThemeName: string | null,
        ctx: EvaluationContext,
        brightness?: number | null,
        isZoomDep?: boolean
    ): [number, number, number, number] {
        const paint = this.layer.paint;
        const prop = paint.get(propName as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<Color> | undefined;
        const useThemeProp = useThemeName ? (paint.get(useThemeName as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<string> | undefined) : undefined;

        if (!prop) {
            return [0, 0, 0, 1];
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
        const minNP = (colorMin || Color.transparent).toNonPremultipliedRenderColor(effectiveLut);
        const maxNP = (colorMax || Color.transparent).toNonPremultipliedRenderColor(effectiveLut);

        if (isZoomDep) {
            const [p0, p1] = packNonPremultColor(minNP.r, minNP.g, minNP.b, minNP.a);
            const [p2, p3] = packNonPremultColor(maxNP.r, maxNP.g, maxNP.b, maxNP.a);
            return [p0, p1, p2, p3];
        }
        // Non-zoom: pack into 2 floats; the other 2 dwords are padding (shader uses readVec2).
        const [p0, p1] = packNonPremultColor(minNP.r, minNP.g, minNP.b, minNP.a);
        return [p0, p1, 0, 0];
    }

    /**
     * Evaluate a float property and return it in UBO-ready format.
     * For non-zoom: single number. For zoom-dep: [min, max].
     */
    private _evaluateFloatValue(
        propName: string,
        isZoomDep: boolean,
        ctx: EvaluationContext
    ): number | [number, number] {
        const paint = this.layer.paint;
        const prop = paint.get(propName as keyof typeof paint._values) as PossiblyEvaluatedPropertyValue<number> | undefined;
        const defaultVal = propName.endsWith('opacity') ? 1.0 : 0.0;

        if (!prop) return defaultVal;

        if (prop.isConstant()) {
            return prop.constantOr(defaultVal);
        }

        const min = prop.property.evaluate(
            prop.value, ctx.params, ctx.feature, ctx.featureState,
            ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
        );
        const minVal = min !== null && min !== undefined ? min : defaultVal;

        if (isZoomDep) {
            const max = prop.property.evaluate(
                prop.value, ctx.paramsNext, ctx.feature, ctx.featureState,
                ctx.canonical, ctx.availableImages, prop.iconImageUseTheme, ctx.formattedSection
            );
            const maxVal = max !== null && max !== undefined ? max : defaultVal;
            return [minVal, maxVal];
        }
        return minVal;
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
     * Check if all symbol properties are constant (no expressions, no feature-state).
     */
    private _checkIfAllPropertiesAreConstant(layer: SymbolStyleLayer, isText: boolean): boolean {
        const paint = layer.paint;
        const prefix = isText ? 'text' : 'icon';
        const props = [
            `${prefix}-color`, `${prefix}-halo-color`, `${prefix}-opacity`,
            `${prefix}-halo-width`, `${prefix}-halo-blur`, `${prefix}-emissive-strength`,
            `${prefix}-occlusion-opacity`, 'symbol-z-offset',
        ];
        for (const propName of props) {
            const prop = paint.get(propName as keyof typeof paint._values);
            if (prop && typeof prop === 'object' && 'isConstant' in prop && !prop.isConstant()) {
                return false;
            }
        }
        return true;
    }

    /**
     * Hash data-driven property values for deduplication.
     * Returns an empty string when there are no data-driven properties (all constant).
     */
    private _hashDataDrivenValues(values: Array<PropertyValue | null>, header: SymbolPropertyHeader): string {
        if (header.dataDrivenMask === 0) return ''; // All constant — single entry
        const parts: string[] = [];
        for (let i = 0; i < 8; i++) {
            if ((header.dataDrivenMask & (1 << i)) === 0) continue;
            const v = values[i];
            if (v === null || v === undefined) {
                parts.push('null');
            } else if (Array.isArray(v)) {
                parts.push((v as number[]).join(','));
            } else {
                parts.push(String(v));
            }
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
            const propsDwords = this.uboSizeDwords;
            const max = SymbolPropertiesUBO.getMaxFeatureCount(this.cachedHeader, propsDwords);
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

                const allValues = this.evaluateAllProperties(feature, featureState, canonical, availableImages, brightness);
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

            const allValues = this.evaluateAllProperties(feature, featureState, canonical, availableImages, brightness);
            if (!this.ubos[range.batchIndex]) continue;
            this.ubos[range.batchIndex].writeDataDrivenBlock(allValues, range.localFeatureIndex, header);
        }
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
register(SymbolPropertyBinderUBO, 'SymbolPropertyBinderUBO', {omit: ['layer', 'cachedParams', 'cachedParamsNext', 'cachedBrightness', 'propertyHashToUBOIndex', 'cachedConstantUniforms', 'cachedConstantRenderZoom', 'cachedConstantBrightness']});
