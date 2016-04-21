'use strict';

var featureFilter = require('feature-filter');
var Buffer = require('./buffer');
var util = require('../util/util');
var StructArrayType = require('../util/struct_array');
var VertexArrayObject = require('../render/vertex_array_object');

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
 * @param options.layer A Mapbox GL style layer object
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

    if (options.elementGroups) {
        this.elementGroups = options.elementGroups;

        for (var programName in this.elementGroups) {
            var elementGroups = this.elementGroups[programName];
            if (elementGroups) {
                for (var i = 0; i < elementGroups.length; i++) {
                    var elementGroup = elementGroups[i];
                    elementGroup.vaos = {};
                    elementGroup.secondVaos = {};
                    for (var l = 0; l < this.childLayers.length; l++) {
                        var layerName = this.childLayers[l].id;
                        elementGroup.vaos[layerName] = new VertexArrayObject();
                        if (elementGroup.secondElementLength) {
                            elementGroup.secondVaos[layerName] = new VertexArrayObject();
                        }
                    }
                }
            }
        }

        this.buffers = util.mapObject(options.arrays, function(programArrays, programName) {
            return util.mapObject(programArrays, function(arrays, layoutOrPaint) {
                return util.mapObject(arrays, function(array, name) {
                    var arrayType = options.arrayTypes[programName][layoutOrPaint][name];
                    var type = (arrayType.members.length && arrayType.members[0].name === 'vertices' ? Buffer.BufferType.ELEMENT : Buffer.BufferType.VERTEX);
                    return new Buffer(array, arrayType, type);
                });
            });
        });
    }
}

/**
 * Build the buffers! Features are set directly to the `features` property.
 * @private
 */
Bucket.prototype.populateBuffers = function() {
    this.createArrays();
    this.recalculateStyleLayers();

    for (var i = 0; i < this.features.length; i++) {
        this.addFeature(this.features[i]);
    }

    this.trimArrays();
};

/**
 * Check if there is enough space available in the current element group for
 * `vertexLength` vertices. If not, append a new elementGroup. Should be called
 * by `populateBuffers` and its callees.
 * @private
 * @param {string} programName the name of the program associated with the buffer that will receive the vertices
 * @param {number} vertexLength The number of vertices that will be inserted to the buffer.
 */
Bucket.prototype.makeRoomFor = function(programName, numVertices) {
    var groups = this.elementGroups[programName];
    var currentGroup = groups.length && groups[groups.length - 1];

    if (!currentGroup || currentGroup.vertexLength + numVertices > 65535) {
        var layoutArrays = this.arrays[programName].layout;
        var vertexArray = layoutArrays.vertex;
        var elementArray = layoutArrays.element;
        var secondElementArray = layoutArrays.secondElement;

        currentGroup = {
            vertexStartIndex: vertexArray.length,
            elementStartIndex: elementArray && elementArray.length,
            secondElementStartIndex: secondElementArray && secondElementArray.length,
            elementLength: 0,
            vertexLength: 0,
            secondElementLength: 0,
            elementOffset: elementArray && elementArray.length * elementArray.bytesPerElement,
            secondElementOffset: secondElementArray && secondElementArray.length * secondElementArray.bytesPerElement,
            vertexOffset: vertexArray && vertexArray.length * vertexArray.bytesPerElement
        };
        groups.push(currentGroup);
    }

    return currentGroup;
};

/**
 * Start using a new shared `buffers` object and recreate instances of `Buffer`
 * as necessary.
 * @private
 */
Bucket.prototype.createArrays = function() {
    var elementGroups = this.elementGroups = {};
    this.arrays = {};
    this.arrayTypes = {};

    for (var programName in this.programInterfaces) {
        var programInterface = this.programInterfaces[programName];
        var programArrays = this.arrays[programName] = { layout: {}, paint: {} };
        var programArrayTypes = this.arrayTypes[programName] = { layout: {}, paint: {} };

        if (programInterface.vertexBuffer) {
            var VertexArrayType = new StructArrayType({
                members: this.programInterfaces[programName].layoutAttributes,
                alignment: Buffer.VERTEX_ATTRIBUTE_ALIGNMENT
            });

            programArrays.layout.vertex = new VertexArrayType();
            programArrayTypes.layout.vertex = VertexArrayType.serialize();

            var layerPaintAttributes = this.paintAttributes[programName];
            for (var layerName in layerPaintAttributes) {
                var PaintVertexArrayType = new StructArrayType({
                    members: layerPaintAttributes[layerName].attributes,
                    alignment: Buffer.VERTEX_ATTRIBUTE_ALIGNMENT
                });

                programArrays.paint[layerName] = new PaintVertexArrayType();
                programArrayTypes.paint[layerName] = PaintVertexArrayType.serialize();
            }
        }

        if (programInterface.elementBuffer) {
            var ElementArrayType = createElementBufferType(programInterface.elementBufferComponents);
            programArrays.layout.element = new ElementArrayType();
            programArrayTypes.layout.element = ElementArrayType.serialize();
        }

        if (programInterface.secondElementBuffer) {
            var SecondElementArrayType = createElementBufferType(programInterface.secondElementBufferComponents);
            programArrays.layout.secondElement = new SecondElementArrayType();
            programArrayTypes.layout.secondElement = SecondElementArrayType.serialize();
        }

        elementGroups[programName] = [];
    }
};

Bucket.prototype.destroy = function(gl) {
    for (var programName in this.buffers) {
        var programBuffers = this.buffers[programName];
        for (var paintBuffer in programBuffers.paint) {
            programBuffers.paint[paintBuffer].destroy(gl);
        }
        for (var layoutBuffer in programBuffers.layout) {
            programBuffers.layout[layoutBuffer].destroy(gl);
        }

        var elementGroups = this.elementGroups[programName];
        if (elementGroups) {
            for (var i = 0; i < elementGroups.length; i++) {
                var elementGroup = elementGroups[i];
                for (var j in elementGroup.vaos) {
                    elementGroup.vaos[j].destroy(gl);
                }
                for (var k in elementGroup.secondVaos) {
                    elementGroup.secondVaos[k].destroy(gl);
                }
            }
        }
    }

};

Bucket.prototype.trimArrays = function() {
    for (var programName in this.arrays) {
        var programArrays = this.arrays[programName];
        for (var paintArray in programArrays.paint) {
            programArrays.paint[paintArray].trim();
        }
        for (var layoutArray in programArrays.layout) {
            programArrays.layout[layoutArray].trim();
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
        elementGroups: this.elementGroups,
        arrays: util.mapObject(this.arrays, function(programArrays) {
            return util.mapObject(programArrays, function(arrays) {
                return util.mapObject(arrays, function(array) {
                    return array.serialize();
                });
            });
        }),
        arrayTypes: this.arrayTypes,

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

Bucket.prototype.getProgramMacros = function(programInterface, layer) {
    var macros = [];
    var attributes = this.paintAttributes[programInterface][layer.id].attributes;
    for (var i = 0; i < attributes.length; i++) {
        var attribute = attributes[i];
        macros.push('ATTRIBUTE_' + (attribute.isFunction ? 'ZOOM_FUNCTION_' : '') + attribute.name.toUpperCase());
    }
    return macros;
};

Bucket.prototype.addPaintAttributes = function(interfaceName, globalProperties, featureProperties, startIndex, endIndex) {
    for (var l = 0; l < this.childLayers.length; l++) {
        var layer = this.childLayers[l];
        var length = this.arrays[interfaceName].layout.vertex.length;
        var vertexArray = this.arrays[interfaceName].paint[layer.id];
        var attributes = this.paintAttributes[interfaceName][layer.id].attributes;
        for (var m = 0; m < attributes.length; m++) {
            var attribute = attributes[m];

            var value = attribute.getValue(layer, globalProperties, featureProperties);
            var multiplier = attribute.multiplier || 1;
            var components = attribute.components || 1;

            vertexArray.resize(length);
            for (var i = startIndex; i < endIndex; i++) {
                var vertex = vertexArray.get(i);
                for (var c = 0; c < components; c++) {
                    var memberName = components > 1 ? (attribute.name + c) : attribute.name;
                    vertex[memberName] = value[c] * multiplier;
                }
            }
        }
    }
};

function createElementBufferType(components) {
    return new StructArrayType({
        members: [{
            type: Buffer.ELEMENT_ATTRIBUTE_TYPE,
            name: 'vertices',
            components: components || 3
        }]
    });
}

function createPaintAttributes(bucket) {
    var attributes = {};
    for (var interfaceName in bucket.programInterfaces) {
        var layerPaintAttributes = attributes[interfaceName] = {};

        for (var c = 0; c < bucket.childLayers.length; c++) {
            var childLayer = bucket.childLayers[c];
            layerPaintAttributes[childLayer.id] = { attributes: [], uniforms: [] };
        }

        var interface_ = bucket.programInterfaces[interfaceName];
        if (!interface_.paintAttributes) continue;
        for (var i = 0; i < interface_.paintAttributes.length; i++) {
            var attribute = interface_.paintAttributes[i];

            for (var j = 0; j < bucket.childLayers.length; j++) {
                var layer = bucket.childLayers[j];
                var paintAttributes = layerPaintAttributes[layer.id];

                if (layer.isPaintValueFeatureConstant(attribute.paintProperty)) {
                    paintAttributes.uniforms.push(attribute);
                } else if (layer.isPaintValueZoomConstant(attribute.paintProperty)) {
                    paintAttributes.attributes.push(attribute);
                } else {

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

                    var components = attribute.components;
                    if (components === 1) {
                        paintAttributes.attributes.push(util.extend({}, attribute, {
                            getValue: createFunctionGetValue(attribute, fourZoomLevels),
                            isFunction: true,
                            components: components * 4
                        }));
                    } else {
                        for (var k = 0; k < 4; k++) {
                            paintAttributes.attributes.push(util.extend({}, attribute, {
                                getValue: createFunctionGetValue(attribute, [fourZoomLevels[k]]),
                                isFunction: true,
                                name: attribute.name + k
                            }));
                        }
                    }

                    paintAttributes.uniforms.push(util.extend({}, attribute, {
                        name: 'u_' + attribute.name.slice(2) + '_t',
                        getValue: createGetUniform(attribute, stopOffset),
                        components: 1
                    }));
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
