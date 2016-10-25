'use strict';

const Bucket = require('../bucket');
const VertexArrayType = require('../vertex_array_type');
const ElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const EARCUT_MAX_RINGS = 500;

const fillExtrusionInterfaces = {
    fillextrusion: {
        layoutVertexArrayType: new VertexArrayType([{
            name: 'a_pos',
            components: 2,
            type: 'Int16'
        }, {
            name: 'a_normal',
            components: 3,
            type: 'Int16'
        }, {
            name: 'a_edgedistance',
            components: 1,
            type: 'Int16'
        }]),
        elementArrayType: new ElementArrayType(3),

        paintAttributes: [{
            name: 'a_minH',
            components: 1,
            type: 'Uint16',
            getValue: (layer, globalProperties, featureProperties) => {
                return [layer.getPaintValue("fill-extrude-base", globalProperties, featureProperties)];
            },
            multiplier: 1,
            paintProperty: 'fill-extrude-base'
        }, {
            name: 'a_maxH',
            components: 1,
            type: 'Uint16',
            getValue: (layer, globalProperties, featureProperties) => {
                return [layer.getPaintValue("fill-extrude-height", globalProperties, featureProperties)];
            },
            multiplier: 1,
            paintProperty: 'fill-extrude-height'
        }, {
            name: 'a_color',
            components: 4,
            type: 'Uint8',
            getValue: (layer, globalProperties, featureProperties) => {
                const color = layer.getPaintValue("fill-color", globalProperties, featureProperties);
                color[3] = 1.0;
                return color;
            },
            multiplier: 255,
            paintProperty: 'fill-color'
        }]
    }
};

const FACTOR = Math.pow(2, 13);

function addVertex(vertexArray, x, y, nx, ny, nz, t, e) {
    return vertexArray.emplaceBack(
        // a_pos
        x,
        y,
        // a_normal
        Math.floor(nx * FACTOR) * 2 + t,
        ny * FACTOR * 2,
        nz * FACTOR * 2,

        // a_edgedistance
        Math.round(e)
    );
}

class FillExtrusionBucket extends Bucket {
    get programInterfaces() {
        return fillExtrusionInterfaces;
    }

    addFeature(feature) {
        const startGroup = this.prepareArrayGroup('fillextrusion', 0);
        const startIndex = startGroup.layoutVertexArray.length;

        for (const polygon of classifyRings(loadGeometry(feature), EARCUT_MAX_RINGS)) {
            let numVertices = 0;
            for (const ring of polygon) {
                numVertices += ring.length;
            }
            numVertices *= 5;

            const group = this.prepareArrayGroup('fillextrusion', numVertices);
            const flattened = [];
            const holeIndices = [];
            const indices = [];

            for (let r = 0; r < polygon.length; r++) {
                const ring = polygon[r];

                if (r > 0) holeIndices.push(flattened.length / 2);

                let edgeDistance = 0;

                for (let p = 0; p < ring.length; p++) {
                    const p1 = ring[p];

                    const index = addVertex(group.layoutVertexArray, p1.x, p1.y, 0, 0, 1, 1, 0);
                    indices.push(index);

                    if (p >= 1) {
                        const p2 = ring[p - 1];

                        if (!isBoundaryEdge(p1, p2)) {
                            const perp = p1.sub(p2)._perp()._unit();

                            const bottomRight = addVertex(group.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 0, edgeDistance);
                            addVertex(group.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 1, edgeDistance);

                            edgeDistance += p2.dist(p1);

                            addVertex(group.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 0, edgeDistance);
                            addVertex(group.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 1, edgeDistance);

                            group.elementArray.emplaceBack(bottomRight, bottomRight + 1, bottomRight + 2);
                            group.elementArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);
                        }
                    }

                    // convert to format used by earcut
                    flattened.push(p1.x);
                    flattened.push(p1.y);
                }
            }

            const triangleIndices = earcut(flattened, holeIndices);

            for (let j = 0; j < triangleIndices.length - 2; j += 3) {
                group.elementArray.emplaceBack(indices[triangleIndices[j]],
                    indices[triangleIndices[j + 1]],
                    indices[triangleIndices[j + 2]]);
            }
        }

        this.populatePaintArrays('fillextrusion', {zoom: this.zoom}, feature.properties, startGroup, startIndex);
    }
}

module.exports = FillExtrusionBucket;

function isBoundaryEdge(p1, p2) {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}
