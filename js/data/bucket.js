'use strict';

var featureFilter = require('feature-filter');
var Buffer = require('./buffer');
var util = require('../util/util');
var StructArrayType = require('../util/struct_array');

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
        this.buffers = util.mapObject(options.arrays, function(array, bufferName) {
            var arrayType = options.arrayTypes[bufferName];
            var type = (arrayType.members.length && arrayType.members[0].name === 'vertices' ? Buffer.BufferType.ELEMENT : Buffer.BufferType.VERTEX);
            return new Buffer(array, arrayType, type);
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
        var vertexArray = this.arrays[this.getBufferName(programName, 'vertex')];
        var elementArray = this.arrays[this.getBufferName(programName, 'element')];
        var secondElementArray = this.arrays[this.getBufferName(programName, 'secondElement')];

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
    var arrays = this.arrays = {};
    var arrayTypes = this.arrayTypes = {};

    for (var programName in this.programInterfaces) {
        var programInterface = this.programInterfaces[programName];

        if (programInterface.vertexBuffer) {
            var vertexBufferName = this.getBufferName(programName, 'vertex');

            var VertexArrayType = new StructArrayType({
                members: this.programInterfaces[programName].layoutAttributes,
                alignment: Buffer.VERTEX_ATTRIBUTE_ALIGNMENT
            });

            arrays[vertexBufferName] = new VertexArrayType();
            arrayTypes[vertexBufferName] = VertexArrayType.serialize();

            var layerPaintAttributes = this.paintAttributes[programName];
            for (var layerName in layerPaintAttributes) {
                var paintVertexBufferName = this.getBufferName(layerName, programName);

                var PaintVertexArrayType = new StructArrayType({
                    members: layerPaintAttributes[layerName].enabled,
                    alignment: Buffer.VERTEX_ATTRIBUTE_ALIGNMENT
                });

                arrays[paintVertexBufferName] = new PaintVertexArrayType();
                arrayTypes[paintVertexBufferName] = PaintVertexArrayType.serialize();
            }
        }

        if (programInterface.elementBuffer) {
            var elementBufferName = this.getBufferName(programName, 'element');
            var ElementArrayType = createElementBufferType(programInterface.elementBufferComponents);
            arrays[elementBufferName] = new ElementArrayType();
            arrayTypes[elementBufferName] = ElementArrayType.serialize();
        }

        if (programInterface.secondElementBuffer) {
            var secondElementBufferName = this.getBufferName(programName, 'secondElement');
            var SecondElementArrayType = createElementBufferType(programInterface.secondElementBufferComponents);
            arrays[secondElementBufferName] = new SecondElementArrayType();
            arrayTypes[secondElementBufferName] = SecondElementArrayType.serialize();
        }

        elementGroups[programName] = [];
    }
};

Bucket.prototype.destroy = function(gl) {
    for (var k in this.buffers) {
        this.buffers[k].destroy(gl);
    }
};

Bucket.prototype.trimArrays = function() {
    for (var bufferName in this.arrays) {
        this.arrays[bufferName].trim();
    }
};

/**
 * Set the attribute pointers in a WebGL context
 * @private
 * @param gl The WebGL context
 * @param program The active WebGL program
 * @param {number} offset The offset of the attribute data in the currently bound GL buffer.
 */
Bucket.prototype.setAttribPointers = function(programName, gl, program, offset) {
    var vertexBuffer = this.buffers[this.getBufferName(programName, 'vertex')];
    vertexBuffer.setVertexAttribPointers(gl, program, offset / vertexBuffer.itemSize);
};

Bucket.prototype.setUniforms = function(gl, programName, program, layer, globalProperties) {
    var disabledAttributes = this.paintAttributes[programName][layer.id].disabled;
    for (var i = 0; i < disabledAttributes.length; i++) {
        var attribute = disabledAttributes[i];
        var attributeId = program[attribute.name];
        gl['uniform' + attribute.components + 'fv'](attributeId, attribute.getValue(layer, globalProperties));
    }
};

Bucket.prototype.bindLayoutBuffers = function(programInterfaceName, gl, options) {
    var programInterface = this.programInterfaces[programInterfaceName];

    if (programInterface.vertexBuffer) {
        var vertexBuffer = this.buffers[this.getBufferName(programInterfaceName, 'vertex')];
        vertexBuffer.bind(gl);
    }

    if (programInterface.elementBuffer && (!options || !options.secondElement)) {
        var elementBuffer = this.buffers[this.getBufferName(programInterfaceName, 'element')];
        elementBuffer.bind(gl);
    }

    if (programInterface.secondElementBuffer && (options && options.secondElement)) {
        var secondElementBuffer = this.buffers[this.getBufferName(programInterfaceName, 'secondElement')];
        secondElementBuffer.bind(gl);
    }
};

Bucket.prototype.bindPaintBuffer = function(gl, interfaceName, layerID, program, vertexStartIndex) {
    var buffer = this.buffers[this.getBufferName(layerID, interfaceName)];
    buffer.bind(gl);
    buffer.setVertexAttribPointers(gl, program, vertexStartIndex);
};

/**
 * Get the name of a buffer.
 * @param {string} programName The name of the program that will use the buffer
 * @param {string} type One of "vertex", "element", or "secondElement"
 * @returns {string}
 */
Bucket.prototype.getBufferName = function(programName, type) {
    return programName + capitalize(type);
};

Bucket.prototype.serialize = function() {
    return {
        layerId: this.layer.id,
        zoom: this.zoom,
        elementGroups: this.elementGroups,
        arrays: util.mapObject(this.arrays, function(array) {
            return array.serialize();
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
    var enabledAttributes = this.paintAttributes[programInterface][layer.id].enabled;
    for (var i = 0; i < enabledAttributes.length; i++) {
        macros.push('ATTRIBUTE_' + enabledAttributes[i].name.toUpperCase());
    }
    return macros;
};

Bucket.prototype.addPaintAttributes = function(interfaceName, globalProperties, featureProperties, startIndex, endIndex) {
    for (var l = 0; l < this.childLayers.length; l++) {
        var layer = this.childLayers[l];
        var length = this.arrays[this.getBufferName(interfaceName, 'vertex')].length;
        var vertexArray = this.arrays[this.getBufferName(layer.id, interfaceName)];
        var enabled = this.paintAttributes[interfaceName][layer.id].enabled;
        for (var m = 0; m < enabled.length; m++) {
            var attribute = enabled[m];

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

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function createPaintAttributes(bucket) {
    var attributes = {};
    for (var interfaceName in bucket.programInterfaces) {
        var layerPaintAttributes = attributes[interfaceName] = {};

        for (var c = 0; c < bucket.childLayers.length; c++) {
            var childLayer = bucket.childLayers[c];
            layerPaintAttributes[childLayer.id] = { enabled: [], disabled: [] };
        }

        var interface_ = bucket.programInterfaces[interfaceName];
        if (!interface_.paintAttributes) continue;
        for (var i = 0; i < interface_.paintAttributes.length; i++) {
            var attribute = interface_.paintAttributes[i];

            for (var j = 0; j < bucket.childLayers.length; j++) {
                var layer = bucket.childLayers[j];
                var paintAttributes = layerPaintAttributes[layer.id];

                if (layer.isPaintValueFeatureConstant(attribute.paintProperty)) {
                    paintAttributes.disabled.push(attribute);
                } else {
                    paintAttributes.enabled.push(attribute);
                }
            }
        }
    }
    return attributes;
}
