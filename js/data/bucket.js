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
 * For performance reasons, `Bucket` creates its "add"s methods at
 * runtime using `new Function(...)`.
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

    this.attributes = createAttributes(this);

    if (options.elementGroups) {
        this.elementGroups = options.elementGroups;
        this.buffers = util.mapObject(options.arrays, function(array, bufferName) {
            var arrayType = options.arrayTypes[bufferName];
            var type = (arrayType.members[0].name === 'vertices' ? Buffer.BufferType.ELEMENT : Buffer.BufferType.VERTEX);
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
            var vertexAddMethodName = this.getAddMethodName(programName, 'vertex');
            var vertexBufferName = this.getBufferName(programName, 'vertex');

            var VertexArrayType = new StructArrayType({
                members: this.attributes[programName].enabled,
                alignment: Buffer.VERTEX_ATTRIBUTE_ALIGNMENT
            });

            arrays[vertexBufferName] = new VertexArrayType();
            arrayTypes[vertexBufferName] = VertexArrayType.serialize();

            this[vertexAddMethodName] = this[vertexAddMethodName] || createVertexAddMethod(this, programName);
        }

        if (programInterface.elementBuffer) {
            var elementBufferName = this.getBufferName(programName, 'element');
            var ElementArrayType = createElementBufferType(programInterface.elementBufferComponents);
            arrays[elementBufferName] = new ElementArrayType();
            arrayTypes[elementBufferName] = ElementArrayType.serialize();
            this[this.getAddMethodName(programName, 'element')] = createElementAddMethod(this.arrays[elementBufferName]);
        }

        if (programInterface.secondElementBuffer) {
            var secondElementBufferName = this.getBufferName(programName, 'secondElement');
            var SecondElementArrayType = createElementBufferType(programInterface.secondElementBufferComponents);
            arrays[secondElementBufferName] = new SecondElementArrayType();
            arrayTypes[secondElementBufferName] = SecondElementArrayType.serialize();
            this[this.getAddMethodName(programName, 'secondElement')] = createElementAddMethod(this.arrays[secondElementBufferName]);
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
 * @enum {string} AttributeType
 * @private
 * @readonly
 */
var AttributeType = {
    Int8:   'BYTE',
    Uint8:  'UNSIGNED_BYTE',
    Int16:  'SHORT',
    Uint16: 'UNSIGNED_SHORT'
};

/**
 * Set the attribute pointers in a WebGL context
 * @private
 * @param gl The WebGL context
 * @param program The active WebGL program
 * @param {number} offset The offset of the attribute data in the currently bound GL buffer.
 * @param {Array} arguments to be passed to disabled attribute value functions
 */
Bucket.prototype.setAttribPointers = function(programName, gl, program, offset, layer, args) {
    var attribute;

    // Set disabled attributes
    var disabledAttributes = this.attributes[programName].disabled;
    for (var i = 0; i < disabledAttributes.length; i++) {
        attribute = disabledAttributes[i];
        if (attribute.isLayerConstant === false && layer.id !== attribute.layerId) continue;

        var attributeId = program[attribute.programName];
        gl['uniform' + attribute.components + 'fv'](attributeId, attribute.getValue.apply(this, args));
    }

    // Set enabled attributes
    var enabledAttributes = this.attributes[programName].enabled;
    var vertexBuffer = this.buffers[this.getBufferName(programName, 'vertex')];

    for (var j = 0; j < enabledAttributes.length; j++) {
        attribute = enabledAttributes[j];
        if (attribute.isLayerConstant === false && layer.id !== attribute.layerId) continue;
        if (!getMember(attribute.name)) continue;

        gl.vertexAttribPointer(
            program[attribute.programName],
            attribute.components,
            gl[AttributeType[attribute.type]],
            false,
            vertexBuffer.arrayType.bytesPerElement,
            offset + getMember(attribute.name).offset
        );
    }

    function getMember(memberName) {
        var members = vertexBuffer.arrayType.members;
        for (var k = 0; k < members.length; k++) {
            var member = members[k];
            if (member.name === memberName) {
                return member;
            }
        }
    }
};

Bucket.prototype.bindBuffers = function(programInterfaceName, gl, options) {
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

/**
 * Get the name of the method used to add an item to a buffer.
 * @param {string} programName The name of the program that will use the buffer
 * @param {string} type One of "vertex", "element", or "secondElement"
 * @returns {string}
 */
Bucket.prototype.getAddMethodName = function(programName, type) {
    return 'add' + capitalize(programName) + capitalize(type);
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

Bucket.prototype._premultiplyColor = util.premultiply;

var FAKE_ZOOM_HISTORY = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 };
Bucket.prototype.recalculateStyleLayers = function() {
    for (var i = 0; i < this.childLayers.length; i++) {
        this.childLayers[i].recalculate(this.zoom, FAKE_ZOOM_HISTORY);
    }
};

Bucket.prototype.getUseProgramTokens = function(programInterface, layer) {
    var tokens = {};

    var enabledAttributes = this.attributes[programInterface].enabled;
    for (var i = 0; i < enabledAttributes.length; i++) {
        var enabledAttribute = enabledAttributes[i];
        if (enabledAttribute.isLayerConstant || enabledAttribute.layerId === layer.id) {
            tokens[enabledAttribute.typeTokenName] = 'attribute';
        }
    }

    var disabledAttributes = this.attributes[programInterface].disabled;
    for (var j = 0; j < this.attributes[programInterface].disabled.length; j++) {
        var disabledAttribute = disabledAttributes[j];
        if (disabledAttribute.isLayerConstant || disabledAttribute.layerId === layer.id) {
            tokens[disabledAttribute.typeTokenName] = 'uniform';
        }
    }

    return tokens;
};

var createVertexAddMethodCache = {};
function createVertexAddMethod(bucket, interfaceName) {
    var enabledAttributes = bucket.attributes[interfaceName].enabled;
    var programInterface = bucket.programInterfaces[interfaceName];

    var body = 'var layer;\n';

    var pushArgs = [];

    for (var i = 0; i < enabledAttributes.length; i++) {
        var attribute = enabledAttributes[i];

        var attributePushArgs = [];
        if (Array.isArray(attribute.value)) {
            attributePushArgs = attributePushArgs.concat(attribute.value);
            attributePushArgs[0] = 'layer = this.childLayers[' + attribute.layerIndex + '] &&' + attributePushArgs[0];
        } else {
            body += 'layer = this.childLayers[' + attribute.layerIndex + '];\n';
            var attributeId = '_' + i;
            body += 'var ' + attributeId + ' = ' + attribute.value + ';\n';
            for (var j = 0; j < attribute.components; j++) {
                attributePushArgs.push(attributeId + '[' + j + ']');
            }
        }

        var multipliedAttributePushArgs;
        if (attribute.multiplier) {
            multipliedAttributePushArgs = [];
            for (var k = 0; k < attributePushArgs.length; k++) {
                multipliedAttributePushArgs[k] = attributePushArgs[k] + '*' + attribute.multiplier;
            }
        } else {
            multipliedAttributePushArgs = attributePushArgs;
        }

        pushArgs = pushArgs.concat(multipliedAttributePushArgs);
    }

    var bufferName = bucket.getBufferName(interfaceName, 'vertex');
    body += 'return this.arrays.' + bufferName + '.emplaceBack(' + pushArgs.join(',') + ');';

    if (!createVertexAddMethodCache[body]) {
        createVertexAddMethodCache[body] = new Function(programInterface.attributeArgs, body);
    }

    return createVertexAddMethodCache[body];
}

function createElementAddMethod(buffer) {
    return function(one, two, three) {
        return buffer.emplaceBack(one, two, three);
    };
}

function createElementBufferType(components) {
    return new StructArrayType({
        members: [{
            type: Buffer.ELEMENT_ATTRIBUTE_TYPE,
            name: 'vertices',
            components: components || 3
        }]
    });
}

var _getAttributeValueCache = {};
function createGetAttributeValueMethod(bucket, interfaceName, attribute, layerIndex) {
    if (!_getAttributeValueCache[interfaceName]) {
        _getAttributeValueCache[interfaceName] = {};
    }

    if (!_getAttributeValueCache[interfaceName][attribute.name]) {
        var bodyArgs = bucket.programInterfaces[interfaceName].attributeArgs;
        var body = '';

        body += 'var layer = this.childLayers[' + layerIndex + '];\n';

        if (Array.isArray(attribute.value)) {
            body += 'return [' + attribute.value.join(', ') + ']';
        } else {
            body += 'return ' + attribute.value;
        }

        if (attribute.multiplier) {
            body += '.map(function(v) { return v * ' + attribute.multiplier + '; })';
        }
        body += ';';

        _getAttributeValueCache[interfaceName][attribute.name] = new Function(bodyArgs, body);
    }

    return _getAttributeValueCache[interfaceName][attribute.name];
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function createAttributes(bucket) {
    var attributes = {};
    for (var interfaceName in bucket.programInterfaces) {
        var interfaceAttributes = attributes[interfaceName] = { enabled: [], disabled: [] };
        var interface_ = bucket.programInterfaces[interfaceName];
        for (var i = 0; i < interface_.attributes.length; i++) {
            var attribute = interface_.attributes[i];
            for (var j = 0; j < bucket.childLayers.length; j++) {
                var layer = bucket.childLayers[j];
                var isLayerConstant = attribute.isLayerConstant === true || attribute.isLayerConstant === undefined;
                if (isLayerConstant && layer.id !== bucket.layer.id) continue;
                if (isAttributeDisabled(bucket, attribute, layer)) {
                    interfaceAttributes.disabled.push(util.extend({}, attribute, {
                        getValue: createGetAttributeValueMethod(bucket, interfaceName, attribute, j),
                        name: layer.id + '__' + attribute.name,
                        programName: 'a_' + attribute.name,
                        layerId: layer.id,
                        layerIndex: j,
                        typeTokenName: attribute.name + 'Type',
                        isLayerConstant: isLayerConstant
                    }));
                } else {
                    interfaceAttributes.enabled.push(util.extend({}, attribute, {
                        name: layer.id + '__' + attribute.name,
                        programName: 'a_' + attribute.name,
                        layerId: layer.id,
                        layerIndex: j,
                        typeTokenName: attribute.name + 'Type',
                        isLayerConstant: isLayerConstant
                    }));
                }
            }
        }
    }
    return attributes;
}


function isAttributeDisabled(bucket, attribute, layer) {
    if (attribute.isDisabled === undefined || attribute.isDisabled === false) {
        return false;
    } else if (attribute.isDisabled === true) {
        return true;
    } else {
        return !!attribute.isDisabled.call(bucket, layer);
    }
}
