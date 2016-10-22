'use strict';

const Bucket = require('../bucket');
const VertexArrayType = require('../vertex_array_type');
const ElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');

const circleInterfaces = {
    circle: {
        layoutVertexArrayType: new VertexArrayType([{
            name: 'a_pos',
            components: 2,
            type: 'Int16'
        }]),
        elementArrayType: new ElementArrayType(),

        paintAttributes: [{
            name: 'a_color',
            components: 4,
            type: 'Uint8',
            getValue: (layer, globalProperties, featureProperties) => {
                return layer.getPaintValue("circle-color", globalProperties, featureProperties);
            },
            multiplier: 255,
            paintProperty: 'circle-color'
        }, {
            name: 'a_radius',
            components: 1,
            type: 'Uint16',
            isLayerConstant: false,
            getValue: (layer, globalProperties, featureProperties) => {
                return [layer.getPaintValue("circle-radius", globalProperties, featureProperties)];
            },
            multiplier: 10,
            paintProperty: 'circle-radius'
        }, {
            name: 'a_blur',
            components: 1,
            type: 'Uint16',
            isLayerConstant: false,
            getValue: (layer, globalProperties, featureProperties) => {
                return [layer.getPaintValue("circle-blur", globalProperties, featureProperties)];
            },
            multiplier: 10,
            paintProperty: 'circle-blur'
        }, {
            name: 'a_opacity',
            components: 1,
            type: 'Uint16',
            isLayerConstant: false,
            getValue: (layer, globalProperties, featureProperties) => {
                return [layer.getPaintValue("circle-opacity", globalProperties, featureProperties)];
            },
            multiplier: 255,
            paintProperty: 'circle-opacity'
        }]
    }
};

function addCircleVertex(layoutVertexArray, x, y, extrudeX, extrudeY) {
    return layoutVertexArray.emplaceBack(
        (x * 2) + ((extrudeX + 1) / 2),
        (y * 2) + ((extrudeY + 1) / 2));
}

/**
 * Circles are represented by two triangles.
 *
 * Each corner has a pos that is the center of the circle and an extrusion
 * vector that is where it points.
 * @private
 */
class CircleBucket extends Bucket {

    get programInterfaces() {
        return circleInterfaces;
    }

    addFeature(feature) {
        const startGroup = this.prepareArrayGroup('circle', 0);
        const startIndex = startGroup.layoutVertexArray.length;

        for (const ring of loadGeometry(feature)) {
            for (const point of ring) {
                const x = point.x;
                const y = point.y;

                // Do not include points that are outside the tile boundaries.
                if (x < 0 || x >= EXTENT || y < 0 || y >= EXTENT) continue;

                // this geometry will be of the Point type, and we'll derive
                // two triangles from it.
                //
                // ┌─────────┐
                // │ 3     2 │
                // │         │
                // │ 0     1 │
                // └─────────┘

                const group = this.prepareArrayGroup('circle', 4);
                const layoutVertexArray = group.layoutVertexArray;

                const index = addCircleVertex(layoutVertexArray, x, y, -1, -1);
                addCircleVertex(layoutVertexArray, x, y, 1, -1);
                addCircleVertex(layoutVertexArray, x, y, 1, 1);
                addCircleVertex(layoutVertexArray, x, y, -1, 1);

                group.elementArray.emplaceBack(index, index + 1, index + 2);
                group.elementArray.emplaceBack(index, index + 3, index + 2);
            }
        }

        this.populatePaintArrays('circle', {zoom: this.zoom}, feature.properties, startGroup, startIndex);
    }
}

module.exports = CircleBucket;
