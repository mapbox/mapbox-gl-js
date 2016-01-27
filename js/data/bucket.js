'use strict';

var featureFilter = require('feature-filter');
var Buffer = require('./buffer');
var StyleLayer = require('../style/style_layer');
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

    this.layerIDs = [this.layer.id];
    this.type = this.layer.type;
    this.features = [];
    this.id = this.layer.id;
    this.index = options.index;
    this.sourceLayer = this.layer.sourceLayer;
    this.sourceLayerIndex = options.sourceLayerIndex;
    this.minZoom = this.layer.minzoom;
    this.maxZoom = this.layer.maxzoom;

    this.createStyleLayer();
    this.attributes = {};
    for (var interfaceName in this.programInterfaces) {
        var interfaceAttributes = this.attributes[interfaceName] = { enabled: [], disabled: [] };
        var interface_ = this.programInterfaces[interfaceName];
        for (var i = 0; i < interface_.attributes.length; i++) {
            var attribute = interface_.attributes[i];
            if (isAttributeDisabled(this, attribute)) {
                interfaceAttributes.disabled.push(util.extend({
                    getValue: createGetAttributeValueMethod(this, interfaceName, attribute)
                }, attribute));
            } else {
                interfaceAttributes.enabled.push(attribute);
            }
        }
    }

    if (options.elementGroups) {
        this.elementGroups = options.elementGroups;
        this.buffers = util.mapObject(options.arrays, function(array, bufferName) {
            var arrayType = options.arrayTypes[bufferName];
            var type = (arrayType.members[0].name === 'vertices' ? Buffer.BufferType.ELEMENT : Buffer.BufferType.VERTEX);
            return new Buffer(array, arrayType, type);
        });
    }
}

function isAttributeDisabled(bucket, attribute) {
    if (attribute.isDisabled === undefined || attribute.isDisabled === false) {
        return false;
    } else if (attribute.isDisabled === true) {
        return true;
    } else {
        return !!attribute.isDisabled.call(bucket);
    }
}

/**
 * Build the buffers! Features are set directly to the `features` property.
 * @private
 */
Bucket.prototype.populateBuffers = function() {
    this.createStyleLayer();
    this.createArrays();

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

        currentGroup = new ElementGroup(
            vertexArray.length,
            elementArray && elementArray.length,
            secondElementArray && secondElementArray.length
        );
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
            var vertexAddMethodName = this.getAddMethodName(programName, 'vertex');

            var VertexArrayType = new StructArrayType({
                members: this.attributes[programName].enabled,
                alignment: Buffer.VERTEX_ATTRIBUTE_ALIGNMENT
            });

            arrays[vertexBufferName] = new VertexArrayType();
            arrayTypes[vertexBufferName] = VertexArrayType.serialize();

            this[vertexAddMethodName] = this[vertexAddMethodName] || createVertexAddMethod(
                programName,
                programInterface,
                this.getBufferName(programName, 'vertex'),
                this.attributes[programName].enabled
            );
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
 * Set the attribute pointers in a WebGL context
 * @private
 * @param gl The WebGL context
 * @param program The active WebGL program
 * @param {number} offset The offset of the attribute data in the currently bound GL buffer.
 * @param {Array} arguments to be passed to disabled attribute value functions
 */
Bucket.prototype.setAttribPointers = function(programName, gl, program, offset, args) {
    // Set disabled attributes
    var disabledAttributes = this.attributes[programName].disabled;
    for (var i = 0; i < disabledAttributes.length; i++) {
        var attribute = disabledAttributes[i];
        var attributeId = program['a_' + attribute.name];
        gl.disableVertexAttribArray(attributeId);
        gl['vertexAttrib' + attribute.components + 'fv'](attributeId, attribute.getValue.apply(this, args));
    }

    // Set enabled attributes
    this.buffers[this.getBufferName(programName, 'vertex')].setAttribPointers(gl, program, offset);
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
        layer: {
            id: this.layer.id,
            type: this.layer.type
        },
        zoom: this.zoom,
        elementGroups: this.elementGroups,
        arrays: util.mapObject(this.arrays, function(array) {
            return array.serialize();
        }),
        arrayTypes: this.arrayTypes
    };
};

Bucket.prototype.createStyleLayer = function(layer) {
    if (layer) {
        this.layer = layer;
    } else if (!(this.layer instanceof StyleLayer)) {
        this.layer = StyleLayer.create(this.layer);
        this.layer.updatePaintTransitions([], {transition: false});
        this.layer.recalculate(this.zoom, { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 });
    }
};

Bucket.prototype.createFilter = function() {
    if (!this.filter) {
        this.filter = featureFilter(this.layer.filter);
    }
};

Bucket.prototype._premultiplyColor = util.premultiply;


var createVertexAddMethodCache = {};
function createVertexAddMethod(programName, programInterface, bufferName, enabledAttributes) {
    var body = '';

    var pushArgs = [];
    for (var i = 0; i < enabledAttributes.length; i++) {
        var attribute = enabledAttributes[i];

        var attributePushArgs = [];
        if (Array.isArray(attribute.value)) {
            attributePushArgs = attribute.value;
        } else {
            var attributeId = '_' + i;
            body += 'var ' + attributeId + ' = ' + attribute.value + ';';
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
function createGetAttributeValueMethod(bucket, interfaceName, attribute) {
    if (!_getAttributeValueCache[interfaceName]) {
        _getAttributeValueCache[interfaceName] = {};
    }

    if (!_getAttributeValueCache[interfaceName][attribute.name]) {
        var bodyArgs = bucket.programInterfaces[interfaceName].attributeArgs;
        var body = 'return ';

        if (Array.isArray(attribute.value)) {
            body += '[' + attribute.value.join(', ') + ']';
        } else {
            body += attribute.value;
        }

        if (attribute.multiplier) {
            body += '.map(function(v) { return v * ' + attribute.multiplier + '; })';
        }

        _getAttributeValueCache[interfaceName][attribute.name] = new Function(bodyArgs, body);
    }

    return _getAttributeValueCache[interfaceName][attribute.name];
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function ElementGroup(vertexStartIndex, elementStartIndex, secondElementStartIndex) {
    // the offset into the vertex buffer of the first vertex in this group
    this.vertexStartIndex = vertexStartIndex;
    this.elementStartIndex = elementStartIndex;
    this.secondElementStartIndex = secondElementStartIndex;
    this.elementLength = 0;
    this.vertexLength = 0;
    this.secondElementLength = 0;
}
