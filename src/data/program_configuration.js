// @flow

import type {GlobalProperties} from "../style-spec/expression/index";

const createVertexArrayType = require('./vertex_array_type');
const packUint8ToFloat = require('../shaders/encode_attribute').packUint8ToFloat;
const Color = require('../style-spec/util/color');
const {register} = require('../util/web_worker_transfer');

import type Context from '../gl/context';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type {ViewType, StructArray} from '../util/struct_array';
import type VertexBuffer from '../gl/vertex_buffer';
import type Program from '../render/program';
import type {Feature, SourceExpression, CompositeExpression} from '../style-spec/expression';
import type {PossiblyEvaluated, PossiblyEvaluatedPropertyValue} from '../style/properties';

export type LayoutAttribute = {
    name: string,
    type: ViewType,
    components?: number
}

type PaintAttribute = {
    property: string,
    name?: string,
    useIntegerZoom?: boolean
}

export type ProgramInterface = {
    layoutAttributes: Array<LayoutAttribute>,
    indexArrayType: Class<StructArray>,
    dynamicLayoutAttributes?: Array<LayoutAttribute>,
    opacityAttributes?: Array<LayoutAttribute>,
    collisionAttributes?: Array<LayoutAttribute>,
    paintAttributes?: Array<PaintAttribute>,
    indexArrayType2?: Class<StructArray>
}

function packColor(color: Color): [number, number] {
    return [
        packUint8ToFloat(255 * color.r, 255 * color.g),
        packUint8ToFloat(255 * color.b, 255 * color.a)
    ];
}

/**
 *  `Binder` is the interface definition for the strategies for constructing,
 *  uploading, and binding paint property data as GLSL attributes.
 *
 *  It has three implementations, one for each of the three strategies we use:
 *
 *  * For _constant_ properties -- those whose value is a constant, or the constant
 *    result of evaluating a camera expression at a particular camera position -- we
 *    don't need a vertex buffer, and instead use a uniform.
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
 *  attribute. We dynamically compile shaders at runtime to accomodate this.
 *
 * @private
 */
interface Binder<T> {
    statistics: { max: number };

    populatePaintArray(paintArray: StructArray,
                       start: number,
                       length: number,
                       feature: Feature): void;

    defines(): Array<string>;

    setUniforms(context: Context,
                program: Program,
                globals: GlobalProperties,
                currentValue: PossiblyEvaluatedPropertyValue<T>): void;
}

class ConstantBinder<T> implements Binder<T> {
    value: T;
    name: string;
    type: string;
    statistics: { max: number };

    constructor(value: T, name: string, type: string) {
        this.value = value;
        this.name = name;
        this.type = type;
        this.statistics = { max: -Infinity };
    }

    defines() {
        return [`#define HAS_UNIFORM_u_${this.name}`];
    }

    populatePaintArray() {}

    setUniforms(context: Context,
                program: Program,
                globals: GlobalProperties,
                currentValue: PossiblyEvaluatedPropertyValue<T>) {
        const value: any = currentValue.constantOr(this.value);
        const gl = context.gl;
        if (this.type === 'color') {
            gl.uniform4f(program.uniforms[`u_${this.name}`], value.r, value.g, value.b, value.a);
        } else {
            gl.uniform1f(program.uniforms[`u_${this.name}`], value);
        }
    }
}

class SourceExpressionBinder<T> implements Binder<T> {
    expression: SourceExpression;
    name: string;
    type: string;
    statistics: { max: number };

    constructor(expression: SourceExpression, name: string, type: string) {
        this.expression = expression;
        this.name = name;
        this.type = type;
        this.statistics = { max: -Infinity };
    }

    defines() {
        return [];
    }

    populatePaintArray(paintArray: StructArray,
                       start: number,
                       length: number,
                       feature: Feature) {
        const value = this.expression.evaluate({zoom: 0}, feature);

        if (this.type === 'color') {
            const color = packColor(value);
            for (let i = start; i < length; i++) {
                const struct: any = paintArray.get(i);
                struct[`a_${this.name}0`] = color[0];
                struct[`a_${this.name}1`] = color[1];
            }
        } else {
            for (let i = start; i < length; i++) {
                const struct: any = paintArray.get(i);
                struct[`a_${this.name}`] = value;
            }

            this.statistics.max = Math.max(this.statistics.max, value);
        }
    }

    setUniforms(context: Context, program: Program) {
        context.gl.uniform1f(program.uniforms[`a_${this.name}_t`], 0);
    }
}

class CompositeExpressionBinder<T> implements Binder<T> {
    expression: CompositeExpression;
    name: string;
    type: string;
    useIntegerZoom: boolean;
    zoom: number;
    statistics: { max: number };

    constructor(expression: CompositeExpression, name: string, type: string, useIntegerZoom: boolean, zoom: number) {
        this.expression = expression;
        this.name = name;
        this.type = type;
        this.useIntegerZoom = useIntegerZoom;
        this.zoom = zoom;
        this.statistics = { max: -Infinity };
    }

    defines() {
        return [];
    }

    populatePaintArray(paintArray: StructArray,
                       start: number,
                       length: number,
                       feature: Feature) {
        const min = this.expression.evaluate({zoom: this.zoom    }, feature);
        const max = this.expression.evaluate({zoom: this.zoom + 1}, feature);

        if (this.type === 'color') {
            const minColor = packColor(min);
            const maxColor = packColor(max);
            for (let i = start; i < length; i++) {
                const struct: any = paintArray.get(i);
                struct[`a_${this.name}0`] = minColor[0];
                struct[`a_${this.name}1`] = minColor[1];
                struct[`a_${this.name}2`] = maxColor[0];
                struct[`a_${this.name}3`] = maxColor[1];
            }
        } else {
            for (let i = start; i < length; i++) {
                const struct: any = paintArray.get(i);
                struct[`a_${this.name}0`] = min;
                struct[`a_${this.name}1`] = max;
            }

            this.statistics.max = Math.max(this.statistics.max, min, max);
        }
    }

    interpolationFactor(currentZoom: number) {
        if (this.useIntegerZoom) {
            return this.expression.interpolationFactor(Math.floor(currentZoom), this.zoom, this.zoom + 1);
        } else {
            return this.expression.interpolationFactor(currentZoom, this.zoom, this.zoom + 1);
        }
    }

    setUniforms(context: Context, program: Program, globals: GlobalProperties) {
        context.gl.uniform1f(program.uniforms[`a_${this.name}_t`], this.interpolationFactor(globals.zoom));
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
class ProgramConfiguration {
    binders: { [string]: Binder<any> };
    cacheKey: string;
    layoutAttributes: ?Array<LayoutAttribute>;
    PaintVertexArray: Class<StructArray>;

    paintVertexArray: StructArray;
    paintVertexBuffer: ?VertexBuffer;

    constructor() {
        this.binders = {};
        this.cacheKey = '';
    }

    static createDynamic<Layer: TypedStyleLayer>(programInterface: ProgramInterface, layer: Layer, zoom: number) {
        const self = new ProgramConfiguration();
        const attributes = [];

        for (const attribute of programInterface.paintAttributes || []) {
            const property = attribute.property;
            const name = attribute.name || property.replace(`${layer.type}-`, '').replace(/-/g, '_');
            const value: PossiblyEvaluatedPropertyValue<any> = layer.paint.get(property);
            const type = value.property.specification.type;
            const useIntegerZoom = value.property.useIntegerZoom;

            if (value.value.kind === 'constant') {
                self.binders[property] = new ConstantBinder(value.value, name, type);
                self.cacheKey += `/u_${name}`;
            } else if (value.value.kind === 'source') {
                self.binders[property] = new SourceExpressionBinder(value.value, name, type);
                self.cacheKey += `/a_${name}`;
                attributes.push({
                    name: `a_${name}`,
                    type: 'Float32',
                    components: type === 'color' ? 2 : 1
                });
            } else {
                self.binders[property] = new CompositeExpressionBinder(value.value, name, type, useIntegerZoom, zoom);
                self.cacheKey += `/z_${name}`;
                attributes.push({
                    name: `a_${name}`,
                    type: 'Float32',
                    components: type === 'color' ? 4 : 2
                });
            }
        }

        self.PaintVertexArray = createVertexArrayType(attributes);
        self.layoutAttributes = programInterface.layoutAttributes;

        return self;
    }

    static forBackgroundColor(color: Color, opacity: number) {
        const self = new ProgramConfiguration();

        self.binders['background-color'] = new ConstantBinder(color, 'color', 'color');
        self.cacheKey += `/u_color`;

        self.binders['background-opacity'] = new ConstantBinder(opacity, 'opacity', 'number');
        self.cacheKey += `/u_opacity`;

        return self;
    }

    static forBackgroundPattern(opacity: number) {
        const self = new ProgramConfiguration();

        self.binders['background-opacity'] = new ConstantBinder(opacity, 'opacity', 'number');
        self.cacheKey += `/u_opacity`;

        return self;
    }

    static forTileClippingMask() {
        // The color and opacity values don't matter.
        return ProgramConfiguration.forBackgroundColor(Color.black, 1);
    }

    populatePaintArray(length: number, feature: Feature) {
        const paintArray = this.paintVertexArray;
        if (paintArray.bytesPerElement === 0) return;

        const start = paintArray.length;
        paintArray.resize(length);

        for (const property in this.binders) {
            this.binders[property].populatePaintArray(
                paintArray,
                start, length,
                feature);
        }
    }

    defines(): Array<string> {
        const result = [];
        for (const property in this.binders) {
            result.push.apply(result, this.binders[property].defines());
        }
        return result;
    }

    setUniforms<Properties: Object>(context: Context, program: Program, properties: PossiblyEvaluated<Properties>, globals: GlobalProperties) {
        for (const property in this.binders) {
            const binder = this.binders[property];
            binder.setUniforms(context, program, globals, properties.get(property));
        }
    }

    upload(context: Context) {
        if (this.paintVertexArray) {
            this.paintVertexBuffer = context.createVertexBuffer(this.paintVertexArray);
        }
    }

    destroy() {
        if (this.paintVertexBuffer) {
            this.paintVertexBuffer.destroy();
        }
    }
}

class ProgramConfigurationSet<Layer: TypedStyleLayer> {
    programConfigurations: {[string]: ProgramConfiguration};

    constructor(programInterface: ProgramInterface, layers: $ReadOnlyArray<Layer>, zoom: number) {
        this.programConfigurations = {};
        for (const layer of layers) {
            const programConfiguration = ProgramConfiguration.createDynamic(programInterface, layer, zoom);
            programConfiguration.paintVertexArray = new programConfiguration.PaintVertexArray();
            this.programConfigurations[layer.id] = programConfiguration;
        }
    }

    populatePaintArrays(length: number, feature: Feature) {
        for (const key in this.programConfigurations) {
            this.programConfigurations[key].populatePaintArray(length, feature);
        }
    }

    get(layerId: string) {
        return this.programConfigurations[layerId];
    }

    upload(context: Context) {
        for (const layerId in this.programConfigurations) {
            this.programConfigurations[layerId].upload(context);
        }
    }

    destroy() {
        for (const layerId in this.programConfigurations) {
            this.programConfigurations[layerId].destroy();
        }
    }
}

register('ConstantBinder', ConstantBinder);
register('SourceExpressionBinder', SourceExpressionBinder);
register('CompositeExpressionBinder', CompositeExpressionBinder);
register('ProgramConfiguration', ProgramConfiguration, {omit: ['PaintVertexArray']});
register('ProgramConfigurationSet', ProgramConfigurationSet);

module.exports = {
    ProgramConfiguration,
    ProgramConfigurationSet
};
