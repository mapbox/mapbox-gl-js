'use strict';

const Bucket = require('../bucket');
const VertexArrayType = require('../vertex_array_type');
const ElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const EARCUT_MAX_RINGS = 500;

const fillInterfaces = {
    fill: {
        layoutVertexArrayType: new VertexArrayType([{
            name: 'a_pos',
            components: 2,
            type: 'Int16'
        }]),
        elementArrayType: new ElementArrayType(1),
        elementArrayType2: new ElementArrayType(2),

        paintAttributes: [{
            name: 'a_color',
            components: 4,
            type: 'Uint8',
            getValue: (layer, globalProperties, featureProperties) => {
                return layer.getPaintValue("fill-color", globalProperties, featureProperties);
            },
            multiplier: 255,
            paintProperty: 'fill-color'
        }, {
            name: 'a_outline_color',
            components: 4,
            type: 'Uint8',
            getValue: (layer, globalProperties, featureProperties) => {
                return layer.getPaintValue("fill-outline-color", globalProperties, featureProperties);
            },
            multiplier: 255,
            paintProperty: 'fill-outline-color'
        }, {
            name: 'a_opacity',
            components: 1,
            type: 'Uint8',
            getValue: (layer, globalProperties, featureProperties) => {
                return [layer.getPaintValue("fill-opacity", globalProperties, featureProperties)];
            },
            multiplier: 255,
            paintProperty: 'fill-opacity'
        }]
    }
};

class FillBucket extends Bucket {
    get programInterfaces() {
        return fillInterfaces;
    }

    addFeature(feature) {
        const startGroup = this.prepareArrayGroup('fill', 0);
        const startIndex = startGroup.layoutVertexArray.length;

        for (const polygon of classifyRings(loadGeometry(feature), EARCUT_MAX_RINGS)) {
            let numVertices = 0;
            for (const ring of polygon) {
                numVertices += ring.length;
            }

            const group = this.prepareArrayGroup('fill', numVertices);
            const startIndex = group.layoutVertexArray.length;

            const flattened = [];
            const holeIndices = [];

            for (let r = 0; r < polygon.length; r++) {
                const ring = polygon[r];

                if (r > 0) {
                    holeIndices.push(flattened.length / 2);
                }

                for (let p = 0; p < ring.length; p++) {
                    const point = ring[p];

                    const index = group.layoutVertexArray.emplaceBack(point.x, point.y);

                    if (p >= 1) {
                        group.elementArray2.emplaceBack(index - 1, index);
                    }

                    // convert to format used by earcut
                    flattened.push(point.x);
                    flattened.push(point.y);
                }
            }

            for (const index of earcut(flattened, holeIndices)) {
                group.elementArray.emplaceBack(index + startIndex);
            }
        }

        this.populatePaintArrays('fill', {zoom: this.zoom}, feature.properties, startGroup, startIndex);
    }
}

module.exports = FillBucket;
