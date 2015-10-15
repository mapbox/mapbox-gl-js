'use strict';

var featureFilter = require('feature-filter');

var StyleDeclarationSet = require('../style/style_declaration_set');
var LayoutProperties = require('../style/layout_properties');
var ElementGroups = require('./element_groups');
var Buffer = require('./buffer');

module.exports = BufferBuilder;

/**
 * Instantiate the appropriate subclass of `BufferBuilder` for `options`.
 * @private
 * @param options See `BufferBuilder` constructor options
 * @returns {BufferBuilder}
 */
BufferBuilder.create = function(options) {
    var Classes = {
        fill: require('./fill_buffer_builder'),
        line: require('./line_buffer_builder'),
        circle: require('./circle_buffer_builder'),
        symbol: require('./symbol_buffer_builder')
    };
    return new Classes[options.layer.type](options);
};

/**
 * The `BufferBuilder` class builds a set of `Buffer`s for a set of vector tile
 * features.
 *
 * `BufferBuilder` is an abstract class. A subclass exists for each Mapbox GL
 * style spec layer type. Because `BufferBuilder` is an abstract class,
 * instances should be created via the `BufferBuilder.create` method.
 *
 * For performance reasons, `BufferBuilder` creates its "add"s methods at
 * runtime using `new Function(...)`.
 *
 * @class BufferBuilder
 * @private
 * @param options
 * @param {number} options.zoom Zoom level of the buffers being built. May be
 *     a fractional zoom level.
 * @param options.layer A Mapbox GL style layer object
 * @param {Object.<string, Buffer>} options.buffers The set of `Buffer`s being
 *     built for this tile. This object facilitates sharing of `Buffer`s be
       between `BufferBuilder`s.
 */
function BufferBuilder(options) {
    this.layer = options.layer;
    this.zoom = options.zoom;

    this.layers = [this.layer.id];
    this.features = [];
    this.id = this.layer.id;
    this['source-layer'] = this.layer['source-layer'];
    this.interactive = this.layer.interactive;
    this.minZoom = this.layer.minzoom;
    this.maxZoom = this.layer.maxzoom;
    this.filter = featureFilter(this.layer.filter);

    this.resetBuffers(options.buffers);

    this.layoutProperties = createLayoutProperties(this.layer, this.zoom);

    for (var shaderName in this.type.shaders) {
        var shader = this.type.shaders[shaderName];

        var vertexName = this.getAddVertexMethodName(shaderName);
        var elementName = this.getAddElementMethodName(shaderName, false);
        var secondElementName = this.getAddElementMethodName(shaderName, true);

        this[vertexName] = createVertexAddMethod(shaderName, shader);
        this[elementName] = createElementAddMethod(shaderName, shader, false);
        this[secondElementName] = createElementAddMethod(shaderName, shader, true);
    }
}

/**
 * Build the buffers! Features are set directly to the `features` property.
 * @private
 */
BufferBuilder.prototype.addFeatures = function() {
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
BufferBuilder.prototype.makeRoomFor = function(shaderName, vertexLength) {
    this.elementGroups[shaderName].makeRoomFor(vertexLength);
};

/**
 * Get the name of the generated "add vertex" method for a particular shader.
 * @private
 * @param {string} shaderName The name of the shader
 * @returns {string} The name of the method
 */
BufferBuilder.prototype.getAddVertexMethodName = function(shaderName) {
    var shader = this.type.shaders[shaderName];
    return 'add' + capitalize(shader.vertexBuffer);
};

/**
 * Get the name of the generated "add element" method for a particular shader.
 * @private
 * @param {string} shaderName The name of the shader
 * @param {bool} isSecond If true, return the name of the method for the second element buffer.
 * @returns {string} The name of the method
 */
BufferBuilder.prototype.getAddElementMethodName = function(shaderName, isSecond) {
    var shader = this.type.shaders[shaderName];
    var bufferName = isSecond ? shader.secondElementBuffer : shader.elementBuffer;

    if (bufferName) return 'add' + capitalize(bufferName);
    else return null;
};

/**
 * Start using a new shared `buffers` object and recreate instances of `Buffer`
 * as necessary.
 * @private
 * @param {Object.<string, Buffer>} buffers
 */
BufferBuilder.prototype.resetBuffers = function(buffers) {
    this.buffers = buffers;

    for (var shaderName in this.type.shaders) {
        var shader = this.type.shaders[shaderName];

        var vertexBufferName = shader.vertexBuffer;
        if (vertexBufferName && !buffers[vertexBufferName]) {
            buffers[vertexBufferName] = new Buffer({
                type: Buffer.BufferType.VERTEX,
                attributes: shader.attributes
            });
        }

        var elementBufferName = shader.elementBuffer;
        if (elementBufferName && !buffers[elementBufferName]) {
            buffers[elementBufferName] = createElementBuffer(shader.elementBufferComponents);
        }

        var secondElementBufferName = shader.secondElementBuffer;
        if (secondElementBufferName && !buffers[secondElementBufferName]) {
            buffers[secondElementBufferName] = createElementBuffer(shader.secondElementBufferComponents);
        }
    }

    this.elementGroups = createElementGroups(this.type.shaders, this.buffers);
};

function createLayoutProperties(layer, zoom) {
    var values = new StyleDeclarationSet('layout', layer.type, layer.layout, {}).values();
    var fakeZoomHistory = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 };

    var layout = {};
    for (var k in values) {
        layout[k] = values[k].calculate(zoom, fakeZoomHistory);
    }

    if (layer.type === 'symbol') {
        // To reduce the number of labels that jump around when zooming we need
        // to use a text-size value that is the same for all zoom levels.
        // This calculates text-size at a high zoom level so that all tiles can
        // use the same value when calculating anchor positions.
        if (values['text-size']) {
            layout['text-max-size'] = values['text-size'].calculate(18, fakeZoomHistory);
            layout['text-size'] = values['text-size'].calculate(zoom + 1, fakeZoomHistory);
        }
        if (values['icon-size']) {
            layout['icon-max-size'] = values['icon-size'].calculate(18, fakeZoomHistory);
            layout['icon-size'] = values['icon-size'].calculate(zoom + 1, fakeZoomHistory);
        }
    }

    return new LayoutProperties[layer.type](layout);
}

function createVertexAddMethod(shaderName, shader) {
    if (!shader.vertexBuffer) return null;

    // Find max arg length of all attribute value functions
    var argCount = 0;
    for (var i = 0; i < shader.attributes.length; i++) {
        var attribute = shader.attributes[i];
        argCount = Math.max(attribute.value.length, argCount);
    }

    var argIds = [];
    for (var j = 0; j < argCount; j++) {
        argIds.push('a' + j);
    }

    var body = '';
    body += 'var attributes = this.type.shaders.' + shaderName + '.attributes;\n';
    body += 'var elementGroups = this.elementGroups.' + shaderName + ';\n';
    body += 'elementGroups.current.vertexLength++;\n';
    body += 'return this.buffers.' + shader.vertexBuffer + '.push(\n';

    for (var k = 0; k < shader.attributes.length; k++) {
        body += '  attributes[' + k + '].value(' + argIds.join(', ') + ')';
        body += (k !== shader.attributes.length - 1) ? ',\n' : '';
    }
    body += '\n) - elementGroups.current.vertexStartIndex;';

    return new Function(argIds, body);
}

function createElementAddMethod(shaderName, shader, isSecond) {
    var bufferName = isSecond ? shader.secondElementBuffer : shader.elementBuffer;
    if (!bufferName) return null;
    var lengthName = isSecond ? 'secondElementLength' : 'elementLength';

    return function() {
        this.elementGroups[shaderName].current[lengthName]++;
        return this.buffers[bufferName].push(arguments);
    };
}

function createElementGroups(shaders, buffers) {
    var elementGroups = {};
    for (var shaderName in shaders) {
        var shader = shaders[shaderName];
        elementGroups[shaderName] = new ElementGroups(
            buffers[shader.vertexBuffer],
            buffers[shader.elementBuffer],
            buffers[shader.secondElementBuffer]
        );
    }
    return elementGroups;
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
