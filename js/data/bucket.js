'use strict';

var featureFilter = require('feature-filter');
var Buffer = require('./buffer');
var StyleLayer = require('../style/style_layer');
var util = require('../util/util');

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

Bucket.AttributeType = Buffer.AttributeType;


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
 * @property {number}
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

    this.layer = StyleLayer.create(options.layer);
    this.layer.recalculate(this.zoom, { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 });

    this.layers = [this.layer.id];
    this.type = this.layer.type;
    this.features = [];
    this.id = this.layer.id;
    this['source-layer'] = this.layer['source-layer'];
    this.interactive = this.layer.interactive;
    this.minZoom = this.layer.minzoom;
    this.maxZoom = this.layer.maxzoom;
    this.filter = featureFilter(this.layer.filter);

    if (options.elementGroups) {
        this.elementGroups = options.elementGroups;
        this.buffers = util.mapObject(options.buffers, function(options) {
            return new Buffer(options);
        });
    } else {
        this.resetBuffers();
    }

    for (var shaderName in this.shaderInterfaces) {
        var shaderInterface = this.shaderInterfaces[shaderName];
        this[this.getAddMethodName(shaderName, 'vertex')] = createVertexAddMethod(
            shaderName,
            shaderInterface,
            this.getBufferName(shaderName, 'vertex')
        );
    }
}

/**
 * Build the buffers! Features are set directly to the `features` property.
 * @private
 */
Bucket.prototype.addFeatures = function() {
    for (var i = 0; i < this.features.length; i++) {
        this.addFeature(this.features[i]);
    }
};

/**
 * Check if there is enough space available in the current element group for
 * `vertexLength` vertices. If not, append a new elementGroup. Should be called
 * by `addFeatures` and its callees.
 * @private
 * @param {string} shaderName the name of the shader associated with the buffer that will receive the vertices
 * @param {number} vertexLength The number of vertices that will be inserted to the buffer.
 */
Bucket.prototype.makeRoomFor = function(shaderName, numVertices) {
    var groups = this.elementGroups[shaderName];
    var currentGroup = groups.length && groups[groups.length - 1];

    if (!currentGroup || currentGroup.vertexLength + numVertices > 65535) {
        var vertexBuffer = this.buffers[this.getBufferName(shaderName, 'vertex')];
        var elementBuffer = this.buffers[this.getBufferName(shaderName, 'element')];
        var secondElementBuffer = this.buffers[this.getBufferName(shaderName, 'secondElement')];

        currentGroup = new ElementGroup(
            vertexBuffer.length,
            elementBuffer && elementBuffer.length,
            secondElementBuffer && secondElementBuffer.length
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
Bucket.prototype.resetBuffers = function() {
    var elementGroups = this.elementGroups = {};
    var buffers = this.buffers = {};

    for (var shaderName in this.shaderInterfaces) {
        var shaderInterface = this.shaderInterfaces[shaderName];

        var vertexBufferName = this.getBufferName(shaderName, 'vertex');
        if (shaderInterface.vertexBuffer) {
            buffers[vertexBufferName] = new Buffer({
                type: Buffer.BufferType.VERTEX,
                attributes: shaderInterface.attributes
            });
        }

        if (shaderInterface.elementBuffer) {
            var elementBufferName = this.getBufferName(shaderName, 'element');
            buffers[elementBufferName] = createElementBuffer(shaderInterface.elementBufferComponents);
            this[this.getAddMethodName(shaderName, 'element')] = createElementAddMethod(this.buffers[elementBufferName]);
        }

        if (shaderInterface.secondElementBuffer) {
            var secondElementBufferName = this.getBufferName(shaderName, 'secondElement');
            buffers[secondElementBufferName] = createElementBuffer(shaderInterface.secondElementBufferComponents);
            this[this.getAddMethodName(shaderName, 'secondElement')] = createElementAddMethod(this.buffers[secondElementBufferName]);
        }

        elementGroups[shaderName] = [];
    }
};

Bucket.prototype.destroy = function(gl) {
    for (var k in this.buffers) {
        this.buffers[k].destroy(gl);
    }
};

/**
 * Get the name of the method used to add an item to a buffer.
 * @param {string} shaderName The name of the shader that will use the buffer
 * @param {string} type One of "vertex", "element", or "secondElement"
 * @returns {string}
 */
Bucket.prototype.getAddMethodName = function(shaderName, type) {
    return 'add' + capitalize(shaderName) + capitalize(type);
};

/**
 * Get the name of a buffer.
 * @param {string} shaderName The name of the shader that will use the buffer
 * @param {string} type One of "vertex", "element", or "secondElement"
 * @returns {string}
 */
Bucket.prototype.getBufferName = function(shaderName, type) {
    return shaderName + capitalize(type);
};

Bucket.prototype.serialize = function() {
    return {
        layer: this.layer.serialize(),
        zoom: this.zoom,
        elementGroups: this.elementGroups,
        buffers: util.mapObject(this.buffers, function(buffer) {
            return buffer.serialize();
        })
    };
};


var createVertexAddMethodCache = {};
function createVertexAddMethod(shaderName, shaderInterface, bufferName) {
    var pushArgs = [];
    for (var i = 0; i < shaderInterface.attributes.length; i++) {
        pushArgs = pushArgs.concat(shaderInterface.attributes[i].value);
    }

    var body = 'return this.buffers.' + bufferName + '.push(' + pushArgs.join(', ') + ');';

    if (!createVertexAddMethodCache[body]) {
        createVertexAddMethodCache[body] = new Function(shaderInterface.attributeArgs, body);
    }

    return createVertexAddMethodCache[body];
}

function createElementAddMethod(buffer) {
    return function(one, two, three) {
        return buffer.push(one, two, three);
    };
}

function createElementBuffer(components) {
    return new Buffer({
        type: Buffer.BufferType.ELEMENT,
        attributes: [{
            name: 'vertices',
            components: components || 3,
            type: Buffer.ELEMENT_ATTRIBUTE_TYPE
        }]
    });
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
