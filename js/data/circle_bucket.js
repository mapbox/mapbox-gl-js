'use strict';

var ElementGroups = require('./element_groups');

module.exports = CircleBucket;

var PROPERTIES = [
    {
        styleName: 'circle-color',
        styleType: 'color',
        name: 'color',
        glWidth: 4,
        glType: '4fv'
    },
    {
        styleName: 'circle-blur',
        styleType: 'number',
        name: 'blur',
        glWidth: 1,
        glType: '1f'
    },
    {
        styleName: 'circle-radius',
        styleType: 'number',
        name: 'size',
        glWidth: 1,
        glType: '1f'
    }
];

/**
 * A container for all circle data
 *
 * Circles are represented by two triangles.
 *
 * Each corner has a pos that is the center of the circle and an extrusion
 * vector that is where it points.
 */
function CircleBucket(buffers) {
    this.buffers = buffers;

}

CircleBucket.prototype.addFeatures = function() {

    var offsets = {};
    var partiallyEvaluated = {};
    var layer = this.layers[0];
    var declarations = this.layerPaintDeclarations[layer];

    for (var i = 0; i < PROPERTIES.length; i++) {
        var property = PROPERTIES[i];
        var declaration = declarations[property.styleName];
        if (declaration && !declaration.calculate.isFeatureConstant) {
            offsets[property.styleName] = true;
            partiallyEvaluated[property.styleName] = declaration.calculate({$zoom: this.zoom});
        }
    }

    // If circle radii are heterogeneous and no blur is set, we must calculate antialiasing
    // blur per feature.
    if (offsets['circle-radius'] && !declarations['circle-blur']) {
        offsets['circle-blur'] = true;
        partiallyEvaluated['circle-blur'] = function(values) {
            return 10 / this.devicePixelRatio / partiallyEvaluated['circle-radius'](values);
        };

    // If a blur function is set, multiply the output by 255 and ensure the blur is always
    // greater than the antialiasing value.
    } else if (offsets['circle-blur']) {
        var antialiasing = 1 / this.devicePixelRatio / declarations['circle-radius'].value;
        var inner = partiallyEvaluated['circle-blur'];
        partiallyEvaluated['circle-blur'] = function(values) {
            return Math.max(inner(values), antialiasing) * 10;
        };
    }

    // TODO apply Math.max operation to blurs otherwise

    this.elementGroups = new ElementGroups(this.buffers.circleVertex, this.buffers.circleElement);
    this.elementGroups.offsets = offsets;

    for (i = 0; i < this.features.length; i++) {
        var feature = this.features[i];
        var geometries = feature.loadGeometry()[0];
        for (var j = 0; j < geometries.length; j++) {
            this.elementGroups.makeRoomFor(6);
            var x = geometries[j].x;
            var y = geometries[j].y;

            var elementIndex = this.buffers.circleVertex.index - this.elementGroups.current.vertexStartIndex;

            // this geometry will be of the Point type, and we'll derive
            // two triangles from it.
            //
            // ┌─────────┐
            // │ 4     3 │
            // │         │
            // │ 1     2 │
            // └─────────┘
            //

            var extrudes = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

            for (var k = 0; k < extrudes.length; k++) {

                var item = {};

                item.pos = [
                    (x * 2) + ((extrudes[k][0] + 1) / 2),
                    (y * 2) + ((extrudes[k][1] + 1) / 2)
                ];

                for (var s = 0; s < PROPERTIES.length; s++) {
                    property = PROPERTIES[s];
                    if (offsets[property.styleName] !== undefined) {
                        var value = partiallyEvaluated[property.styleName](this.features[i].properties);

                        if (property.name === 'circle-color') {
                            value = [value[0] * 255, value[1] * 255, value[2] * 255, value[3] * 255];
                        } else if (property.name === 'circle-blur') {
                            value = value * 10;
                        }

                        item[property.name] = value;
                    }
                }

                this.buffers.circleVertex.add(item);
            }

            // 1, 2, 3
            // 1, 4, 3
            this.elementGroups.elementBuffer.add(elementIndex, elementIndex + 1, elementIndex + 2);
            this.elementGroups.elementBuffer.add(elementIndex, elementIndex + 3, elementIndex + 2);

            this.elementGroups.current.vertexLength += 4;
            this.elementGroups.current.elementLength += 2;
        }
    }
};
