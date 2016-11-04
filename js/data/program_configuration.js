'use strict';

const createVertexArrayType = require('./vertex_array_type');
const util = require('../util/util');
const shaders = require('mapbox-gl-shaders');
const assert = require('assert');

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
 * @private
 */
class ProgramConfiguration {

    constructor() {
        this.attributes = [];
        this.uniforms = [];
        this.vertexPragmas = {};
        this.fragmentPragmas = {};
    }

    static createDynamic(attributes, layer, zoom) {
        const self = new ProgramConfiguration();

        for (const attribute of attributes) {
            const specification = layer._paintSpecifications[attribute.paintProperty];
            const isColor = specification.type === 'color';
            const inputName = attribute.name;
            assert(attribute.name.slice(0, 2) === 'a_');
            const name = attribute.name.slice(2);
            const multiplier = attribute.multiplier || (isColor ? 255 : 1);

            const frag = self.fragmentPragmas[name] = {define: [], initialize: []};
            const vert = self.vertexPragmas[name] = {define: [], initialize: []};

            if (layer.isPaintValueFeatureConstant(attribute.paintProperty)) {
                self.uniforms.push(util.extend({}, attribute, {isColor}));

                frag.define.push(`uniform {precision} {type} ${inputName};`);
                vert.define.push(`uniform {precision} {type} ${inputName};`);

                frag.initialize.push(`{precision} {type} ${name} = ${inputName};`);
                vert.initialize.push(`{precision} {type} ${name} = ${inputName};`);

            } else if (layer.isPaintValueZoomConstant(attribute.paintProperty)) {
                self.attributes.push(util.extend({}, attribute, {components: isColor ? 4 : 1, multiplier}));

                frag.define.push(`varying {precision} {type} ${name};`);
                vert.define.push(`varying {precision} {type} ${name};`);

                vert.define.push(`attribute {precision} {type} ${inputName};`);

                vert.initialize.push(`${name} = ${inputName} / ${multiplier}.0;`);

            } else {
                // Pick the index of the first offset to add to the buffers.
                // Find the four closest stops, ideally with two on each side of the zoom level.
                let numStops = 0;
                const zoomLevels = layer.getPaintValueStopZoomLevels(attribute.paintProperty);
                while (numStops < zoomLevels.length && zoomLevels[numStops] < zoom) numStops++;
                const stopOffset = Math.max(0, Math.min(zoomLevels.length - 4, numStops - 2));

                const fourZoomLevels = [];
                for (let s = 0; s < 4; s++) {
                    fourZoomLevels.push(zoomLevels[Math.min(stopOffset + s, zoomLevels.length - 1)]);
                }

                const tName = `u_${name}_t`;

                frag.define.push(`varying {precision} {type} ${name};`);
                vert.define.push(`varying {precision} {type} ${name};`);
                vert.define.push(`uniform lowp float ${tName};`);

                self.uniforms.push({
                    name: tName,
                    getValue: createGetUniform(attribute, stopOffset),
                    isColor: false
                });

                if (!isColor) {
                    self.attributes.push(util.extend({}, attribute, {
                        getValue: createFunctionGetValue(attribute, fourZoomLevels),
                        components: 4,
                        multiplier
                    }));

                    vert.define.push(`attribute {precision} vec4 ${inputName};`);
                    vert.initialize.push(`${name} = evaluate_zoom_function_1(${inputName}, ${tName}) / ${multiplier}.0;`);

                } else {
                    const inputNames = [];
                    for (let k = 0; k < 4; k++) {
                        inputNames.push(inputName + k);
                        self.attributes.push(util.extend({}, attribute, {
                            getValue: createFunctionGetValue(attribute, [fourZoomLevels[k]]),
                            name: inputName + k,
                            components: 4,
                            multiplier
                        }));
                        vert.define.push(`attribute {precision} {type} ${inputName + k};`);
                    }
                    vert.initialize.push(`${name} = evaluate_zoom_function_4(${inputNames.join(', ')}, ${tName}) / ${multiplier}.0;`);
                }
            }
        }

        self.cacheKey = JSON.stringify([self.vertexPragmas, self.fragmentPragmas]);

        return self;
    }

    static createStatic(uniforms) {
        const self = new ProgramConfiguration();

        for (const uniform of uniforms) {
            assert(uniform.name.indexOf('u_') === 0);
            const name = uniform.name.slice(2);

            const frag = self.fragmentPragmas[name] = {define: [], initialize: []};
            const vert = self.vertexPragmas[name] = {define: [], initialize: []};

            const type = `${uniform.components === 1 ? 'float' : `vec${uniform.components}`}`;

            frag.define.push(`uniform {precision} ${type} u_${name};`);
            vert.define.push(`uniform {precision} ${type} u_${name};`);

            frag.initialize.push(`{precision} ${type} ${name} = u_${name};`);
            vert.initialize.push(`{precision} ${type} ${name} = u_${name};`);
        }

        self.cacheKey = JSON.stringify(self.fragmentPragmas);

        return self;
    }

    populatePaintArray(layer, paintArray, length, globalProperties, featureProperties) {
        const start = paintArray.length;
        paintArray.resize(length);

        for (const attribute of this.attributes) {
            const value = attribute.getValue ?
                attribute.getValue(layer, globalProperties, featureProperties) :
                layer.getPaintValue(attribute.paintProperty, globalProperties, featureProperties);

            const multiplier = attribute.multiplier;
            const components = attribute.components || 1;

            for (let i = start; i < length; i++) {
                const vertex = paintArray.get(i);
                if (components > 1) {
                    for (let c = 0; c < components; c++) {
                        vertex[attribute.name + c] = value[c] * multiplier;
                    }
                } else {
                    vertex[attribute.name] = value * multiplier;
                }
            }
        }
    }

    paintVertexArrayType() {
        return createVertexArrayType(this.attributes);
    }

    createProgram(name, showOverdraw, gl) {
        const program = gl.createProgram();
        const definition = shaders[name];

        let definesSource = '#define MAPBOX_GL_JS;\n';
        if (showOverdraw) {
            definesSource += '#define OVERDRAW_INSPECTOR;\n';
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, applyPragmas(definesSource + definition.fragmentSource, this.fragmentPragmas));
        gl.compileShader(fragmentShader);
        assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(fragmentShader));
        gl.attachShader(program, fragmentShader);

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, applyPragmas(definesSource + shaders.util + definition.vertexSource, this.vertexPragmas));
        gl.compileShader(vertexShader);
        assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(vertexShader));
        gl.attachShader(program, vertexShader);

        gl.linkProgram(program);
        assert(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program));

        const attributes = {};
        const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttributes; i++) {
            const attribute = gl.getActiveAttrib(program, i);
            attributes[attribute.name] = gl.getAttribLocation(program, attribute.name);
        }

        const uniforms = {};
        const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let ui = 0; ui < numUniforms; ui++) {
            const uniform = gl.getActiveUniform(program, ui);
            uniforms[uniform.name] = gl.getUniformLocation(program, uniform.name);
        }

        return util.extend({
            program: program,
            definition: definition,
            attributes: attributes,
            numAttributes: numAttributes
        }, attributes, uniforms);
    }

    setUniforms(gl, program, layer, globalProperties) {
        for (const uniform of this.uniforms) {
            const value = uniform.getValue ?
                uniform.getValue(layer, globalProperties) :
                layer.getPaintValue(uniform.paintProperty, globalProperties);

            if (uniform.isColor) {
                gl.uniform4fv(program[uniform.name], value);
            } else {
                gl.uniform1f(program[uniform.name], value);
            }
        }
    }
}

function createFunctionGetValue(attribute, stopZoomLevels) {
    return function(layer, globalProperties, featureProperties) {
        if (stopZoomLevels.length === 1) {
            // return one multi-component value like color0
            return layer.getPaintValue(attribute.paintProperty, util.extend({}, globalProperties, { zoom: stopZoomLevels[0] }), featureProperties);
        } else {
            // pack multiple single-component values into a four component attribute
            const values = [];
            for (let z = 0; z < stopZoomLevels.length; z++) {
                const stopZoomLevel = stopZoomLevels[z];
                values.push(layer.getPaintValue(attribute.paintProperty, util.extend({}, globalProperties, { zoom: stopZoomLevel }), featureProperties));
            }
            return values;
        }
    };
}

function createGetUniform(attribute, stopOffset) {
    return function(layer, globalProperties) {
        // stopInterp indicates which stops need to be interpolated.
        // If stopInterp is 3.5 then interpolate half way between stops 3 and 4.
        const stopInterp = layer.getPaintInterpolationT(attribute.paintProperty, globalProperties.zoom);
        // We can only store four stop values in the buffers. stopOffset is the number of stops that come
        // before the stops that were added to the buffers.
        return [Math.max(0, Math.min(4, stopInterp - stopOffset))];
    };
}

function applyPragmas(source, pragmas) {
    return source.replace(/#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g, (match, operation, precision, type, name) => {
        return pragmas[name][operation]
            .join('\n')
            .replace(/{type}/g, type)
            .replace(/{precision}/g, precision);
    });
}

module.exports = ProgramConfiguration;
