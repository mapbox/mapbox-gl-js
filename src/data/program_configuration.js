// @flow

const createVertexArrayType = require('./vertex_array_type');
const packUint8ToFloat = require('../shaders/encode_attribute').packUint8ToFloat;
const VertexBuffer = require('../gl/vertex_buffer');

import type StyleLayer from '../style/style_layer';
import type {ViewType, StructArray, SerializedStructArray, StructArrayTypeParameters} from '../util/struct_array';
import type Program from '../render/program';
import type {Feature} from '../style-spec/expression';

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
    paintAttributes?: Array<PaintAttribute>,
    indexArrayType2?: Class<StructArray>
}

function packColor(color: [number, number, number, number]): [number, number] {
    return [
        packUint8ToFloat(255 * color[0], 255 * color[1]),
        packUint8ToFloat(255 * color[2], 255 * color[3])
    ];
}

interface Binder {
    property: string;

    populatePaintArray(layer: StyleLayer,
                       paintArray: StructArray,
                       statistics: PaintPropertyStatistics,
                       start: number,
                       length: number,
                       feature: Feature): void;

    defines(): Array<string>;

    setUniforms(gl: WebGLRenderingContext,
                program: Program,
                layer: StyleLayer,
                globalProperties: { zoom: number }): void;
}

class ConstantBinder implements Binder {
    name: string;
    type: string;
    property: string;
    useIntegerZoom: boolean;

    constructor(name: string, type: string, property: string, useIntegerZoom: boolean) {
        this.name = name;
        this.type = type;
        this.property = property;
        this.useIntegerZoom = useIntegerZoom;
    }

    defines() {
        return [`#define HAS_UNIFORM_u_${this.name}`];
    }

    populatePaintArray() {}

    setUniforms(gl: WebGLRenderingContext, program: Program, layer: StyleLayer, {zoom}: { zoom: number }) {
        const value = layer.getPaintValue(this.property, { zoom: this.useIntegerZoom ? Math.floor(zoom) : zoom });
        if (this.type === 'color') {
            gl.uniform4fv(program.uniforms[`u_${this.name}`], value);
        } else {
            gl.uniform1f(program.uniforms[`u_${this.name}`], value);
        }
    }
}

class SourceFunctionBinder implements Binder {
    name: string;
    type: string;
    property: string;

    constructor(name: string, type: string, property: string) {
        this.name = name;
        this.type = type;
        this.property = property;
    }

    defines() {
        return [];
    }

    populatePaintArray(layer: StyleLayer,
                       paintArray: StructArray,
                       statistics: PaintPropertyStatistics,
                       start: number,
                       length: number,
                       feature: Feature) {
        const value = layer.getPaintValue(this.property, {zoom: 0}, feature);

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

            const stats = statistics[this.property];
            stats.max = Math.max(stats.max, value);
        }
    }

    setUniforms(gl: WebGLRenderingContext, program: Program) {
        gl.uniform1f(program.uniforms[`a_${this.name}_t`], 0);
    }
}

class CompositeFunctionBinder implements Binder {
    name: string;
    type: string;
    property: string;
    useIntegerZoom: boolean;
    zoom: number;

    constructor(name: string, type: string, property: string, useIntegerZoom: boolean, zoom: number) {
        this.name = name;
        this.type = type;
        this.property = property;
        this.useIntegerZoom = useIntegerZoom;
        this.zoom = zoom;
    }

    defines() {
        return [];
    }

    populatePaintArray(layer: StyleLayer,
                       paintArray: StructArray,
                       statistics: PaintPropertyStatistics,
                       start: number,
                       length: number,
                       feature: Feature) {
        const min = layer.getPaintValue(this.property, {zoom: this.zoom    }, feature);
        const max = layer.getPaintValue(this.property, {zoom: this.zoom + 1}, feature);

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

            const stats = statistics[this.property];
            stats.max = Math.max(stats.max, min, max);
        }
    }

    setUniforms(gl: WebGLRenderingContext, program: Program, layer: StyleLayer, {zoom}: { zoom: number }) {
        const f = layer.getPaintInterpolationFactor(this.property, this.useIntegerZoom ? Math.floor(zoom) : zoom, this.zoom, this.zoom + 1);
        gl.uniform1f(program.uniforms[`a_${this.name}_t`], f);
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
    binders: { [string]: Binder };
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
            const useIntegerZoom = attribute.useIntegerZoom || false;
            const name = attribute.name || property.replace(`${layer.type}-`, '').replace(/-/g, '_');
            const type = layer._paintSpecifications[property].type;

            if (layer.isPaintValueFeatureConstant(property)) {
                self.binders[name] = new ConstantBinder(name, type, property, useIntegerZoom);
                self.cacheKey += `/u_${name}`;
            } else if (layer.isPaintValueZoomConstant(property)) {
                self.binders[name] = new SourceFunctionBinder(name, type, property);
                self.cacheKey += `/a_${name}`;
                attributes.push({
                    name: `a_${name}`,
                    type: 'Float32',
                    components: type === 'color' ? 2 : 1
                });
            } else {
                self.binders[name] = new CompositeFunctionBinder(name, type, property, useIntegerZoom, zoom);
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

    static createBasicFill() {
        const self = new ProgramConfiguration();

        self.binders.color = new ConstantBinder('color', 'color', 'fill-color', false);
        self.cacheKey += `/u_color`;

        self.binders.opacity = new ConstantBinder('opacity', 'number', 'fill-opacity', false);
        self.cacheKey += `/u_opacity`;

        return self;
    }

    // Since this object is accessed frequently during populatePaintArray, it
    // is helpful to initialize it ahead of time to avoid recalculating
    // 'hidden class' optimizations to take effect
    createPaintPropertyStatistics() {
        const paintPropertyStatistics: PaintPropertyStatistics = {};
        for (const name in this.binders) {
            paintPropertyStatistics[this.binders[name].property] = {
                max: -Infinity
            };
        }
        return paintPropertyStatistics;
    }

    populatePaintArray(length: number, feature: Feature) {
        const paintArray = this.paintVertexArray;
        if (paintArray.bytesPerElement === 0) return;

        const start = paintArray.length;
        paintArray.resize(length);

        for (const name in this.binders) {
            this.binders[name].populatePaintArray(
                this.layer, paintArray,
                this.paintPropertyStatistics,
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

    setUniforms(gl: WebGLRenderingContext, program: Program, layer: StyleLayer, globalProperties: { zoom: number }) {
        for (const name in this.binders) {
            this.binders[name].setUniforms(gl, program, layer, globalProperties);
        }
    }

    serialize(transferables?: Array<Transferable>): ?SerializedProgramConfiguration {
        if (this.paintVertexArray.length === 0) {
            return null;
        }
        return {
            array: this.paintVertexArray.serialize(transferables),
            type: this.paintVertexArray.constructor.serialize(),
            statistics: this.paintPropertyStatistics
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
                programConfiguration.paintPropertyStatistics = programConfiguration.createPaintPropertyStatistics();
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
