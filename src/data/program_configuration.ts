import {packUint8ToFloat} from '../shaders/encode_attribute';
import Color from '../style-spec/util/color';
import {supportsPropertyExpression} from '../style-spec/util/properties';
import {register} from '../util/web_worker_transfer';
import {PossiblyEvaluatedPropertyValue} from '../style/properties';
import {StructArrayLayout1f4, StructArrayLayout2f8, StructArrayLayout4f16, PatternLayoutArray, DashLayoutArray} from './array_types';
import {clamp} from '../util/util';
import patternAttributes from './bucket/pattern_attributes';
import dashAttributes from './bucket/dash_attributes';
import EvaluationParameters from '../style/evaluation_parameters';
import FeaturePositionMap from './feature_position_map';
import {
    Uniform1f,
    UniformColor,
    Uniform4f
} from '../render/uniform_binding';
import assert from 'assert';

import type {Class} from '../../src/types/class';
import type {CanonicalTileID} from '../source/tile_id';
import type Context from '../gl/context';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type {StructArray, StructArrayMember} from '../util/struct_array';
import type VertexBuffer from '../gl/vertex_buffer';
import type {SpritePosition, SpritePositions} from '../util/image';
import type {
    Feature,
    FeatureState,
    GlobalProperties,
    SourceExpression,
    CompositeExpression
} from '../style-spec/expression/index';
import type {PossiblyEvaluated, PossiblyEvaluatedValue} from '../style/properties';
import type {FeatureStates} from '../source/source_state';
import type {FormattedSection} from '../style-spec/expression/types/formatted';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {IUniform} from '../render/uniform_binding';
import type {LUT} from "../util/lut";
import type {RenderColor} from "../style-spec/util/color";
import type {ImageId} from '../style-spec/expression/types/image_id';

export type BinderUniform = {
    name: string;
    property: string;
    binding: IUniform<any>;
};

export type ProgramConfigurationContext = {
    zoom: number;
    lut: LUT | null;
};

function packColor(color: RenderColor): [number, number] {
    return [
        packUint8ToFloat(255 * color.r, 255 * color.g),
        packUint8ToFloat(255 * color.b, 255 * color.a)
    ];
}

/**
 *  `Binder` is the interface definition for the strategies for constructing,
 *  uploading, and binding paint property data as GLSL attributes. Most style-
 *  spec properties have a 1:1 relationship to shader attribute/uniforms, but
 *  some require multiple values per feature to be passed to the GPU, and in
 *  those cases we bind multiple attributes/uniforms.
 *
 *  It has three implementations, one for each of the three strategies we use:
 *
 *  * For _constant_ properties -- those whose value is a constant, or the constant
 *    result of evaluating a camera expression at a particular camera position -- we
 *    don't need a vertex attribute buffer, and instead use a uniform.
 *  * For data expressions, we use a vertex buffer with a single attribute value,
 *    the evaluated result of the source function for the given feature.
 *  * For composite expressions, we use a vertex buffer with two attributes: min and
 *    max values covering the range of zooms at which we expect the tile to be
 *    displayed. These values are calculated by evaluating the composite expression for
 *    the given feature at strategically chosen zoom levels. In addition to this
 *    attribute data, we also use a uniform value which the shader uses to interpolate
 *    between the min and max value at the final displayed zoom level. The use of a
 *    uniform allows us to cheaply update the value on every frame.
 *
 *  Note that the shader source varies depending on whether we're using a uniform or
 *  attribute. We dynamically compile shaders at runtime to accommodate this.
 *
 * @private
 */

interface AttributeBinder {
    context: ProgramConfigurationContext;
    checkUseTheme: boolean;
    ignoreLut: boolean;
    lutExpression: PossiblyEvaluatedValue<string>;

    populatePaintArray: (
        length: number,
        feature: Feature,
        imagePositions: SpritePositions,
        availableImages: ImageId[],
        canonical?: CanonicalTileID,
        brightness?: number | null,
        formattedSection?: FormattedSection,
    ) => void;
    updatePaintArray: (
        start: number,
        length: number,
        feature: Feature,
        featureState: FeatureState,
        availableImages: ImageId[],
        imagePositions: SpritePositions,
        brightness: number,
    ) => void;
    upload: (arg1: Context) => void;
    destroy: () => void;
}

interface UniformBinder {
    uniformNames: Array<string>;
    context: ProgramConfigurationContext;
    checkUseTheme: boolean;
    ignoreLut: boolean;
    lutExpression: PossiblyEvaluatedValue<string>;

    setUniform: (
        program: WebGLProgram,
        uniform: IUniform<any>,
        globals: GlobalProperties,
        currentValue: PossiblyEvaluatedPropertyValue<any>,
        uniformName: string,
    ) => void;
    getBinding: (context: Context, name: string) => Partial<IUniform<any>>;
}
class ConstantBinder implements UniformBinder {
    value: unknown;
    type: string;
    uniformNames: Array<string>;
    context: ProgramConfigurationContext;
    checkUseTheme: boolean;
    ignoreLut: boolean;
    lutExpression: PossiblyEvaluatedValue<string>;

    constructor(value: unknown, names: Array<string>, type: string, context: ProgramConfigurationContext) {
        this.value = value;
        this.uniformNames = names.map(name => `u_${name}`);
        this.type = type;
        this.context = context;
    }

    setUniform(
        program: WebGLProgram,
        uniform: IUniform<any>,
        globals: GlobalProperties,
        currentValue: PossiblyEvaluatedPropertyValue<unknown>,
        uniformName: string,
    ): void {
        const value = currentValue.constantOr(this.value);
        if (value instanceof Color) {
            uniform.set(program, uniformName, value.toRenderColor(this.ignoreLut ? null : this.context.lut));
        } else {
            uniform.set(program, uniformName, value);
        }
    }

    getBinding(context: Context, _: string): Partial<IUniform<any>> {
        return (this.type === 'color') ?
            new UniformColor(context) :
            new Uniform1f(context);
    }
}

class PatternConstantBinder implements UniformBinder {
    uniformNames: Array<string>;
    pattern: Array<number> | null | undefined;
    pixelRatio: number;
    context: ProgramConfigurationContext;
    checkUseTheme: boolean;
    ignoreLut: boolean;
    lutExpression: PossiblyEvaluatedValue<string>;

    constructor(value: unknown, names: Array<string>) {
        this.uniformNames = names.map(name => `u_${name}`);
        this.pattern = null;
        this.pixelRatio = 1;
    }

    setConstantPatternPositions(posTo: SpritePosition) {
        this.pixelRatio = posTo.pixelRatio || 1;
        this.pattern = posTo.tl.concat(posTo.br);
    }

    setUniform(program: WebGLProgram, uniform: IUniform<any>, globals: GlobalProperties, currentValue: PossiblyEvaluatedPropertyValue<unknown>, uniformName: string) {
        const pos =
            uniformName === 'u_pattern' || uniformName === 'u_dash' ? this.pattern :
            uniformName === 'u_pixel_ratio' ? this.pixelRatio : null;
        if (pos) uniform.set(program, uniformName, pos);
    }

    getBinding(context: Context, name: string): Partial<IUniform<any>> {
        return name === 'u_pattern' || name === 'u_dash' ?
            new Uniform4f(context) :
            new Uniform1f(context);
    }
}

class SourceExpressionBinder implements AttributeBinder {
    expression: PossiblyEvaluatedValue<any> | SourceExpression;
    type: string;
    maxValue: number;
    context: ProgramConfigurationContext;
    checkUseTheme: boolean;
    ignoreLut: boolean;
    lutExpression: PossiblyEvaluatedValue<string>;

    paintVertexArray: StructArray;
    paintVertexAttributes: Array<StructArrayMember>;
    paintVertexBuffer: VertexBuffer | null | undefined;

    constructor(expression: PossiblyEvaluatedValue<any>, names: Array<string>, type: string, PaintVertexArray: Class<StructArray>) {
        this.expression = expression;
        this.type = type;
        this.maxValue = 0;
        this.paintVertexAttributes = names.map((name) => ({
            name: `a_${name}`,
            type: 'Float32',
            components: type === 'color' ? 2 : 1,
            offset: 0
        }));
        this.paintVertexArray = new PaintVertexArray();
    }

    populatePaintArray(newLength: number, feature: Feature, imagePositions: SpritePositions, availableImages: ImageId[], canonical?: CanonicalTileID, brightness?: number | null, formattedSection?: FormattedSection) {
        const start = this.paintVertexArray.length;
        assert(Array.isArray(availableImages));

        const value = (this.expression.kind === 'composite' || this.expression.kind === 'source') ? this.expression.evaluate(new EvaluationParameters(0, {brightness}), feature, {}, canonical, availableImages, formattedSection) : this.expression.kind === 'constant' && this.expression.value;
        if (this.lutExpression && (this.lutExpression.kind === 'composite' || this.lutExpression.kind === 'source')) this.ignoreLut = this.lutExpression.evaluate(new EvaluationParameters(0, {brightness}), feature, {}, canonical, availableImages, formattedSection) === 'none';

        this.paintVertexArray.resize(newLength);
        this._setPaintValue(start, newLength, value, this.context);
    }

    updatePaintArray(start: number, end: number, feature: Feature, featureState: FeatureState, availableImages: ImageId[], spritePositions: SpritePositions, brightness: number) {
        const value = (this.expression.kind === 'composite' || this.expression.kind === 'source') ? this.expression.evaluate({zoom: 0, brightness}, feature, featureState, undefined, availableImages) : this.expression.kind === 'constant' && this.expression.value;
        if (this.lutExpression && (this.lutExpression.kind === 'composite' || this.lutExpression.kind === 'source'))  this.ignoreLut = this.lutExpression.evaluate({zoom: 0, brightness}, feature, featureState, undefined, availableImages) === 'none';

        this._setPaintValue(start, end, value, this.context);
    }

    _setPaintValue(start: number, end: number, value: any, context: ProgramConfigurationContext) {
        if (this.type === 'color') {
            const color = packColor(value.toRenderColor(this.ignoreLut ? null : context.lut));
            for (let i = start; i < end; i++) {
                this.paintVertexArray.emplace(i, color[0], color[1]);
            }
        } else {
            for (let i = start; i < end; i++) {
                this.paintVertexArray.emplace(i, value);
            }
            this.maxValue = Math.max(this.maxValue, Math.abs(value));
        }
    }

    upload(context: Context) {
        if (this.paintVertexArray && this.paintVertexArray.arrayBuffer) {
            if (this.paintVertexBuffer && this.paintVertexBuffer.buffer) {
                this.paintVertexBuffer.updateData(this.paintVertexArray);
            } else {
                const dynamicDraw = (this.lutExpression && this.lutExpression.kind !== 'constant' && (this.lutExpression.isStateDependent || !this.lutExpression.isLightConstant)) ||
                                    (this.expression.kind !== 'constant' && (this.expression.isStateDependent || !this.expression.isLightConstant));

                this.paintVertexBuffer = context.createVertexBuffer(this.paintVertexArray, this.paintVertexAttributes, dynamicDraw);
            }
        }
    }

    destroy() {
        if (this.paintVertexBuffer) {
            this.paintVertexBuffer.destroy();
        }
    }
}

class CompositeExpressionBinder implements AttributeBinder, UniformBinder {
    expression: CompositeExpression;
    uniformNames: Array<string>;
    type: string;
    useIntegerZoom: boolean;
    context: ProgramConfigurationContext;
    maxValue: number;
    checkUseTheme: boolean;
    ignoreLut: boolean;
    lutExpression: PossiblyEvaluatedValue<string>;

    paintVertexArray: StructArray;
    paintVertexAttributes: Array<StructArrayMember>;
    paintVertexBuffer: VertexBuffer | null | undefined;

    constructor(expression: CompositeExpression, names: Array<string>, type: string, useIntegerZoom: boolean, context: ProgramConfigurationContext, PaintVertexArray: Class<StructArray>) {
        this.expression = expression;
        this.uniformNames = names.map(name => `u_${name}_t`);
        this.type = type;
        this.useIntegerZoom = useIntegerZoom;
        this.context = context;
        this.maxValue = 0;
        this.paintVertexAttributes = names.map((name) => ({
            name: `a_${name}`,
            type: 'Float32',
            components: type === 'color' ? 4 : 2,
            offset: 0
        }));
        this.paintVertexArray = new PaintVertexArray();
    }

    populatePaintArray(newLength: number, feature: Feature, imagePositions: SpritePositions, availableImages: ImageId[], canonical?: CanonicalTileID, brightness?: number | null, formattedSection?: FormattedSection) {
        const min = this.expression.evaluate(new EvaluationParameters(this.context.zoom, {brightness}), feature, {}, canonical, availableImages, formattedSection);
        const max = this.expression.evaluate(new EvaluationParameters(this.context.zoom + 1, {brightness}), feature, {}, canonical, availableImages, formattedSection);
        if (this.lutExpression && (this.lutExpression.kind === 'composite' || this.lutExpression.kind === 'source'))
            this.ignoreLut = this.lutExpression.evaluate(new EvaluationParameters(this.context.zoom, {brightness}), feature, {}, canonical, availableImages, formattedSection)  === 'none';

        const start = this.paintVertexArray.length;
        this.paintVertexArray.resize(newLength);
        this._setPaintValue(start, newLength, min, max, this.context);
    }

    updatePaintArray(start: number, end: number, feature: Feature, featureState: FeatureState, availableImages: ImageId[], spritePositions: SpritePositions, brightness: number) {
        const min = this.expression.evaluate({zoom: this.context.zoom, brightness}, feature, featureState, undefined, availableImages);
        const max = this.expression.evaluate({zoom: this.context.zoom + 1, brightness}, feature, featureState, undefined, availableImages);
        if (this.lutExpression && (this.lutExpression.kind === 'composite' || this.lutExpression.kind === 'source'))
            this.ignoreLut = this.lutExpression.evaluate({zoom: this.context.zoom, brightness}, feature, featureState, undefined, availableImages)  === 'none';

        this._setPaintValue(start, end, min, max, this.context);
    }

    _setPaintValue(start: number, end: number, min: any, max: any, context: ProgramConfigurationContext) {
        if (this.type === 'color') {
            const minColor = packColor(min.toRenderColor(this.ignoreLut ? null : context.lut));
            const maxColor = packColor(min.toRenderColor(this.ignoreLut ? null : context.lut));
            for (let i = start; i < end; i++) {
                this.paintVertexArray.emplace(i, minColor[0], minColor[1], maxColor[0], maxColor[1]);
            }
        } else {
            for (let i = start; i < end; i++) {
                this.paintVertexArray.emplace(i, min, max);
            }
            this.maxValue = Math.max(this.maxValue, Math.abs(min), Math.abs(max));
        }
    }

    upload(context: Context) {
        if (this.paintVertexArray && this.paintVertexArray.arrayBuffer) {
            if (this.paintVertexBuffer && this.paintVertexBuffer.buffer) {
                this.paintVertexBuffer.updateData(this.paintVertexArray);
            } else {
                this.paintVertexBuffer = context.createVertexBuffer(this.paintVertexArray, this.paintVertexAttributes, this.expression.isStateDependent || !this.expression.isLightConstant);
            }
        }
    }

    destroy() {
        if (this.paintVertexBuffer) {
            this.paintVertexBuffer.destroy();
        }
    }

    setUniform(
        program: WebGLProgram,
        uniform: IUniform<any>,
        globals: GlobalProperties,
        _: PossiblyEvaluatedPropertyValue<any>,
        uniformName: string,
    ): void {
        const currentZoom = this.useIntegerZoom ? Math.floor(globals.zoom) : globals.zoom;
        const factor = clamp(this.expression.interpolationFactor(currentZoom, this.context.zoom, this.context.zoom + 1), 0, 1);
        uniform.set(program, uniformName, factor);
    }

    getBinding(context: Context, _: string): Uniform1f {
        return new Uniform1f(context);
    }
}

class PatternCompositeBinder implements AttributeBinder {
    expression: CompositeExpression;
    layerId: string;
    context: ProgramConfigurationContext;
    checkUseTheme: boolean;
    ignoreLut: boolean;
    lutExpression: PossiblyEvaluatedValue<string>;

    paintVertexArray: StructArray;
    paintVertexBuffer: VertexBuffer | null | undefined;
    paintVertexAttributes: Array<StructArrayMember>;

    constructor(expression: CompositeExpression, names: Array<string>, type: string, PaintVertexArray: Class<StructArray>, layerId: string) {
        this.expression = expression;
        this.layerId = layerId;

        this.paintVertexAttributes = (type === 'array' ? dashAttributes : patternAttributes).members;
        for (let i = 0; i < names.length; ++i) {
            assert(`a_${names[i]}` === this.paintVertexAttributes[i].name);
        }

        this.paintVertexArray = new PaintVertexArray();
    }

    populatePaintArray(length: number, feature: Feature, imagePositions: SpritePositions, _availableImages: ImageId[]) {
        const start = this.paintVertexArray.length;
        this.paintVertexArray.resize(length);
        this._setPaintValues(start, length, feature.patterns && feature.patterns[this.layerId], imagePositions);
    }

    updatePaintArray(start: number, end: number, feature: Feature, featureState: FeatureState, availableImages: ImageId[], imagePositions: SpritePositions, _?: number | null) {
        this._setPaintValues(start, end, feature.patterns && feature.patterns[this.layerId], imagePositions);
    }

    _setPaintValues(start: number, end: number, patterns: string | null | undefined, positions: SpritePositions) {
        if (!positions || !patterns) return;

        const pos = positions[patterns];
        if (!pos) return;

        const {tl, br, pixelRatio} = pos;
        for (let i = start; i < end; i++) {
            this.paintVertexArray.emplace(i, tl[0], tl[1], br[0], br[1], (pixelRatio));
        }
    }

    upload(context: Context) {
        if (this.paintVertexArray && this.paintVertexArray.arrayBuffer) {
            this.paintVertexBuffer = context.createVertexBuffer(this.paintVertexArray, this.paintVertexAttributes, this.expression.isStateDependent || !this.expression.isLightConstant);
        }
    }

    destroy() {
        if (this.paintVertexBuffer) this.paintVertexBuffer.destroy();
    }
}

/**
 * ProgramConfiguration contains the logic for binding style layer properties and tile
 * layer feature data into GL program uniforms and vertex attributes.
 *
 * Non-data-driven property values are bound to shader uniforms. Data-driven property
 * values are bound to vertex attributes. In order to support a uniform GLSL syntax over
 * both, [Mapbox GL Shaders](https://github.com/mapbox/mapbox-gl-shaders) defines a `#pragma`
 * abstraction, which ProgramConfiguration is responsible for implementing. At runtime,
 * it examines the attributes of a particular layer, combines this with fixed knowledge
 * about how layers of the particular type are implemented, and determines which uniforms
 * and vertex attributes will be required. It can then substitute the appropriate text
 * into the shader source code, create and link a program, and bind the uniforms and
 * vertex attributes in preparation for drawing.
 *
 * When a vector tile is parsed, this same configuration information is used to
 * populate the attribute buffers needed for data-driven styling using the zoom
 * level and feature property data.
 *
 * @private
 */
export default class ProgramConfiguration {
    binders: {
        [_: string]: AttributeBinder | UniformBinder;
    };
    cacheKey: string;
    context: ProgramConfigurationContext;

    _buffers: Array<VertexBuffer>;

    constructor(layer: TypedStyleLayer, context: ProgramConfigurationContext, filterProperties: (_: string) => boolean = () => true) {
        this.binders = {};
        this._buffers = [];
        this.context = context;

        const keys = [];
        for (const property in layer.paint._values) {
            // @ts-expect-error - TS2349 - This expression is not callable.
            const value = layer.paint.get(property);

            // @ts-expect-error - TS2345: Argument of type 'string' is not assignable to parameter of type '"text-color" | "fill-pattern" | "fill-antialias" | "fill-translate" | "fill-extrusion-pattern" | "fill-extrusion-translate" | "fill-extrusion-height" | "line-pattern" | ... 265 more ... | "sky-opacity-transition"'.
            const valueUseTheme = layer.paint.get(`${property}-use-theme`);
            if (property.endsWith('-use-theme')) continue;
            if (!filterProperties(property)) continue;
            if (!(value instanceof PossiblyEvaluatedPropertyValue) || !supportsPropertyExpression(value.property.specification)) {
                continue;
            }
            const names = paintAttributeNames(property, layer.type);
            const expression = value.value;
            const type = value.property.specification.type;
            const useIntegerZoom = !!value.property.useIntegerZoom;
            const isPattern = property === 'line-dasharray' || property.endsWith('pattern');
            const sourceException = (property === 'line-dasharray' && (layer.layout as any).get('line-cap').value.kind !== 'constant') ||
            (valueUseTheme && valueUseTheme.value.kind !== 'constant');

            if (expression.kind === 'constant' && !sourceException) {
                this.binders[property] = isPattern ?
                    new PatternConstantBinder(expression.value, names) :
                    new ConstantBinder(expression.value, names, type, context);
                keys.push(`/u_${property}`);

            } else if (expression.kind === 'source' || sourceException || isPattern) {
                const StructArrayLayout = layoutType(property, type, 'source');
                this.binders[property] = isPattern ?
                // @ts-expect-error - TS2345 - Argument of type 'PossiblyEvaluatedValue<any>' is not assignable to parameter of type 'CompositeExpression'.
                    new PatternCompositeBinder(expression, names, type, StructArrayLayout, layer.id) :
                    new SourceExpressionBinder(expression, names, type, StructArrayLayout);

                keys.push(`/a_${property}`);

            } else {
                const StructArrayLayout = layoutType(property, type, 'composite');
                // @ts-expect-error - TS2345 - Argument of type 'CompositeExpression | { kind: "constant"; value: any; }' is not assignable to parameter of type 'CompositeExpression'.
                this.binders[property] = new CompositeExpressionBinder(expression, names, type, useIntegerZoom, context, StructArrayLayout);
                keys.push(`/z_${property}`);
            }
            if (valueUseTheme) {
                this.binders[property].ignoreLut = valueUseTheme.constantOr('default') === 'none';//will be evaluated again
                const expressionLUT = valueUseTheme.value;
                this.binders[property].lutExpression = expressionLUT;
                this.binders[property].checkUseTheme = true;
            }
        }

        this.cacheKey = keys.sort().join('');
    }

    getMaxValue(property: string): number {
        const binder = this.binders[property];
        return binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder ? binder.maxValue : 0;
    }

    populatePaintArrays(newLength: number, feature: Feature, imagePositions: SpritePositions, availableImages: ImageId[], canonical?: CanonicalTileID, brightness?: number | null, formattedSection?: FormattedSection) {
        for (const property in this.binders) {
            const binder = this.binders[property];
            binder.context = this.context;
            if (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder || binder instanceof PatternCompositeBinder)
                (binder as AttributeBinder).populatePaintArray(newLength, feature, imagePositions, availableImages, canonical, brightness, formattedSection);
            else if (binder.lutExpression) {
                if (binder instanceof ConstantBinder && binder.lutExpression && (binder.lutExpression.kind === 'composite' || binder.lutExpression.kind === 'source')) binder.ignoreLut = binder.lutExpression.evaluate(new EvaluationParameters(0, {brightness}), feature, {}, canonical, availableImages, formattedSection) === 'none';
            }
        }
    }
    setConstantPatternPositions(posTo: SpritePosition) {
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof PatternConstantBinder)
                binder.setConstantPatternPositions(posTo);
        }
    }

    updatePaintArrays(
        featureStates: FeatureStates,
        featureMap: FeaturePositionMap,
        featureMapWithoutIds: FeaturePositionMap,
        vtLayer: VectorTileLayer,
        layer: TypedStyleLayer,
        availableImages: ImageId[],
        imagePositions: SpritePositions,
        isBrightnessChanged: boolean,
        brightness: number,
    ): boolean {
        let dirty: boolean = false;
        const keys = Object.keys(featureStates);
        const featureStateUpdate = (keys.length !== 0) && !isBrightnessChanged;
        const ids = featureStateUpdate ? keys : featureMap.uniqueIds;
        this.context.lut = layer.lut;
        for (const property in this.binders) {
            const binder = this.binders[property];
            binder.context = this.context;
            const isExpressionNotConst = (binder as any).expression && (binder as any).expression.kind && (binder as any).expression.kind !== 'constant';
            if ((binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder ||
                 binder instanceof PatternCompositeBinder) && isExpressionNotConst && ((binder as any).expression.isStateDependent === true || (binder as any).expression.isLightConstant === false)) {
                //AHM: Remove after https://github.com/mapbox/mapbox-gl-js/issues/6255
                // @ts-expect-error - TS2349 - This expression is not callable.
                const value = layer.paint.get(property);

                (binder as any).expression = value.value;
                for (const id of ids) {
                    const state = featureStates[id.toString()];
                    featureMap.eachPosition(id, (index, start, end) => {
                        const feature = vtLayer.feature(index);
                        (binder as AttributeBinder).updatePaintArray(start, end, feature, state, availableImages, imagePositions, brightness);
                    });
                }
                if (!featureStateUpdate) {
                    for (const id of featureMapWithoutIds.uniqueIds) {
                        const state = featureStates[id.toString()];
                        featureMapWithoutIds.eachPosition(id, (index, start, end) => {
                            const feature = vtLayer.feature(index);
                            (binder as AttributeBinder).updatePaintArray(start, end, feature, state, availableImages, imagePositions, brightness);
                        });
                    }
                }
                dirty = true;
            }
        }
        return dirty;
    }

    defines(): Array<string> {
        const result = [];
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof ConstantBinder || binder instanceof PatternConstantBinder) {
                result.push(...binder.uniformNames.map(name => `#define HAS_UNIFORM_${name}`));
            }
        }
        return result;
    }

    getBinderAttributes(): Array<string> {
        const result = [];
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder || binder instanceof PatternCompositeBinder) {
                for (let i = 0; i < binder.paintVertexAttributes.length; i++) {
                    result.push(binder.paintVertexAttributes[i].name);
                }
            }
        }
        return result;
    }

    getBinderUniforms(): Array<string> {
        const uniforms = [];
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof ConstantBinder || binder instanceof PatternConstantBinder || binder instanceof CompositeExpressionBinder) {
                for (const uniformName of binder.uniformNames) {
                    uniforms.push(uniformName);
                }
            }
        }
        return uniforms;
    }

    getPaintVertexBuffers(): Array<VertexBuffer> {
        return this._buffers;
    }

    getUniforms(context: Context): Array<BinderUniform> {
        const uniforms = [];
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof ConstantBinder || binder instanceof PatternConstantBinder || binder instanceof CompositeExpressionBinder) {
                for (const name of binder.uniformNames) {
                    uniforms.push({name, property, binding: binder.getBinding(context, name)});
                }
            }
        }
        return uniforms;
    }

    setUniforms<Properties extends any>(
        program: WebGLProgram,
        context: Context,
        binderUniforms: Array<BinderUniform>,
        properties: PossiblyEvaluated<Properties>,
        globals: GlobalProperties,
    ) {
        // Uniform state bindings are owned by the Program, but we set them
        // from within the ProgramConfiguration's binder members.
        for (const {name, property, binding} of binderUniforms) {

            if (this.binders[property].checkUseTheme && this.binders[property] instanceof ConstantBinder) {
                const pvalue = (properties.get((`${property}-use-theme`) as keyof Properties) as PossiblyEvaluatedPropertyValue<unknown>);
                if (pvalue.isConstant())
                    this.binders[property].ignoreLut = pvalue.constantOr('default') === 'none';
            }

            (this.binders[property] as any).setUniform(program, binding, globals, properties.get(property as keyof Properties), name);
        }
    }

    updatePaintBuffers() {
        this._buffers = [];

        for (const property in this.binders) {
            const binder = this.binders[property];
            if ((
                binder instanceof SourceExpressionBinder ||
                binder instanceof CompositeExpressionBinder ||
                binder instanceof PatternCompositeBinder) && binder.paintVertexBuffer) {
                this._buffers.push(binder.paintVertexBuffer);
            }
        }
    }

    upload(context: Context) {
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder || binder instanceof PatternCompositeBinder)
                binder.upload(context);
        }
        this.updatePaintBuffers();
    }

    destroy() {
        for (const property in this.binders) {
            const binder = this.binders[property];
            if (binder instanceof SourceExpressionBinder || binder instanceof CompositeExpressionBinder || binder instanceof PatternCompositeBinder)
                binder.destroy();
        }
    }
}

export class ProgramConfigurationSet<Layer extends TypedStyleLayer> {
    programConfigurations: {
        [_: string]: ProgramConfiguration;
    };
    needsUpload: boolean;
    _featureMap: FeaturePositionMap;
    _featureMapWithoutIds: FeaturePositionMap;
    _bufferOffset: number;
    _idlessCounter: number;

    constructor(layers: ReadonlyArray<Layer>, context: ProgramConfigurationContext, filterProperties: (_: string) => boolean = () => true) {
        this.programConfigurations = {};
        for (const layer of layers) {
            this.programConfigurations[layer.id] = new ProgramConfiguration(layer, context, filterProperties);
        }
        this.needsUpload = false;
        this._featureMap = new FeaturePositionMap();
        this._featureMapWithoutIds = new FeaturePositionMap();
        this._bufferOffset = 0;
        this._idlessCounter = 0;
    }

    populatePaintArrays(length: number, feature: Feature, index: number, imagePositions: SpritePositions, availableImages: ImageId[], canonical: CanonicalTileID, brightness?: number | null, formattedSection?: FormattedSection) {
        for (const key in this.programConfigurations) {
            this.programConfigurations[key].populatePaintArrays(length, feature, imagePositions, availableImages, canonical, brightness, formattedSection);
        }

        if (feature.id !== undefined) {
            this._featureMap.add(feature.id, index, this._bufferOffset, length);
        } else {
            this._featureMapWithoutIds.add(this._idlessCounter, index, this._bufferOffset, length);
            this._idlessCounter += 1;
        }
        this._bufferOffset = length;

        this.needsUpload = true;
    }

    updatePaintArrays(featureStates: FeatureStates, vtLayer: VectorTileLayer, layers: ReadonlyArray<TypedStyleLayer>, availableImages: ImageId[], imagePositions: SpritePositions, isBrightnessChanged: boolean, brightness?: number | null) {
        for (const layer of layers) {
            this.needsUpload = this.programConfigurations[layer.id].updatePaintArrays(featureStates, this._featureMap, this._featureMapWithoutIds, vtLayer, layer, availableImages, imagePositions, isBrightnessChanged, brightness || 0) || this.needsUpload;
        }
    }

    get(layerId: string): ProgramConfiguration {
        return this.programConfigurations[layerId];
    }

    upload(context: Context) {
        if (!this.needsUpload) return;
        for (const layerId in this.programConfigurations) {
            this.programConfigurations[layerId].upload(context);
        }
        this.needsUpload = false;
    }

    destroy() {
        for (const layerId in this.programConfigurations) {
            this.programConfigurations[layerId].destroy();
        }
    }
}

const attributeNameExceptions = {
    'text-opacity': ['opacity'],
    'icon-opacity': ['opacity'],
    'text-occlusion-opacity': ['occlusion_opacity'],
    'icon-occlusion-opacity': ['occlusion_opacity'],
    'text-color': ['fill_color'],
    'icon-color': ['fill_color'],
    'text-emissive-strength': ['emissive_strength'],
    'icon-emissive-strength': ['emissive_strength'],
    'text-halo-color': ['halo_color'],
    'icon-halo-color': ['halo_color'],
    'text-halo-blur': ['halo_blur'],
    'icon-halo-blur': ['halo_blur'],
    'text-halo-width': ['halo_width'],
    'icon-halo-width': ['halo_width'],
    'symbol-z-offset': ['z_offset'],
    'line-gap-width': ['gapwidth'],
    'line-pattern': ['pattern', 'pixel_ratio'],
    'fill-pattern': ['pattern', 'pixel_ratio'],
    'fill-extrusion-pattern': ['pattern', 'pixel_ratio'],
    'line-dasharray': ['dash']
};

function paintAttributeNames(property: string, type: string) {
    return attributeNameExceptions[property] || [property.replace(`${type}-`, '').replace(/-/g, '_')];
}

const propertyExceptions = {
    'line-pattern': {
        'source': PatternLayoutArray,
        'composite': PatternLayoutArray
    },
    'fill-pattern': {
        'source': PatternLayoutArray,
        'composite': PatternLayoutArray
    },
    'fill-extrusion-pattern':{
        'source': PatternLayoutArray,
        'composite': PatternLayoutArray
    },
    'line-dasharray': { // temporary layout
        'source': DashLayoutArray,
        'composite': DashLayoutArray
    }
};

const defaultLayouts = {
    'color': {
        'source': StructArrayLayout2f8,
        'composite': StructArrayLayout4f16
    },
    'number': {
        'source': StructArrayLayout1f4,
        'composite': StructArrayLayout2f8
    }
};

type LayoutType = 'array' | 'boolean' | 'color' | 'enum' | 'number' | 'resolvedImage' | 'string';

function layoutType(property: string, type: LayoutType, binderType: string): Class<StructArray> {
    const layoutException = propertyExceptions[property];
    return (layoutException && layoutException[binderType]) || defaultLayouts[type][binderType];
}

register(ConstantBinder, 'ConstantBinder');
register(PatternConstantBinder, 'PatternConstantBinder');
register(SourceExpressionBinder, 'SourceExpressionBinder');
register(PatternCompositeBinder, 'PatternCompositeBinder');
register(CompositeExpressionBinder, 'CompositeExpressionBinder');
register(ProgramConfiguration, 'ProgramConfiguration', {omit: ['_buffers']});
register(ProgramConfigurationSet, 'ProgramConfigurationSet');
