'use strict';

var featureFilter = require('feature-filter');

var ElementGroups = require('./element_groups');
var Buffer = require('./buffer');
var StyleLayer = require('../style/style_layer');

module.exports = Bucket;

/**
 * Instantiate the appropriate subclass of `Bucket` for `options`.
 * @private
 * @param options See `Bucket` constructor options
 * @returns {Bucket}
 */
Bucket.create = function(options) {
    var Classes = {
        fill: require('./fill_bucket'),
        line: require('./line_bucket'),
        circle: require('./circle_bucket'),
        symbol: require('./symbol_bucket')
    };
    return new Classes[options.layer.type](options);
};

Bucket.AttributeType = Buffer.AttributeType;

/**
 * The `Bucket` class builds a set of `Buffer`s for a set of vector tile
 * features.
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

    this.resetBuffers(options.buffers);

    for (var shaderName in this.shaders) {
        var shader = this.shaders[shaderName];
        this[this.getAddMethodName(shaderName, 'vertex')] = createVertexAddMethod(
            shaderName,
            shader,
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
Bucket.prototype.makeRoomFor = function(shaderName, vertexLength) {
    return this.elementGroups[shaderName].makeRoomFor(vertexLength);
};

/**
 * Start using a new shared `buffers` object and recreate instances of `Buffer`
 * as necessary.
 * @private
 * @param {Object.<string, Buffer>} buffers
 */
Bucket.prototype.resetBuffers = function(buffers) {
    this.buffers = buffers;
    this.elementGroups = {};

    for (var shaderName in this.shaders) {
        var shader = this.shaders[shaderName];

        var vertexBufferName = this.getBufferName(shaderName, 'vertex');
        if (shader.vertexBuffer && !buffers[vertexBufferName]) {
            buffers[vertexBufferName] = new Buffer({
                type: Buffer.BufferType.VERTEX,
                attributes: shader.attributes
            });
        }

        if (shader.elementBuffer) {
            var elementBufferName = this.getBufferName(shaderName, 'element');
            if (!buffers[elementBufferName]) {
                buffers[elementBufferName] = createElementBuffer(shader.elementBufferComponents);
            }
            this[this.getAddMethodName(shaderName, 'element')] = createElementAddMethod(this.buffers[elementBufferName]);
        }

        if (shader.secondElementBuffer) {
            var secondElementBufferName = this.getBufferName(shaderName, 'secondElement');
            if (!buffers[secondElementBufferName]) {
                buffers[secondElementBufferName] = createElementBuffer(shader.secondElementBufferComponents);
            }
            this[this.getAddMethodName(shaderName, 'secondElement')] = createElementAddMethod(this.buffers[secondElementBufferName]);
        }

        this.elementGroups[shaderName] = new ElementGroups(
            buffers[this.getBufferName(shaderName, 'vertex')],
            buffers[this.getBufferName(shaderName, 'element')],
            buffers[this.getBufferName(shaderName, 'secondElement')]
        );
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

var createVertexAddMethodCache = {};
function createVertexAddMethod(shaderName, shader, bufferName) {
    var pushArgs = [];
    for (var i = 0; i < shader.attributes.length; i++) {
        pushArgs = pushArgs.concat(shader.attributes[i].value);
    }

    var body = 'return this.buffers.' + bufferName + '.push(' + pushArgs.join(', ') + ');';

    if (!createVertexAddMethodCache[body]) {
        createVertexAddMethodCache[body] = new Function(shader.attributeArgs, body);
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
