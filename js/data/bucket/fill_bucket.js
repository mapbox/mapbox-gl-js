'use strict';

const Bucket = require('../bucket');
const loadGeometry = require('../load_geometry');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const Point = require('point-geometry');
const EARCUT_MAX_RINGS = 500;

const fillInterfaces = {
    fill: {
        layoutVertexArrayType: new Bucket.VertexArrayType([{
            name: 'a_pos',
            components: 2,
            type: 'Int16'
        }]),
        elementArrayType: new Bucket.ElementArrayType(1),
        elementArrayType2: new Bucket.ElementArrayType(2),

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

    addVertex(vertexArray, x, y) {
        return vertexArray.emplaceBack(x, y);
    }

    addFeature(feature) {
        const lines = loadGeometry(feature);
        const polygons = convertCoords(classifyRings(lines, EARCUT_MAX_RINGS));

        this.factor = Math.pow(2, 13);

        const startGroup = this.prepareArrayGroup('fill', 0);
        const startIndex = startGroup.layoutVertexArray.length;

        for (let i = 0; i < polygons.length; i++) {
            this.addPolygon(polygons[i]);
        }

        this.populatePaintArrays('fill', {zoom: this.zoom}, feature.properties, startGroup, startIndex);
    }

    addPolygon(polygon) {
        let numVertices = 0;
        for (let k = 0; k < polygon.length; k++) {
            numVertices += polygon[k].length;
        }

        const group = this.prepareArrayGroup('fill', numVertices);
        const flattened = [];
        const holeIndices = [];
        const startIndex = group.layoutVertexArray.length;

        const indices = [];

        for (let r = 0; r < polygon.length; r++) {
            const ring = polygon[r];

            if (r > 0) holeIndices.push(flattened.length / 2);

            for (let v = 0; v < ring.length; v++) {
                const v1 = ring[v];

                const index = this.addVertex(group.layoutVertexArray, v1[0], v1[1], 0, 0, 1, 1, 0);
                indices.push(index);

                if (v >= 1) {
                    group.elementArray2.emplaceBack(index - 1, index);
                }

                // convert to format used by earcut
                flattened.push(v1[0]);
                flattened.push(v1[1]);
            }
        }

        const triangleIndices = earcut(flattened, holeIndices);

        for (let i = 0; i < triangleIndices.length; i++) {
            group.elementArray.emplaceBack(triangleIndices[i] + startIndex);
        }
    }
}

module.exports = FillBucket;

function convertCoords(rings) {
    if (rings instanceof Point) return [rings.x, rings.y];
    return rings.map(convertCoords);
}
