// @flow

const ArrayGroup = require('../array_group');
const BufferGroup = require('../buffer_group');
const createElementArrayType = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');

import type {Bucket, BucketParameters, IndexedFeature, PopulateParameters, SerializedBucket} from '../bucket';
import type {ProgramInterface} from '../program_configuration';
import type StyleLayer from '../../style/style_layer';

const circleInterface = {
    layoutAttributes: [
        {name: 'a_pos', components: 2, type: 'Int16'}
    ],
    elementArrayType: createElementArrayType(),

    paintAttributes: [
        {property: 'circle-color'},
        {property: 'circle-radius'},
        {property: 'circle-blur'},
        {property: 'circle-opacity'},
        {property: 'circle-stroke-color'},
        {property: 'circle-stroke-width'},
        {property: 'circle-stroke-opacity'}
    ]
};

function addCircleVertex(layoutVertexArray, x, y, extrudeX, extrudeY) {
    layoutVertexArray.emplaceBack(
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
class CircleBucket implements Bucket {
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
            this.buffers = new BufferGroup(circleInterface, options.layers, options.zoom, options.arrays);
        } else {
            this.arrays = new ArrayGroup(circleInterface, options.layers, options.zoom);
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

                const segment = arrays.prepareSegment(4);
                const index = segment.vertexLength;

                addCircleVertex(arrays.layoutVertexArray, x, y, -1, -1);
                addCircleVertex(arrays.layoutVertexArray, x, y, 1, -1);
                addCircleVertex(arrays.layoutVertexArray, x, y, 1, 1);
                addCircleVertex(arrays.layoutVertexArray, x, y, -1, 1);

                arrays.elementArray.emplaceBack(index, index + 1, index + 2);
                arrays.elementArray.emplaceBack(index, index + 3, index + 2);

                segment.vertexLength += 4;
                segment.primitiveLength += 2;
            }
        }

        arrays.populatePaintArrays(feature.properties);
    }
}

CircleBucket.programInterface = circleInterface;

module.exports = CircleBucket;
