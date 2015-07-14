var Bucket = require('./bucket2');
var StyleLayer = require('../style/style_layer');
var StyleDeclarationSet = require('../style/style_declaration_set');
var MapboxGLFunction = require('mapbox-gl-function');
var util = require('../util/util');

module.exports = function createCircleBucket(params) {

    var styleLayer = new StyleLayer(params.layer, params.constants);
    styleLayer.recalculate(params.z, []);
    styleLayer.resolveLayout();
    styleLayer.resolvePaint();

    return new Bucket({
        layer: params.layer,

        shader: 'circleShader',
        disableStencilTest: true,

        elementBuffer: 'circleElement',
        vertexBuffer: 'circleVertex',
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
                type: Bucket.AttributeType.SHORT,
                components: 2
            },

            size: {
                value: createPaintStyleValue('circle-radius', 10),
                type: Bucket.AttributeType.UNSIGNED_BYTE,
                components: 1
            },

            color: {
                value: createPaintStyleValue('circle-color', 255),
                type: Bucket.AttributeType.UNSIGNED_BYTE,
                components: 4
            },

            opacity: {
                value: createPaintStyleValue('circle-opacity', 255),
                type: Bucket.AttributeType.UNSIGNED_BYTE,
                components: 1
            },

            blur: {
                value: createBlurValue('circle-blur', 10),
                type: Bucket.AttributeType.UNSIGNED_BYTE,
                components: 1
            }
        }

    });

    function createBlurValue(styleName, multiplier) {
        var blurValue = createPaintStyleValue(styleName, 1);
        var radiusValue = createPaintStyleValue('circle-radius', 1);

        function applyAntialiasing(data) {
            var innerBlurValue = blurValue instanceof Function ? blurValue(data) : blurValue;
            var innerRadiusValue = radiusValue instanceof Function ? radiusValue(data) : radiusValue;

            return [Math.max(1 / params.devicePixelRatio / innerRadiusValue[0], innerBlurValue[0]) * multiplier];
        }

        if (blurValue instanceof Function || radiusValue instanceof Function) {
            return function(data) {
                return applyAntialiasing(data)
            }
        } else {
            return applyAntialiasing({});
        }

    }

    // TODO this should get refactored along with all the style infrastructure to handle data
    // driven styling more elegantly
    function createPaintStyleValue(styleName, multiplier) {
        // TODO support classes
        var calculateGlobal = MapboxGLFunction(styleLayer.getPaintProperty(styleName, ''));
        var calculate = calculateGlobal({$zoom: params.z});

        function inner(data) {
            util.assert(data.properties, 'The elementVertexGenerator must provide feature properties');
            return wrap(calculate(data.properties)).map(function(value) {
                return value * multiplier;
            });
        }

        if (calculate.isFeatureConstant) {
            return inner({properties: {}});
        } else {
            return inner;
        }

    }
}


function wrap(value) {
    return Array.isArray(value) ? value : [ value ];
}

