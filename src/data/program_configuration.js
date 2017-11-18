// @flow

import type {GlobalProperties} from "../style-spec/expression/index";

const createVertexArrayType = require('./vertex_array_type');
const packUint8ToFloat = require('../shaders/encode_attribute').packUint8ToFloat;
const VertexBuffer = require('../gl/vertex_buffer');

import type StyleLayer from '../style/style_layer';
import type {ViewType, StructArray, SerializedStructArray, StructArrayTypeParameters} from '../util/struct_array';
import type Program from '../render/program';
import type {Feature, SourceExpression, CompositeExpression} from '../style-spec/expression';
import type Color from '../style-spec/util/color';
import type {PossiblyEvaluated, PossiblyEvaluatedPropertyValue} from '../style/properties';

type LayoutAttribute = {
    name: string,
    type: ViewType,
    components?: number
}

type PaintAttribute = {
    property: string,
    name?: string,
    useIntegerZoom?: boolean
}

export type PaintPropertyStatistics = {
    [property: string]: { max: number }
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
    property: string;
    statistics: { max: number };

    populatePaintArray(paintArray: StructArray,
                       start: number,
                       length: number,
                       feature: Feature): void;

    defines(): Array<string>;

    setUniforms(gl: WebGLRenderingContext,
                program: Program,
                globals: GlobalProperties,
                currentValue: PossiblyEvaluatedPropertyValue<T>): void;
}

class ConstantBinder<T> implements Binder<T> {
    value: T;
    name: string;
    type: string;
    property: string;
    statistics: { max: number };

    constructor(value: T, name: string, type: string, property: string) {
        this.value = value;
        this.name = name;
        this.type = type;
        this.property = property;
        this.statistics = { max: -Infinity };
    }

    defines() {
        return [`#define HAS_UNIFORM_u_${this.name}`];
    }

    populatePaintArray() {}

    setUniforms(gl: WebGLRenderingContext,
                program: Program,
                globals: GlobalProperties,
                currentValue: PossiblyEvaluatedPropertyValue<T>) {
        const value: any = currentValue.constantOr(this.value);
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
    property: string;
    statistics: { max: number };

    constructor(expression: SourceExpression, name: string, type: string, property: string) {
        this.expression = expression;
        this.name = name;
        this.type = type;
        this.property = property;
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

    setUniforms(gl: WebGLRenderingContext, program: Program) {
        gl.uniform1f(program.uniforms[`a_${this.name}_t`], 0);
    }
}

class CompositeExpressionBinder<T> implements Binder<T> {
    expression: CompositeExpression;
    name: string;
    type: string;
    property: string;
    useIntegerZoom: boolean;
    zoom: number;
    statistics: { max: number };

    constructor(expression: CompositeExpression, name: string, type: string, property: string, useIntegerZoom: boolean, zoom: number) {
        this.expression = expression;
        this.name = name;
        this.type = type;
        this.property = property;
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

    setUniforms(gl: WebGLRenderingContext, program: Program, globals: GlobalProperties) {
        gl.uniform1f(program.uniforms[`a_${this.name}_t`], this.interpolationFactor(globals.zoom));
    }
}

export type SerializedProgramConfiguration = {
    array: SerializedStructArray,
    type: StructArrayTypeParameters,
    statistics: PaintPropertyStatistics
};

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
    interface: ?ProgramInterface;
    PaintVertexArray: Class<StructArray>;

    layer: StyleLayer;
    paintVertexArray: StructArray;
    paintPropertyStatistics: PaintPropertyStatistics;
    paintVertexBuffer: ?VertexBuffer;

    constructor() {
        this.binders = {};
        this.cacheKey = '';
    }

    static createDynamic(programInterface: ProgramInterface, layer: StyleLayer, zoom: number) {
        const self = new ProgramConfiguration();
        const attributes = [];

        for (const attribute of programInterface.paintAttributes || []) {
            const property = attribute.property;
            const name = attribute.name || property.replace(`${layer.type}-`, '').replace(/-/g, '_');
            const value: PossiblyEvaluatedPropertyValue<any> = (layer.paint: any).get(property);
            const type = value.property.specification.type;
            const useIntegerZoom = value.property.useIntegerZoom;

            if (value.value.kind === 'constant') {
                self.binders[name] = new ConstantBinder(value.value, name, type, property);
                self.cacheKey += `/u_${name}`;
            } else if (value.value.kind === 'source') {
                self.binders[name] = new SourceExpressionBinder(value.value, name, type, property);
                self.cacheKey += `/a_${name}`;
                attributes.push({
                    name: `a_${name}`,
                    type: 'Float32',
                    components: type === 'color' ? 2 : 1
                });
            } else {
                self.binders[name] = new CompositeExpressionBinder(value.value, name, type, property, useIntegerZoom, zoom);
                self.cacheKey += `/z_${name}`;
                attributes.push({
                    name: `a_${name}`,
                    type: 'Float32',
                    components: type === 'color' ? 4 : 2
                });
            }
        }

        self.PaintVertexArray = createVertexArrayType(attributes);
        self.interface = programInterface;
        self.layer = layer;

        return self;
    }

    static forBackgroundColor(color: Color, opacity: number) {
        const self = new ProgramConfiguration();

        self.binders.color = new ConstantBinder(color, 'color', 'color', 'background-color');
        self.cacheKey += `/u_color`;

        self.binders.opacity = new ConstantBinder(opacity, 'opacity', 'number', 'background-opacity');
        self.cacheKey += `/u_opacity`;

        return self;
    }

    static forBackgroundPattern(opacity: number) {
        const self = new ProgramConfiguration();

        self.binders.opacity = new ConstantBinder(opacity, 'opacity', 'number', 'background-opacity');
        self.cacheKey += `/u_opacity`;

        return self;
    }

    populatePaintArray(length: number, feature: Feature) {
        const paintArray = this.paintVertexArray;
        if (paintArray.bytesPerElement === 0) return;

        const start = paintArray.length;
        paintArray.resize(length);

        for (const name in this.binders) {
            this.binders[name].populatePaintArray(
                paintArray,
                start, length,
                feature);
        }
    }

    defines(): Array<string> {
        const result = [];
        for (const name in this.binders) {
            result.push.apply(result, this.binders[name].defines());
        }
        return result;
    }

    setUniforms<Properties: Object>(gl: WebGLRenderingContext, program: Program, properties: PossiblyEvaluated<Properties>, globals: GlobalProperties) {
        for (const name in this.binders) {
            const binder = this.binders[name];
            binder.setUniforms(gl, program, globals, properties.get(binder.property));
        }
    }

    serialize(transferables?: Array<Transferable>): ?SerializedProgramConfiguration {
        if (this.paintVertexArray.length === 0) {
            return null;
        }

        const statistics: PaintPropertyStatistics = {};
        for (const name in this.binders) {
            statistics[this.binders[name].property] = this.binders[name].statistics;
        }

        return {
            array: this.paintVertexArray.serialize(transferables),
            type: this.paintVertexArray.constructor.serialize(),
            statistics
        };
    }

    static deserialize(programInterface: ProgramInterface, layer: StyleLayer, zoom: number, serialized: ?SerializedProgramConfiguration) {
        const self = ProgramConfiguration.createDynamic(programInterface, layer, zoom);
        if (serialized) {
            self.PaintVertexArray = createVertexArrayType(serialized.type.members);
            self.paintVertexArray = new self.PaintVertexArray(serialized.array);
            self.paintPropertyStatistics = serialized.statistics;
        }
        return self;
    }

    upload(gl: WebGLRenderingContext) {
        if (this.paintVertexArray) {
            this.paintVertexBuffer = new VertexBuffer(gl, this.paintVertexArray);
        }
    }

    destroy() {
        if (this.paintVertexBuffer) {
            this.paintVertexBuffer.destroy();
        }
    }
}

class ProgramConfigurationSet {
    programConfigurations: {[string]: ProgramConfiguration};

    constructor(programInterface: ProgramInterface, layers: $ReadOnlyArray<StyleLayer>, zoom: number, arrays?: {+[string]: ?SerializedProgramConfiguration}) {
        this.programConfigurations = {};
        if (arrays) {
            for (const layer of layers) {
                this.programConfigurations[layer.id] = ProgramConfiguration.deserialize(programInterface, layer, zoom, arrays[layer.id]);
            }
        } else {
            for (const layer of layers) {
                const programConfiguration = ProgramConfiguration.createDynamic(programInterface, layer, zoom);
                programConfiguration.paintVertexArray = new programConfiguration.PaintVertexArray();
                this.programConfigurations[layer.id] = programConfiguration;
            }
        }
    }

    populatePaintArrays(length: number, feature: Feature) {
        for (const key in this.programConfigurations) {
            this.programConfigurations[key].populatePaintArray(length, feature);
        }
    }

    serialize(transferables?: Array<Transferable>) {
        const result = {};
        for (const layerId in this.programConfigurations) {
            const serialized = this.programConfigurations[layerId].serialize(transferables);
            if (!serialized) continue;
            result[layerId] = serialized;
        }
        return result;
    }

    get(layerId: string) {
        return this.programConfigurations[layerId];
    }

    upload(gl: WebGLRenderingContext) {
        for (const layerId in this.programConfigurations) {
            this.programConfigurations[layerId].upload(gl);
        }
    }

    destroy() {
        for (const layerId in this.programConfigurations) {
            this.programConfigurations[layerId].destroy();
        }
    }
}

module.exports = {
    ProgramConfiguration,
    ProgramConfigurationSet
};
