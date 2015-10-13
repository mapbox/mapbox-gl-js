'use strict';

var StyleDeclarationSet = require('../style/style_declaration_set');
var LayoutProperties = require('../style/layout_properties');
var ElementGroups = require('./element_groups');
var featureFilter = require('feature-filter');
var LayerType = require('../layer_type');
var util = require('../util/util');
var assert = require('assert');

module.exports = Bucket;

// TODO simplify the heck out of this
// TODO rename
function Bucket(buffers, options) {

    this.buffers = buffers;
    this.layer = options.layer;
    this.z = options.zoom;
    this.zoom = options.zoom;
    this.overscaling = options.overscaling;
    this.collisionDebug = options.collisionDebug;
    this.id = options.layer.id;
    this['source-layer'] = options.layer['source-layer'];
    this.interactive = options.layer.interactive;
    this.minZoom = options.layer.minzoom;
    this.maxZoom = options.layer.maxzoom;
    this.filter = featureFilter(options.layer.filter);
    this.features = [];
    this.elementGroups = {};
    util.extend(this, LayerType[options.layer.type]);

    var values = new StyleDeclarationSet('layout', this.layer.type, this.layer.layout, {}).values();
    var fakeZoomHistory = { lastIntegerZoom: Infinity, lastIntegerZoomTime: 0, lastZoom: 0 };
    var layout = {};
    for (var k in values) {
        layout[k] = values[k].calculate(this.zoom, fakeZoomHistory);
    }
    if (this.layer.type === 'symbol') {
        // To reduce the number of labels that jump around when zooming we need
        // to use a text-size value that is the same for all zoom levels.
        // This calculates text-size at a high zoom level so that all tiles can
        // use the same value when calculating anchor positions.
        if (values['text-size']) {
            layout['text-max-size'] = values['text-size'].calculate(18, fakeZoomHistory);
            layout['text-size'] = values['text-size'].calculate(this.zoom + 1, fakeZoomHistory);
        }
        if (values['icon-size']) {
            layout['icon-max-size'] = values['icon-size'].calculate(18, fakeZoomHistory);
            layout['icon-size'] = values['icon-size'].calculate(this.zoom + 1, fakeZoomHistory);
        }
    }
    this.layoutProperties = new LayoutProperties[this.layer.type](layout);

    var addVertex = (function(shaderName, args) {
        var shaderOptions = this.shaders[shaderName];

        var elementGroups = this.elementGroups[shaderName];
        elementGroups.current.vertexLength++;

        // TODO automatically handle makeRoomFor
        // TODO insert into element buffer directly?
        var value = {};
        for (var i = 0; i < shaderOptions.attributes.length; i++) {
            var attributeOptions = shaderOptions.attributes[i];
            var subvalue = attributeOptions.value.apply(this, args);

            assert(subvalue.length === attributeOptions.components);
            for (var j = 0; j < subvalue.length; j++) {
                assert(!isNaN(subvalue[j]), attributeOptions.name);
            }

            value[attributeOptions.name] = subvalue;
        }

        var vertexBufferName = shaderOptions.vertexBuffer;
        var vertexBuffer = this.buffers[vertexBufferName];
        return vertexBuffer.push(value) - elementGroups.current.vertexStartIndex;
    }).bind(this);

    var addElement = (function(shaderName, one, two, three) {
        var shaderOptions = this.shaders[shaderName];

        var elementGroups = this.elementGroups[shaderName];
        elementGroups.current.elementLength++;

        var elementBufferName = shaderOptions.elementBuffer;
        var elementBuffer = this.buffers[elementBufferName];

        assert(!isNaN(one) && !isNaN(two));

        return elementBuffer.push({vertices: [one, two, three]});
    }).bind(this);

    var addSecondElement = (function(shaderName, one, two, three) {
        var shaderOptions = this.shaders[shaderName];

        var elementGroups = this.elementGroups[shaderName];
        elementGroups.current.secondElementLength++;

        var secondElementBufferName = shaderOptions.secondElementBuffer;
        var secondElementBuffer = this.buffers[secondElementBufferName];

        assert(!isNaN(one) && !isNaN(two));

        return secondElementBuffer.push({vertices: [one, two, three]});
    }).bind(this);

    Object.keys(this.shaders).forEach(function(shaderName) {
        var shaderOptions = this.shaders[shaderName];

        var vertexBufferName = shaderOptions.vertexBuffer;
        var elementBufferName = shaderOptions.elementBuffer;
        var secondElementBufferName = shaderOptions.secondElementBuffer;

        this.elementGroups[shaderName] = new ElementGroups(
            this.buffers[vertexBufferName],
            this.buffers[elementBufferName],
            this.buffers[secondElementBufferName]
        );

        this['add' + capitalize(vertexBufferName)] = function() {
            return addVertex(shaderName, arguments);
        };

        if (elementBufferName) {
            this['add' + capitalize(elementBufferName)] = function(one, two, three) {
                return addElement(shaderName, one, two, three);
            };
        }

        if (secondElementBufferName) {
            this['add' + capitalize(secondElementBufferName)] = function(one, two, three) {
                return addSecondElement(shaderName, one, two, three);
            };
        }
    }, this);
}


function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
