var Bucket = require('./bucket2');
var StyleLayer = require('../style/style_layer');
var StyleDeclarationSet = require('../style/style_declaration_set');
var MapboxGLFunction = require('mapbox-gl-function');

module.exports = function createCircleBucket(params) {

    return new Bucket({

        elementBuffer: 'circleElement',
        vertexBuffer: 'circleVertex',
        shader: 'circleShader',
        id: params.id,

        // TODO remove these two params
        layer: params.layer,
        buffers: params.buffers,

        elementVertexGenerator: function(feature, vertexCallback, elementCallback) {
            var extrudes = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
            var geometries = feature.loadGeometry()[0];
            var vertexIndicies = [];

            for (var j = 0; j < geometries.length; j++) {
                for (var k = 0; k < extrudes.length; k++) {
                    vertexIndicies.push(vertexCallback({
                        extrude: extrudes[k],
                        geometry: geometries[j],
                        properties: feature.properties
                    }));
                }

                elementCallback([vertexIndicies[0], vertexIndicies[1], vertexIndicies[2]]);
                elementCallback([vertexIndicies[0], vertexIndicies[3], vertexIndicies[2]]);
            }
        },

        vertexAttributes: {

            pos: {
                value: function(data) { return [
                    (data.geometry.x * 2) + ((data.extrude[0] + 1) / 2),
                    (data.geometry.y * 2) + ((data.extrude[1] + 1) / 2)
                ]},
                type: Bucket.AttributeTypes.SHORT,
                components: 2
            },

            size: {
                value: createPaintStyleValue(params.layer, params.constants, params.z, 'circle-radius', 10),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 1
            },

            color: {
                value: createPaintStyleValue(params.layer, params.constants, params.z, 'circle-color', 255),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 4
            },

            opacity: {
                value: createPaintStyleValue(params.layer, params.constants, params.z, 'circle-opacity', 255),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 1
            },

            // TODO antialaising
            blur: {
                value: createPaintStyleValue(params.layer, params.constants, params.z, 'circle-blur', 10),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 1
            }
        }

    });

}

// TODO this should mostly live on StyleLayer or PaintDeclaration
// TODO simplify parameters
// TODO ensure cachable values are cached
function createPaintStyleValue(layer, constants, zoom, styleName, multiplier) {
    // TODO Dont do this. Refactor style layer to provide this functionality.
    var layer = new StyleLayer(layer, constants);
    layer.recalculate(zoom, []);
    layer.resolvePaint();

    // TODO classes
    var calculateGlobal = MapboxGLFunction(layer.getPaintProperty(styleName, ''));

    var calculate = calculateGlobal({$zoom: zoom});

    function inner(data) {
        return wrap(calculate(data.properties)).map(function(value) {
            return value * multiplier;
        });
    }

    if (calculate.isFeatureConstant) {
        return inner({feature: {}});
    } else {
        return inner;
    }

}

function wrap(value) {
    return Array.isArray(value) ? value : [ value ];
}

