// @flow

const {SegmentVector} = require('../segment');
const VertexBuffer = require('../../gl/vertex_buffer');
const IndexBuffer = require('../../gl/index_buffer');
const {ProgramConfigurationSet} = require('../program_configuration');
const createVertexArrayType = require('../vertex_array_type');
const {TriangleElementArray} = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');

import type {Bucket, IndexedFeature, PopulateParameters, SerializedBucket} from '../bucket';
import type {ProgramInterface} from '../program_configuration';
import type StyleLayer from '../../style/style_layer';
import type {StructArray} from '../../util/struct_array';

const circleInterface = {
    layoutAttributes: [
        {name: 'a_pos', components: 2, type: 'Int16'}
    ],
    elementArrayType: TriangleElementArray,

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

const LayoutVertexArrayType = createVertexArrayType(circleInterface.layoutAttributes);

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

    layoutVertexArray: StructArray;
    layoutVertexBuffer: VertexBuffer;

    elementArray: StructArray;
    elementBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet;
    segments: SegmentVector;

    constructor(options: any) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.index = options.index;

        if (options.layoutVertexArray) {
            this.layoutVertexBuffer = new VertexBuffer(options.layoutVertexArray, LayoutVertexArrayType.serialize());
            this.elementBuffer = new IndexBuffer(options.elementArray);
            this.programConfigurations = ProgramConfigurationSet.deserialize(circleInterface, options.layers, options.zoom, options.programConfigurations);
            this.segments = new SegmentVector(options.segments);
        } else {
            this.layoutVertexArray = new LayoutVertexArrayType();
            this.elementArray = new TriangleElementArray();
            this.programConfigurations = new ProgramConfigurationSet(circleInterface, options.layers, options.zoom);
            this.segments = new SegmentVector();
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

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    serialize(transferables?: Array<Transferable>): SerializedBucket {
        return {
            zoom: this.zoom,
            layerIds: this.layers.map((l) => l.id),
            layoutVertexArray: this.layoutVertexArray.serialize(transferables),
            elementArray: this.elementArray.serialize(transferables),
            programConfigurations: this.programConfigurations.serialize(transferables),
            segments: this.segments.get(),
        };
    }

    destroy() {
        this.layoutVertexBuffer.destroy();
        this.elementBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    addFeature(feature: VectorTileFeature) {
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

                const segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.elementArray);
                const index = segment.vertexLength;

                addCircleVertex(this.layoutVertexArray, x, y, -1, -1);
                addCircleVertex(this.layoutVertexArray, x, y, 1, -1);
                addCircleVertex(this.layoutVertexArray, x, y, 1, 1);
                addCircleVertex(this.layoutVertexArray, x, y, -1, 1);

                this.elementArray.emplaceBack(index, index + 1, index + 2);
                this.elementArray.emplaceBack(index, index + 3, index + 2);

                segment.vertexLength += 4;
                segment.primitiveLength += 2;
            }
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature.properties);
    }
}

CircleBucket.programInterface = circleInterface;

module.exports = CircleBucket;
