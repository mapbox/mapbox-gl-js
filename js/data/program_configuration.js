'use strict';

const createVertexArrayType = require('./vertex_array_type');
const util = require('../util/util');

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
        this.interpolationUniforms = [];
        this.pragmas = {vertex: {}, fragment: {}};
        this.cacheKey = '';
    }

    static createDynamic(attributes, layer, zoom) {
        const self = new ProgramConfiguration();

        for (const attributeConfig of attributes) {
            const attribute = normalizePaintAttribute(attributeConfig, layer);
            const name = attribute.name.slice(2);

            if (layer.isPaintValueFeatureConstant(attribute.property)) {
                self.addZoomAttribute(name, attribute);
            } else if (layer.isPaintValueZoomConstant(attribute.property)) {
                self.addPropertyAttribute(name, attribute);
            } else {
                self.addZoomAndPropertyAttribute(name, attribute, layer, zoom);
            }
        }
        self.PaintVertexArray = createVertexArrayType(self.attributes);

        return self;
    }

    static createStatic(uniformNames) {
        const self = new ProgramConfiguration();

        for (const name of uniformNames) {
            self.addUniform(name, `u_${name}`);
        }
        return self;
    }

    addUniform(name, inputName) {
        const pragmas = this.getPragmas(name);

        pragmas.define.push(`uniform {precision} {type} ${inputName};`);
        pragmas.initialize.push(`{precision} {type} ${name} = ${inputName};`);

        this.cacheKey += `/u_${name}`;
    }

    addZoomAttribute(name, attribute) {
        this.uniforms.push(attribute);
        this.addUniform(name, attribute.name);
    }

    addPropertyAttribute(name, attribute) {
        const pragmas = this.getPragmas(name);

        this.attributes.push(attribute);

        pragmas.define.push(`varying {precision} {type} ${name};`);

        pragmas.vertex.define.push(`attribute {precision} {type} ${attribute.name};`);
        pragmas.vertex.initialize.push(`${name} = ${attribute.name} / ${attribute.multiplier}.0;`);

        this.cacheKey += `/a_${name}`;
    }

    addZoomAndPropertyAttribute(name, attribute, layer, zoom) {
        const pragmas = this.getPragmas(name);

        pragmas.define.push(`varying {precision} {type} ${name};`);

        // Pick the index of the first offset to add to the buffers.
        let numStops = 0;
        const zoomLevels = layer.getPaintValueStopZoomLevels(attribute.property);
        while (numStops < zoomLevels.length && zoomLevels[numStops] < zoom) numStops++;
        const stopOffset = Math.max(0, Math.min(zoomLevels.length - 4, numStops - 2));

        const tName = `u_${name}_t`;

        pragmas.vertex.define.push(`uniform lowp float ${tName};`);

        this.interpolationUniforms.push({
            name: tName,
            property: attribute.property,
            stopOffset
        });

        // Find the four closest stops, ideally with two on each side of the zoom level.
        const zoomStops = [];
        for (let s = 0; s < 4; s++) {
            zoomStops.push(zoomLevels[Math.min(stopOffset + s, zoomLevels.length - 1)]);
        }

        const componentNames = [];

        if (attribute.components === 1) {
            this.attributes.push(util.extend({}, attribute, {
                components: 4,
                zoomStops
            }));
            pragmas.vertex.define.push(`attribute {precision} vec4 ${attribute.name};`);
            componentNames.push(attribute.name);

        } else {
            for (let k = 0; k < 4; k++) {
                const componentName = attribute.name + k;
                componentNames.push(componentName);

                this.attributes.push(util.extend({}, attribute, {
                    name: componentName,
                    zoomStops: [zoomStops[k]]
                }));
                pragmas.vertex.define.push(`attribute {precision} {type} ${componentName};`);
            }
        }
        pragmas.vertex.initialize.push(`${name} = evaluate_zoom_function_${attribute.components}(\
            ${componentNames.join(', ')}, ${tName}) / ${attribute.multiplier}.0;`);

        this.cacheKey += `/z_${name}`;
    }

    getPragmas(name) {
        if (!this.pragmas[name]) {
            this.pragmas[name]          = {define: [], initialize: []};
            this.pragmas[name].fragment = {define: [], initialize: []};
            this.pragmas[name].vertex   = {define: [], initialize: []};
        }
        return this.pragmas[name];
    }

    applyPragmas(source, shaderType) {
        return source.replace(/#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g, (match, operation, precision, type, name) => {
            return this.pragmas[name][operation].concat(this.pragmas[name][shaderType][operation])
                .join('\n')
                .replace(/{type}/g, type)
                .replace(/{precision}/g, precision);
        });
    }

    populatePaintArray(layer, paintArray, length, globalProperties, featureProperties) {
        const start = paintArray.length;
        paintArray.resize(length);

        for (const attribute of this.attributes) {
            const value = getPaintAttributeValue(attribute, layer, globalProperties, featureProperties);

            for (let i = start; i < length; i++) {
                const vertex = paintArray.get(i);
                if (attribute.components === 4) {
                    for (let c = 0; c < 4; c++) {
                        vertex[attribute.name + c] = value[c] * attribute.multiplier;
                    }
                } else {
                    vertex[attribute.name] = value * attribute.multiplier;
                }
            }
        }
    }

    setUniforms(gl, program, layer, globalProperties) {
        for (const uniform of this.uniforms) {
            const value = layer.getPaintValue(uniform.property, globalProperties);
            if (uniform.components === 4) {
                gl.uniform4fv(program[uniform.name], value);
            } else {
                gl.uniform1f(program[uniform.name], value);
            }
        }
        for (const uniform of this.interpolationUniforms) {
            // stopInterp indicates which stops need to be interpolated.
            // If stopInterp is 3.5 then interpolate half way between stops 3 and 4.
            const stopInterp = layer.getPaintInterpolationT(uniform.property, globalProperties);
            // We can only store four stop values in the buffers. stopOffset is the number of stops that come
            // before the stops that were added to the buffers.
            gl.uniform1f(program[uniform.name], Math.max(0, Math.min(4, stopInterp - uniform.stopOffset)));
        }
    }
}

function getPaintAttributeValue(attribute, layer, globalProperties, featureProperties) {
    if (!attribute.zoomStops) {
        return layer.getPaintValue(attribute.property, globalProperties, featureProperties);
    }
    // add one multi-component value like color0, or pack multiple single-component values into a four component attribute
    const values = attribute.zoomStops.map((zoom) => layer.getPaintValue(
            attribute.property, util.extend({}, globalProperties, {zoom}), featureProperties));

    return values.length === 1 ? values[0] : values;
}

function normalizePaintAttribute(attribute, layer) {
    const name = attribute.property.replace(`${layer.type}-`, '').replace(/-/g, '_');
    const isColor = layer._paintSpecifications[attribute.property].type === 'color';

    return util.extend({
        name: `a_${name}`,
        components: isColor ? 4 : 1,
        multiplier: isColor ? 255 : 1
    }, attribute);
}

module.exports = ProgramConfiguration;
