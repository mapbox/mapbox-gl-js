// @flow

const createVertexArrayType = require('./vertex_array_type');
const interpolationFactor = require('../style-spec/function').interpolationFactor;
const packUint8ToFloat = require('../shaders/encode_attribute').packUint8ToFloat;

import type StyleLayer from '../style/style_layer';
import type {ViewType, StructArray} from '../util/struct_array';

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
    dynamicLayoutAttributes?: Array<LayoutAttribute>,
    paintAttributes?: Array<PaintAttribute>,
    elementArrayType?: Class<StructArray>,
    elementArrayType2?: Class<StructArray>,
}

export type Program = {
    [string]: any
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
                       featureProperties: Object): void;

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
            gl.uniform4fv(program[`u_${this.name}`], value);
        } else {
            gl.uniform1f(program[`u_${this.name}`], value);
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
                       featureProperties: Object) {
        const value = layer.getPaintValue(this.property, undefined, featureProperties);

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
        gl.uniform1f(program[`a_${this.name}_t`], 0);
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
                       featureProperties: Object) {
        const min = layer.getPaintValue(this.property, {zoom: this.zoom    }, featureProperties);
        const max = layer.getPaintValue(this.property, {zoom: this.zoom + 1}, featureProperties);

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
        const f = interpolationFactor(this.useIntegerZoom ? Math.floor(zoom) : zoom, 1, this.zoom, this.zoom + 1);
        gl.uniform1f(program[`a_${this.name}_t`], f);
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
    binders: { [string]: Binder };
    cacheKey: string;
    interface: ?ProgramInterface;
    PaintVertexArray: Class<StructArray>;

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

    populatePaintArray(layer: StyleLayer,
                       paintArray: StructArray,
                       statistics: PaintPropertyStatistics,
                       length: number,
                       featureProperties: Object) {
        const start = paintArray.length;
        paintArray.resize(length);

        for (const name in this.binders) {
            this.binders[name].populatePaintArray(
                layer, paintArray,
                statistics,
                start, length,
                featureProperties);
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
}

module.exports = ProgramConfiguration;
