'use strict';

const ArrayGroup = require('./array_group');
const BufferGroup = require('./buffer_group');
const util = require('../util/util');
const StructArrayType = require('../util/struct_array');
const assert = require('assert');

const FAKE_ZOOM_HISTORY = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 };

/**
 * The `Bucket` class is the single point of knowledge about turning vector
 * tiles into WebGL buffers.
 *
 * `Bucket` is an abstract class. A subclass exists for each Mapbox GL
 * style spec layer type. Because `Bucket` is an abstract class,
 * instances should be created via the `Bucket.create` method.
 *
 * @private
 */
class Bucket {
    /**
     * @param options
     * @param {number} options.zoom Zoom level of the buffers being built. May be
     *     a fractional zoom level.
     * @param options.layer A Mapbox style layer object
     * @param {Object.<string, Buffer>} options.buffers The set of `Buffer`s being
     *     built for this tile. This object facilitates sharing of `Buffer`s be
           between `Bucket`s.
     */
    constructor (options) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layer = options.layer;
        this.childLayers = options.childLayers;

        this.type = this.layer.type;
        this.features = [];
        this.id = this.layer.id;
        this.index = options.index;
        this.sourceLayer = this.layer.sourceLayer;
        this.sourceLayerIndex = options.sourceLayerIndex;
        this.minZoom = this.layer.minzoom;
        this.maxZoom = this.layer.maxzoom;

        this.paintAttributes = createPaintAttributes(this);

        if (options.arrays) {
            const programInterfaces = this.programInterfaces;
            this.bufferGroups = util.mapObject(options.arrays, (programArrayGroups, programName) => {
                const programInterface = programInterfaces[programName];
                const paintVertexArrayTypes = options.paintVertexArrayTypes[programName];
                return programArrayGroups.map((arrayGroup) => {
                    return new BufferGroup(arrayGroup, {
                        layoutVertexArrayType: programInterface.layoutVertexArrayType.serialize(),
                        elementArrayType: programInterface.elementArrayType && programInterface.elementArrayType.serialize(),
                        elementArrayType2: programInterface.elementArrayType2 && programInterface.elementArrayType2.serialize(),
                        paintVertexArrayTypes: paintVertexArrayTypes
                    });
                });
            });
        }
    }

    /**
     * Instantiate the appropriate subclass of `Bucket` for `options`.
     * @param options See `Bucket` constructor options
     * @returns {Bucket}
     */
    static create(options) {
        const Classes = {
            fill: require('./bucket/fill_bucket'),
            fillextrusion: require('./bucket/fill_extrusion_bucket'),
            line: require('./bucket/line_bucket'),
            circle: require('./bucket/circle_bucket'),
            symbol: require('./bucket/symbol_bucket')
        };

        let type = options.layer.type;
        if (type === 'fill' && (!options.layer.isPaintValueFeatureConstant('fill-extrude-height') ||
            !options.layer.isPaintValueZoomConstant('fill-extrude-height') ||
            options.layer.getPaintValue('fill-extrude-height') !== 0)) {
            type = 'fillextrusion';
        }

        return new Classes[type](options);
    }

    /**
     * Build the arrays! Features are set directly to the `features` property.
     */
    populateArrays() {
        this.createArrays();
        this.recalculateStyleLayers();

        for (let i = 0; i < this.features.length; i++) {
            this.addFeature(this.features[i]);
        }

        this.trimArrays();
    }

    /**
     * Check if there is enough space available in the current array group for
     * `vertexLength` vertices. If not, append a new array group. Should be called
     * by `populateArrays` and its callees.
     *
     * Array groups are added to this.arrayGroups[programName].
     *
     * @param {string} programName the name of the program associated with the buffer that will receive the vertices
     * @param {number} vertexLength The number of vertices that will be inserted to the buffer.
     * @returns The current array group
     */
    prepareArrayGroup(programName, numVertices) {
        const groups = this.arrayGroups[programName];
        let currentGroup = groups.length && groups[groups.length - 1];

        if (!currentGroup || !currentGroup.hasCapacityFor(numVertices)) {
            currentGroup = new ArrayGroup({
                layoutVertexArrayType: this.programInterfaces[programName].layoutVertexArrayType,
                elementArrayType: this.programInterfaces[programName].elementArrayType,
                elementArrayType2: this.programInterfaces[programName].elementArrayType2,
                paintVertexArrayTypes: this.paintVertexArrayTypes[programName]
            });

            currentGroup.index = groups.length;

            groups.push(currentGroup);
        }

        return currentGroup;
    }

    /**
     * Sets up `this.paintVertexArrayTypes` as { [programName]: { [layerName]: PaintArrayType, ... }, ... }
     *
     * And `this.arrayGroups` as { [programName]: [], ... }; these get populated
     * with array group structure over in `prepareArrayGroup`.
     */
    createArrays() {
        this.arrayGroups = {};
        this.paintVertexArrayTypes = {};

        for (const programName in this.programInterfaces) {
            this.arrayGroups[programName] = [];

            const paintVertexArrayTypes = this.paintVertexArrayTypes[programName] = {};
            const layerPaintAttributes = this.paintAttributes[programName];

            for (const layerName in layerPaintAttributes) {
                paintVertexArrayTypes[layerName] = new Bucket.VertexArrayType(layerPaintAttributes[layerName].attributes);
            }
        }
    }

    destroy() {
        for (const programName in this.bufferGroups) {
            const programBufferGroups = this.bufferGroups[programName];
            for (let i = 0; i < programBufferGroups.length; i++) {
                programBufferGroups[i].destroy();
            }
        }
    }

    trimArrays() {
        for (const programName in this.arrayGroups) {
            const arrayGroups = this.arrayGroups[programName];
            for (let i = 0; i < arrayGroups.length; i++) {
                arrayGroups[i].trim();
            }
        }
    }

    isEmpty() {
        for (const programName in this.arrayGroups) {
            const arrayGroups = this.arrayGroups[programName];
            for (let i = 0; i < arrayGroups.length; i++) {
                if (!arrayGroups[i].isEmpty()) {
                    return false;
                }
            }
        }
        return true;
    }

    getTransferables(transferables) {
        for (const programName in this.arrayGroups) {
            const arrayGroups = this.arrayGroups[programName];
            for (let i = 0; i < arrayGroups.length; i++) {
                arrayGroups[i].getTransferables(transferables);
            }
        }
    }

    setUniforms(gl, programName, program, layer, globalProperties) {
        const uniforms = this.paintAttributes[programName][layer.id].uniforms;
        for (let i = 0; i < uniforms.length; i++) {
            const uniform = uniforms[i];
            const uniformLocation = program[uniform.name];
            gl[`uniform${uniform.components}fv`](uniformLocation, uniform.getValue(layer, globalProperties));
        }
    }

    serialize() {
        return {
            layerId: this.layer.id,
            zoom: this.zoom,
            arrays: util.mapObject(this.arrayGroups, (programArrayGroups) => {
                return programArrayGroups.map((arrayGroup) => {
                    return arrayGroup.serialize();
                });
            }),
            paintVertexArrayTypes: util.mapObject(this.paintVertexArrayTypes, (arrayTypes) => {
                return util.mapObject(arrayTypes, (arrayType) => {
                    return arrayType.serialize();
                });
            }),

            childLayerIds: this.childLayers.map((layer) => {
                return layer.id;
            })
        };
    }

    recalculateStyleLayers() {
        for (let i = 0; i < this.childLayers.length; i++) {
            this.childLayers[i].recalculate(this.zoom, FAKE_ZOOM_HISTORY);
        }
    }

    populatePaintArrays(interfaceName, globalProperties, featureProperties, startGroup, startIndex) {
        for (let l = 0; l < this.childLayers.length; l++) {
            const layer = this.childLayers[l];
            const groups = this.arrayGroups[interfaceName];
            for (let g = startGroup.index; g < groups.length; g++) {
                const group = groups[g];
                const length = group.layoutVertexArray.length;
                const paintArray = group.paintVertexArrays[layer.id];
                paintArray.resize(length);

                const attributes = this.paintAttributes[interfaceName][layer.id].attributes;
                for (let m = 0; m < attributes.length; m++) {
                    const attribute = attributes[m];

                    const value = attribute.getValue(layer, globalProperties, featureProperties);
                    const multiplier = attribute.multiplier || 1;
                    const components = attribute.components || 1;

                    const start = g === startGroup.index  ? startIndex : 0;
                    for (let i = start; i < length; i++) {
                        const vertex = paintArray.get(i);
                        for (let c = 0; c < components; c++) {
                            const memberName = components > 1 ? (attribute.name + c) : attribute.name;
                            vertex[memberName] = value[c] * multiplier;
                        }
                    }
                }
            }
        }
    }
}

/**
 * A vertex array stores data for each vertex in a geometry. Elements are aligned to 4 byte
 * boundaries for best performance in WebGL.
 * @private
 */
Bucket.VertexArrayType = function (members) {
    return new StructArrayType({
        members: members,
        alignment: 4
    });
};

/**
 * An element array stores Uint16 indicies of vertexes in a corresponding vertex array. With no
 * arguments, it defaults to three components per element, forming triangles.
 * @private
 */
Bucket.ElementArrayType = function (components) {
    return new StructArrayType({
        members: [{
            type: 'Uint16',
            name: 'vertices',
            components: components || 3
        }]
    });
};

/**
 * The maximum extent of a feature that can be safely stored in the buffer.
 * In practice, all features are converted to this extent before being added.
 *
 * Positions are stored as signed 16bit integers.
 * One bit is lost for signedness to support featuers extending past the left edge of the tile.
 * One bit is lost because the line vertex buffer packs 1 bit of other data into the int.
 * One bit is lost to support features extending past the extent on the right edge of the tile.
 * This leaves us with 2^13 = 8192
 *
 * @private
 * @readonly
 */
Bucket.EXTENT = 8192;

module.exports = Bucket;

function createPaintAttributes(bucket) {
    const attributes = {};
    for (const interfaceName in bucket.programInterfaces) {
        attributes[interfaceName] = {};

        for (const childLayer of bucket.childLayers) {
            attributes[interfaceName][childLayer.id] = {
                attributes: [],
                uniforms: [],
                defines: [],
                vertexPragmas: { define: {}, initialize: {} },
                fragmentPragmas: { define: {}, initialize: {} }
            };
        }

        const interfacePaintAttributes = bucket.programInterfaces[interfaceName].paintAttributes;
        if (!interfacePaintAttributes) continue;

        // "{precision} {type} tokens are replaced by arguments to the pragma
        // https://github.com/mapbox/mapbox-gl-shaders#pragmas

        for (const attribute of interfacePaintAttributes) {
            attribute.multiplier = attribute.multiplier || 1;

            for (const layer of bucket.childLayers) {
                const paintAttributes = attributes[interfaceName][layer.id];
                const fragmentInit = paintAttributes.fragmentPragmas.initialize;
                const fragmentDefine = paintAttributes.fragmentPragmas.define;
                const vertexInit = paintAttributes.vertexPragmas.initialize;
                const vertexDefine = paintAttributes.vertexPragmas.define;

                const inputName = attribute.name;
                assert(attribute.name.slice(0, 2) === 'a_');
                const name = attribute.name.slice(2);
                const multiplier = attribute.multiplier.toFixed(1);

                fragmentInit[name] = '';

                if (layer.isPaintValueFeatureConstant(attribute.paintProperty)) {
                    paintAttributes.uniforms.push(attribute);

                    fragmentDefine[name] = vertexDefine[name] = `uniform {precision} {type} ${inputName};\n`;
                    fragmentInit[name] = vertexInit[name] = `{precision} {type} ${name} = ${inputName};\n`;

                } else if (layer.isPaintValueZoomConstant(attribute.paintProperty)) {
                    paintAttributes.attributes.push(util.extend({}, attribute, {name: inputName}));

                    fragmentDefine[name] = `varying {precision} {type} ${name};\n`;
                    vertexDefine[name] = `varying {precision} {type} ${name};\n attribute {precision} {type} ${inputName};\n`;
                    vertexInit[name] = `${name} = ${inputName} / ${multiplier};\n`;

                } else {
                    // Pick the index of the first offset to add to the buffers.
                    // Find the four closest stops, ideally with two on each side of the zoom level.
                    let numStops = 0;
                    const zoomLevels = layer.getPaintValueStopZoomLevels(attribute.paintProperty);
                    while (numStops < zoomLevels.length && zoomLevels[numStops] < bucket.zoom) numStops++;
                    const stopOffset = Math.max(0, Math.min(zoomLevels.length - 4, numStops - 2));

                    const fourZoomLevels = [];
                    for (let s = 0; s < 4; s++) {
                        fourZoomLevels.push(zoomLevels[Math.min(stopOffset + s, zoomLevels.length - 1)]);
                    }

                    const tName = `u_${name}_t`;

                    fragmentDefine[name] = `varying {precision} {type} ${name};\n`;
                    vertexDefine[name] = `varying {precision} {type} ${name};\n uniform lowp float ${tName};\n`;

                    paintAttributes.uniforms.push(util.extend({}, attribute, {
                        name: tName,
                        getValue: createGetUniform(attribute, stopOffset),
                        components: 1
                    }));

                    if (attribute.components === 1) {
                        paintAttributes.attributes.push(util.extend({}, attribute, {
                            getValue: createFunctionGetValue(attribute, fourZoomLevels),
                            isFunction: true,
                            components: attribute.components * 4
                        }));

                        vertexDefine[name] += `attribute {precision} vec4 ${inputName};\n`;
                        vertexInit[name] = `${name} = evaluate_zoom_function_1(${inputName}, ${tName}) / ${multiplier};\n`;

                    } else {
                        const inputNames = [];
                        for (let k = 0; k < 4; k++) {
                            inputNames.push(inputName + k);
                            paintAttributes.attributes.push(util.extend({}, attribute, {
                                getValue: createFunctionGetValue(attribute, [fourZoomLevels[k]]),
                                isFunction: true,
                                name: inputName + k
                            }));
                            vertexDefine[name] += `attribute {precision} {type} ${inputName + k};\n`;
                        }
                        vertexInit[name] = `${name} = evaluate_zoom_function_4(${inputNames.join(', ')}, ${tName}) / ${multiplier};\n`;
                    }
                }
            }
        }
    }
    return attributes;
}

function createFunctionGetValue(attribute, stopZoomLevels) {
    return function(layer, globalProperties, featureProperties) {
        if (stopZoomLevels.length === 1) {
            // return one multi-component value like color0
            return attribute.getValue(layer, util.extend({}, globalProperties, { zoom: stopZoomLevels[0] }), featureProperties);
        } else {
            // pack multiple single-component values into a four component attribute
            const values = [];
            for (let z = 0; z < stopZoomLevels.length; z++) {
                const stopZoomLevel = stopZoomLevels[z];
                values.push(attribute.getValue(layer, util.extend({}, globalProperties, { zoom: stopZoomLevel }), featureProperties)[0]);
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
