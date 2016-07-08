'use strict';

var featureFilter = require('feature-filter');
var ArrayGroup = require('./array_group');
var BufferGroup = require('./buffer_group');
var util = require('../util/util');
var StructArrayType = require('../util/struct_array');
var assert = require('assert');

module.exports = Bucket;

/**
 * Instantiate the appropriate subclass of `Bucket` for `options`.
 * @private
 * @param options See `Bucket` constructor options
 * @returns {Bucket}
 */
Bucket.create = function(options) {
    var Classes = {
        fill: require('./bucket/fill_bucket'),
        line: require('./bucket/line_bucket'),
        circle: require('./bucket/circle_bucket'),
        symbol: require('./bucket/symbol_bucket')
    };
    return new Classes[options.layer.type](options);
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

/**
 * The `Bucket` class is the single point of knowledge about turning vector
 * tiles into WebGL buffers.
 *
 * `Bucket` is an abstract class. A subclass exists for each Mapbox GL
 * style spec layer type. Because `Bucket` is an abstract class,
 * instances should be created via the `Bucket.create` method.
 *
 * @class Bucket
 * @private
 * @param options
 * @param {number} options.zoom Zoom level of the buffers being built. May be
 *     a fractional zoom level.
 * @param options.layer A Mapbox style layer object
 * @param {Object.<string, Buffer>} options.buffers The set of `Buffer`s being
 *     built for this tile. This object facilitates sharing of `Buffer`s be
       between `Bucket`s.
 */
function Bucket(options) {
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
        var programInterfaces = this.programInterfaces;
        this.bufferGroups = util.mapObject(options.arrays, function(programArrayGroups, programName) {
            var programInterface = programInterfaces[programName];
            var paintVertexArrayTypes = options.paintVertexArrayTypes[programName];
            return programArrayGroups.map(function(arrayGroup) {
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
 * Build the arrays! Features are set directly to the `features` property.
 * @private
 */
Bucket.prototype.populateArrays = function() {
    this.createArrays();
    this.recalculateStyleLayers();

    for (var i = 0; i < this.features.length; i++) {
        this.addFeature(this.features[i]);
    }

    this.trimArrays();
};

/**
 * Check if there is enough space available in the current array group for
 * `vertexLength` vertices. If not, append a new array group. Should be called
 * by `populateArrays` and its callees.
 *
 * Array groups are added to this.arrayGroups[programName].
 *
 * @private
 * @param {string} programName the name of the program associated with the buffer that will receive the vertices
 * @param {number} vertexLength The number of vertices that will be inserted to the buffer.
 * @returns The current array group
 */
Bucket.prototype.prepareArrayGroup = function(programName, numVertices) {
    var groups = this.arrayGroups[programName];
    var currentGroup = groups.length && groups[groups.length - 1];

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
};

/**
 * Sets up `this.paintVertexArrayTypes` as { [programName]: { [layerName]: PaintArrayType, ... }, ... }
 *
 * And `this.arrayGroups` as { [programName]: [], ... }; these get populated
 * with array group structure over in `prepareArrayGroup`.
 *
 * @private
 */
Bucket.prototype.createArrays = function() {
    this.arrayGroups = {};
    this.paintVertexArrayTypes = {};

    for (var programName in this.programInterfaces) {
        this.arrayGroups[programName] = [];

        var paintVertexArrayTypes = this.paintVertexArrayTypes[programName] = {};
        var layerPaintAttributes = this.paintAttributes[programName];

        for (var layerName in layerPaintAttributes) {
            paintVertexArrayTypes[layerName] = new Bucket.VertexArrayType(layerPaintAttributes[layerName].attributes);
        }
    }
};

Bucket.prototype.destroy = function(gl) {
    for (var programName in this.bufferGroups) {
        var programBufferGroups = this.bufferGroups[programName];
        for (var i = 0; i < programBufferGroups.length; i++) {
            programBufferGroups[i].destroy(gl);
        }
    }
};

Bucket.prototype.trimArrays = function() {
    for (var programName in this.arrayGroups) {
        var arrayGroups = this.arrayGroups[programName];
        for (var i = 0; i < arrayGroups.length; i++) {
            arrayGroups[i].trim();
        }
    }
};

Bucket.prototype.isEmpty = function() {
    for (var programName in this.arrayGroups) {
        var arrayGroups = this.arrayGroups[programName];
        for (var i = 0; i < arrayGroups.length; i++) {
            if (!arrayGroups[i].isEmpty()) {
                return false;
            }
        }
    }
    return true;
};

Bucket.prototype.getTransferables = function(transferables) {
    for (var programName in this.arrayGroups) {
        var arrayGroups = this.arrayGroups[programName];
        for (var i = 0; i < arrayGroups.length; i++) {
            arrayGroups[i].getTransferables(transferables);
        }
    }
};

Bucket.prototype.setUniforms = function(gl, programName, program, layer, globalProperties) {
    var uniforms = this.paintAttributes[programName][layer.id].uniforms;
    for (var i = 0; i < uniforms.length; i++) {
        var uniform = uniforms[i];
        var uniformLocation = program[uniform.name];
        gl['uniform' + uniform.components + 'fv'](uniformLocation, uniform.getValue(layer, globalProperties));
    }
};

Bucket.prototype.serialize = function() {
    return {
        layerId: this.layer.id,
        zoom: this.zoom,
        arrays: util.mapObject(this.arrayGroups, function(programArrayGroups) {
            return programArrayGroups.map(function(arrayGroup) {
                return arrayGroup.serialize();
            });
        }),
        paintVertexArrayTypes: util.mapObject(this.paintVertexArrayTypes, function(arrayTypes) {
            return util.mapObject(arrayTypes, function(arrayType) {
                return arrayType.serialize();
            });
        }),

        childLayerIds: this.childLayers.map(function(layer) {
            return layer.id;
        })
    };
};

Bucket.prototype.createFilter = function() {
    if (!this.filter) {
        this.filter = featureFilter(this.layer.filter);
    }
};

var FAKE_ZOOM_HISTORY = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 };
Bucket.prototype.recalculateStyleLayers = function() {
    for (var i = 0; i < this.childLayers.length; i++) {
        this.childLayers[i].recalculate(this.zoom, FAKE_ZOOM_HISTORY);
    }
};

Bucket.prototype.populatePaintArrays = function(interfaceName, globalProperties, featureProperties, startGroup, startIndex) {
    for (var l = 0; l < this.childLayers.length; l++) {
        var layer = this.childLayers[l];
        var groups = this.arrayGroups[interfaceName];
        for (var g = startGroup.index; g < groups.length; g++) {
            var group = groups[g];
            var length = group.layoutVertexArray.length;
            var paintArray = group.paintVertexArrays[layer.id];
            paintArray.resize(length);

            var attributes = this.paintAttributes[interfaceName][layer.id].attributes;
            for (var m = 0; m < attributes.length; m++) {
                var attribute = attributes[m];

                var value = attribute.getValue(layer, globalProperties, featureProperties);
                var multiplier = attribute.multiplier || 1;
                var components = attribute.components || 1;

                var start = g === startGroup.index  ? startIndex : 0;
                for (var i = start; i < length; i++) {
                    var vertex = paintArray.get(i);
                    for (var c = 0; c < components; c++) {
                        var memberName = components > 1 ? (attribute.name + c) : attribute.name;
                        vertex[memberName] = value[c] * multiplier;
                    }
                }
            }
        }
    }
};

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

function createPaintAttributes(bucket) {
    var attributes = {};
    for (var interfaceName in bucket.programInterfaces) {
        var layerPaintAttributes = attributes[interfaceName] = {};

        for (var c = 0; c < bucket.childLayers.length; c++) {
            var childLayer = bucket.childLayers[c];

            layerPaintAttributes[childLayer.id] = {
                attributes: [],
                uniforms: [],
                defines: [],
                vertexPragmas: { define: {}, initialize: {} },
                fragmentPragmas: { define: {}, initialize: {} }
            };
        }

        var interface_ = bucket.programInterfaces[interfaceName];
        if (!interface_.paintAttributes) continue;

        // These tokens are replaced by arguments to the pragma
        // https://github.com/mapbox/mapbox-gl-shaders#pragmas
        var attributePrecision = '{precision}';
        var attributeType = '{type}';

        for (var i = 0; i < interface_.paintAttributes.length; i++) {
            var attribute = interface_.paintAttributes[i];
            attribute.multiplier = attribute.multiplier || 1;

            for (var j = 0; j < bucket.childLayers.length; j++) {
                var layer = bucket.childLayers[j];
                var paintAttributes = layerPaintAttributes[layer.id];

                var attributeInputName = attribute.name;
                assert(attribute.name.slice(0, 2) === 'a_');
                var attributeInnerName = attribute.name.slice(2);
                var attributeVaryingDefinition;

                paintAttributes.fragmentPragmas.initialize[attributeInnerName] = '';

                if (layer.isPaintValueFeatureConstant(attribute.paintProperty)) {
                    paintAttributes.uniforms.push(attribute);

                    paintAttributes.fragmentPragmas.define[attributeInnerName] = paintAttributes.vertexPragmas.define[attributeInnerName] = [
                        'uniform',
                        attributePrecision,
                        attributeType,
                        attributeInputName
                    ].join(' ') + ';';

                    paintAttributes.fragmentPragmas.initialize[attributeInnerName] = paintAttributes.vertexPragmas.initialize[attributeInnerName] = [
                        attributePrecision,
                        attributeType,
                        attributeInnerName,
                        '=',
                        attributeInputName
                    ].join(' ') + ';\n';

                } else if (layer.isPaintValueZoomConstant(attribute.paintProperty)) {
                    paintAttributes.attributes.push(util.extend({}, attribute, {
                        name: attributeInputName
                    }));

                    attributeVaryingDefinition = [
                        'varying',
                        attributePrecision,
                        attributeType,
                        attributeInnerName
                    ].join(' ') + ';\n';

                    var attributeAttributeDefinition = [
                        paintAttributes.fragmentPragmas.define[attributeInnerName],
                        'attribute',
                        attributePrecision,
                        attributeType,
                        attributeInputName
                    ].join(' ') + ';\n';

                    paintAttributes.fragmentPragmas.define[attributeInnerName] = attributeVaryingDefinition;

                    paintAttributes.vertexPragmas.define[attributeInnerName] = attributeVaryingDefinition + attributeAttributeDefinition;

                    paintAttributes.vertexPragmas.initialize[attributeInnerName] = [
                        attributeInnerName,
                        '=',
                        attributeInputName,
                        '/',
                        attribute.multiplier.toFixed(1)
                    ].join(' ') + ';\n';

                } else {

                    var tName = 'u_' + attributeInputName.slice(2) + '_t';
                    var zoomLevels = layer.getPaintValueStopZoomLevels(attribute.paintProperty);

                    // Pick the index of the first offset to add to the buffers.
                    // Find the four closest stops, ideally with two on each side of the zoom level.
                    var numStops = 0;
                    while (numStops < zoomLevels.length && zoomLevels[numStops] < bucket.zoom) numStops++;
                    var stopOffset = Math.max(0, Math.min(zoomLevels.length - 4, numStops - 2));

                    var fourZoomLevels = [];
                    for (var s = 0; s < 4; s++) {
                        fourZoomLevels.push(zoomLevels[Math.min(stopOffset + s, zoomLevels.length - 1)]);
                    }

                    attributeVaryingDefinition = [
                        'varying',
                        attributePrecision,
                        attributeType,
                        attributeInnerName
                    ].join(' ') + ';\n';

                    paintAttributes.vertexPragmas.define[attributeInnerName] = attributeVaryingDefinition + [
                        'uniform',
                        'lowp',
                        'float',
                        tName
                    ].join(' ') + ';\n';
                    paintAttributes.fragmentPragmas.define[attributeInnerName] = attributeVaryingDefinition;

                    paintAttributes.uniforms.push(util.extend({}, attribute, {
                        name: tName,
                        getValue: createGetUniform(attribute, stopOffset),
                        components: 1
                    }));

                    var components = attribute.components;
                    if (components === 1) {

                        paintAttributes.attributes.push(util.extend({}, attribute, {
                            getValue: createFunctionGetValue(attribute, fourZoomLevels),
                            isFunction: true,
                            components: components * 4
                        }));

                        paintAttributes.vertexPragmas.define[attributeInnerName] += [
                            'attribute',
                            attributePrecision,
                            'vec4',
                            attributeInputName
                        ].join(' ') + ';\n';

                        paintAttributes.vertexPragmas.initialize[attributeInnerName] = [
                            attributeInnerName,
                            '=',
                            'evaluate_zoom_function_1(' + attributeInputName + ', ' + tName + ')',
                            '/',
                            attribute.multiplier.toFixed(1)
                        ].join(' ') + ';\n';

                    } else {

                        var attributeInputNames = [];
                        for (var k = 0; k < 4; k++) {
                            attributeInputNames.push(attributeInputName + k);
                            paintAttributes.attributes.push(util.extend({}, attribute, {
                                getValue: createFunctionGetValue(attribute, [fourZoomLevels[k]]),
                                isFunction: true,
                                name: attributeInputName + k
                            }));
                            paintAttributes.vertexPragmas.define[attributeInnerName] += [
                                'attribute',
                                attributePrecision,
                                attributeType,
                                attributeInputName + k
                            ].join(' ') + ';\n';
                        }
                        paintAttributes.vertexPragmas.initialize[attributeInnerName] = [
                            attributeInnerName,
                            ' = ',
                            'evaluate_zoom_function_4(' + attributeInputNames.join(', ') + ', ' + tName + ')',
                            '/',
                            attribute.multiplier.toFixed(1)
                        ].join(' ') + ';\n';
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
            var values = [];
            for (var z = 0; z < stopZoomLevels.length; z++) {
                var stopZoomLevel = stopZoomLevels[z];
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
        var stopInterp = layer.getPaintInterpolationT(attribute.paintProperty, globalProperties.zoom);
        // We can only store four stop values in the buffers. stopOffset is the number of stops that come
        // before the stops that were added to the buffers.
        return [Math.max(0, Math.min(4, stopInterp - stopOffset))];
    };
}
