var Bucket = require('./bucket2');
var StyleLayer = require('../style/style_layer');
var StyleDeclarationSet = require('../style/style_declaration_set');

module.exports = function createCircleBucket(params) {

    return new Bucket({

        // TODO revisit all these params. Pare down.
        elementBuffer: 'circleElement',
        vertexBuffer: 'circleVertex',
        shader: 'circleShader',
        id: params.id,
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

                // TODO support setting raw values
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
                value: Bucket.createPaintStyleValue(params.layer, params.constants, params.z, 'circle-radius', 1),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 2
            },

            color: {
                value: Bucket.createPaintStyleValue(params.layer, params.constants, params.z, 'circle-color', 255),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 4
            },

            // TODO antialaising
            blur: {
                value: Bucket.createPaintStyleValue(params.layer, params.constants, params.z, 'circle-blur', 10),
                type: Bucket.AttributeTypes.UNSIGNED_BYTE,
                components: 1
            }
        }

    });

}

