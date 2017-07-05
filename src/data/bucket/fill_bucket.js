// @flow

const Bucket = require('../bucket');
const createElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const assert = require('assert');
const EARCUT_MAX_RINGS = 500;

import type {BucketParameters} from '../bucket';
import type {ProgramInterface} from '../program_configuration';

const fillInterface = {
    layoutAttributes: [
        {name: 'a_pos', components: 2, type: 'Int16'}
    ],
    elementArrayType: createElementArrayType(3),
    elementArrayType2: createElementArrayType(2),

    paintAttributes: [
        {property: 'fill-color'},
        {property: 'fill-outline-color'},
        {property: 'fill-opacity'}
    ]
};

class FillBucket extends Bucket {
    static programInterface: ProgramInterface;

    constructor(options: BucketParameters) {
        super(options, fillInterface);
    }

    addFeature(feature: VectorTileFeature) {
        const arrays = this.arrays;

        for (const polygon of classifyRings(loadGeometry(feature), EARCUT_MAX_RINGS)) {
            let numVertices = 0;
            for (const ring of polygon) {
                numVertices += ring.length;
            }

            const triangleSegment = arrays.prepareSegment(numVertices);
            const triangleIndex = triangleSegment.vertexLength;

            const flattened = [];
            const holeIndices = [];

            for (const ring of polygon) {
                if (ring.length === 0) {
                    continue;
                }

                if (ring !== polygon[0]) {
                    holeIndices.push(flattened.length / 2);
                }

                const lineSegment = arrays.prepareSegment2(ring.length);
                const lineIndex = lineSegment.vertexLength;

                arrays.layoutVertexArray.emplaceBack(ring[0].x, ring[0].y);
                arrays.elementArray2.emplaceBack(lineIndex + ring.length - 1, lineIndex);
                flattened.push(ring[0].x);
                flattened.push(ring[0].y);

                for (let i = 1; i < ring.length; i++) {
                    arrays.layoutVertexArray.emplaceBack(ring[i].x, ring[i].y);
                    arrays.elementArray2.emplaceBack(lineIndex + i - 1, lineIndex + i);
                    flattened.push(ring[i].x);
                    flattened.push(ring[i].y);
                }

                lineSegment.vertexLength += ring.length;
                lineSegment.primitiveLength += ring.length;
            }

            const indices = earcut(flattened, holeIndices);
            assert(indices.length % 3 === 0);

            for (let i = 0; i < indices.length; i += 3) {
                arrays.elementArray.emplaceBack(
                    triangleIndex + indices[i],
                    triangleIndex + indices[i + 1],
                    triangleIndex + indices[i + 2]);
            }

            triangleSegment.vertexLength += numVertices;
            triangleSegment.primitiveLength += indices.length / 3;
        }

        arrays.populatePaintArrays(feature.properties);
    }
}

FillBucket.programInterface = fillInterface;

module.exports = FillBucket;
