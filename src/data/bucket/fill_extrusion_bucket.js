// @flow

const Bucket = require('../bucket');
const createElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const assert = require('assert');
const EARCUT_MAX_RINGS = 500;

import type {BucketParameters} from '../bucket';
import type {ProgramInterface} from '../program_configuration';

const fillExtrusionInterface = {
    layoutAttributes: [
        {name: 'a_pos',          components: 2, type: 'Int16'},
        {name: 'a_normal',       components: 3, type: 'Int16'},
        {name: 'a_edgedistance', components: 1, type: 'Int16'}
    ],
    elementArrayType: createElementArrayType(3),

    paintAttributes: [
        {property: 'fill-extrusion-base'},
        {property: 'fill-extrusion-height'},
        {property: 'fill-extrusion-color'}
    ]
};

const FACTOR = Math.pow(2, 13);

function addVertex(vertexArray, x, y, nx, ny, nz, t, e) {
    vertexArray.emplaceBack(
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
    static programInterface: ProgramInterface;

    constructor(options: BucketParameters) {
        super(options, fillExtrusionInterface);
    }

    addFeature(feature: VectorTileFeature) {
        const arrays = this.arrays;

        for (const polygon of classifyRings(loadGeometry(feature), EARCUT_MAX_RINGS)) {
            let numVertices = 0;
            for (const ring of polygon) {
                numVertices += ring.length;
            }

            const segment = arrays.prepareSegment(numVertices * 5);

            const flattened = [];
            const holeIndices = [];
            const indices = [];

            for (const ring of polygon) {
                if (ring.length === 0) {
                    continue;
                }

                if (ring !== polygon[0]) {
                    holeIndices.push(flattened.length / 2);
                }

                let edgeDistance = 0;

                for (let p = 0; p < ring.length; p++) {
                    const p1 = ring[p];

                    addVertex(arrays.layoutVertexArray, p1.x, p1.y, 0, 0, 1, 1, 0);
                    indices.push(segment.vertexLength++);

                    if (p >= 1) {
                        const p2 = ring[p - 1];

                        if (!isBoundaryEdge(p1, p2)) {
                            const perp = p1.sub(p2)._perp()._unit();

                            addVertex(arrays.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 0, edgeDistance);
                            addVertex(arrays.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 1, edgeDistance);

                            edgeDistance += p2.dist(p1);

                            addVertex(arrays.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 0, edgeDistance);
                            addVertex(arrays.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 1, edgeDistance);

                            const bottomRight = segment.vertexLength;

                            arrays.elementArray.emplaceBack(bottomRight, bottomRight + 1, bottomRight + 2);
                            arrays.elementArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

                            segment.vertexLength += 4;
                            segment.primitiveLength += 2;
                        }
                    }

                    // convert to format used by earcut
                    flattened.push(p1.x);
                    flattened.push(p1.y);
                }
            }

            const triangleIndices = earcut(flattened, holeIndices);
            assert(triangleIndices.length % 3 === 0);

            for (let j = 0; j < triangleIndices.length; j += 3) {
                arrays.elementArray.emplaceBack(
                    indices[triangleIndices[j]],
                    indices[triangleIndices[j + 1]],
                    indices[triangleIndices[j + 2]]);
            }

            segment.primitiveLength += triangleIndices.length / 3;
        }

        arrays.populatePaintArrays(feature.properties);
    }
}

FillExtrusionBucket.programInterface = fillExtrusionInterface;

module.exports = FillExtrusionBucket;

function isBoundaryEdge(p1, p2) {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}
