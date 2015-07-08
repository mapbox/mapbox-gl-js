var Bucket = require('./bucket2');
var StyleLayer = require('../style/style_layer');
var StyleDeclarationSet = require('../style/style_declaration_set');

module.exports = function createCircleBucket(params) {

    return new Bucket({

        featureGenerator: params.featureGenerator,

        shader: 'circle',

        elementVertexGenerator: function(feature, vertexIndex, vertexCallback, elementIndex, elementCallback) {
            var extrudes = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
            var geometries = feature.loadGeometry()[0];

            for (var j = 0; j < geometries.length; j++) {
                for (var k = 0; k < extrudes.length; k++) {
                    vertexCallback({
                        extrude: extrudes[k],
                        geometry: geometries[j],
                        properties: feature.properties
                    });
                }

                // TODO support setting raw values
                elementCallback([vertexIndex + 0, vertexIndex + 1, vertexIndex + 2]);
                elementCallback([vertexIndex + 0, vertexIndex + 3, vertexIndex + 2]);
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
                value: createPaintStyleValue('circle-radius', 10),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 2
            },

            color: {
                value: createPaintStyleValue('circle-color', 255),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 4
            },

            // TODO antialaising
            blur: {
                value: createPaintStyleValue('circle-blur', 10),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 1
            }
        }

    });

    function createPaintStyleValue(styleName, multiplier) {

        // TODO Dont do this. Refactor style layer to provide this functionality.
        var layer = new StyleLayer(params.layer, params.constants);
        layer.recalculate(params.z, []);
        layer.resolvePaint();
        var declarations = new StyleDeclarationSet('paint', params.layer.type, params.layer.paint, params.constants).values();

        var declaration = declarations[styleName];

        if (declaration) {
            var calculate = declaration.calculate({$zoom: params.z});

            function inner(data) {
                return wrap(calculate(data.feature)).map(function(value) {
                    return value * multiplier;
                });
            }

            if (calculate.isFeatureConstant) {
                return inner({feature: {}});
            } else {
                return inner;
            }

        } else {
            // TODO classes
            return layer.getPaintProperty(styleName, '');
        }
    }

}

function wrap(value) {
    return Array.isArray(value) ? value : [ value ];
}
