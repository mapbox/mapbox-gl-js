// @flow

const ArrayGroup = require('../array_group');
const BufferGroup = require('../buffer_group');
const createElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const assert = require('assert');
const EARCUT_MAX_RINGS = 500;

import type {Bucket, BucketParameters, IndexedFeature, PopulateParameters, SerializedBucket} from '../bucket';
import type {ProgramInterface} from '../program_configuration';
import type StyleLayer from '../../style/style_layer';

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

class FillBucket implements Bucket {
    static programInterface: ProgramInterface;

    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<StyleLayer>;
    buffers: BufferGroup;
    arrays: ArrayGroup;

    constructor(options: BucketParameters) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.index = options.index;

        if (options.arrays) {
            this.buffers = new BufferGroup(fillInterface, options.layers, options.zoom, options.arrays);
        } else {
            this.arrays = new ArrayGroup(fillInterface, options.layers, options.zoom);
        }
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters) {
        for (const {feature, index, sourceLayerIndex} of features) {
            if (this.layers[0].filter(feature)) {
                this.addFeature(feature);
                options.featureIndex.insert(feature, index, sourceLayerIndex, this.index);
            }
        }
    }

    getPaintPropertyStatistics() {
        return this.arrays.programConfigurations.getPaintPropertyStatistics();
    }

    isEmpty() {
        return this.arrays.isEmpty();
    }

    serialize(transferables?: Array<Transferable>): SerializedBucket {
        return {
            zoom: this.zoom,
            layerIds: this.layers.map((l) => l.id),
            arrays: this.arrays.serialize(transferables)
        };
    }

    destroy() {
        if (this.buffers) {
            this.buffers.destroy();
            (this: any).buffers = null;
        }
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
