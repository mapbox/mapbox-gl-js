// @flow

const {SegmentVector} = require('../segment');
const VertexBuffer = require('../../gl/vertex_buffer');
const IndexBuffer = require('../../gl/index_buffer');
const {ProgramConfigurationSet} = require('../program_configuration');
const createVertexArrayType = require('../vertex_array_type');
const {LineIndexArray, TriangleIndexArray} = require('../index_array_type');
const loadGeometry = require('../load_geometry');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const assert = require('assert');
const EARCUT_MAX_RINGS = 500;

import type {Bucket, IndexedFeature, PopulateParameters, SerializedBucket} from '../bucket';
import type {ProgramInterface} from '../program_configuration';
import type StyleLayer from '../../style/style_layer';
import type {StructArray} from '../../util/struct_array';

const fillInterface = {
    layoutAttributes: [
        {name: 'a_pos', components: 2, type: 'Int16'}
    ],
    indexArrayType: TriangleIndexArray,
    indexArrayType2: LineIndexArray,

    paintAttributes: [
        {property: 'fill-color'},
        {property: 'fill-outline-color'},
        {property: 'fill-opacity'}
    ]
};

const LayoutVertexArrayType = createVertexArrayType(fillInterface.layoutAttributes);

class FillBucket implements Bucket {
    static programInterface: ProgramInterface;

    index: number;
    zoom: number;
    overscaling: number;
    layers: Array<StyleLayer>;

    layoutVertexArray: StructArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: StructArray;
    indexBuffer: IndexBuffer;

    indexArray2: StructArray;
    indexBuffer2: IndexBuffer;

    programConfigurations: ProgramConfigurationSet;
    segments: SegmentVector;
    segments2: SegmentVector;

    constructor(options: any) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.index = options.index;

        if (options.layoutVertexArray) {
            this.layoutVertexBuffer = new VertexBuffer(options.layoutVertexArray, LayoutVertexArrayType.serialize());
            this.indexBuffer = new IndexBuffer(options.indexArray);
            this.indexBuffer2 = new IndexBuffer(options.indexArray2);
            this.programConfigurations = ProgramConfigurationSet.deserialize(fillInterface, options.layers, options.zoom, options.programConfigurations);
            this.segments = new SegmentVector(options.segments);
            this.segments2 = new SegmentVector(options.segments2);
        } else {
            this.layoutVertexArray = new LayoutVertexArrayType();
            this.indexArray = new TriangleIndexArray();
            this.indexArray2 = new LineIndexArray();
            this.programConfigurations = new ProgramConfigurationSet(fillInterface, options.layers, options.zoom);
            this.segments = new SegmentVector();
            this.segments2 = new SegmentVector();
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
            indexArray: this.indexArray.serialize(transferables),
            indexArray2: this.indexArray2.serialize(transferables),
            programConfigurations: this.programConfigurations.serialize(transferables),
            segments: this.segments.get(),
            segments2: this.segments2.get()
        };
    }

    destroy() {
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.indexBuffer2.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        this.segments2.destroy();
    }

    addFeature(feature: VectorTileFeature) {
        for (const polygon of classifyRings(loadGeometry(feature), EARCUT_MAX_RINGS)) {
            let numVertices = 0;
            for (const ring of polygon) {
                numVertices += ring.length;
            }

            const triangleSegment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
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

                const lineSegment = this.segments2.prepareSegment(ring.length, this.layoutVertexArray, this.indexArray2);
                const lineIndex = lineSegment.vertexLength;

                this.layoutVertexArray.emplaceBack(ring[0].x, ring[0].y);
                this.indexArray2.emplaceBack(lineIndex + ring.length - 1, lineIndex);
                flattened.push(ring[0].x);
                flattened.push(ring[0].y);

                for (let i = 1; i < ring.length; i++) {
                    this.layoutVertexArray.emplaceBack(ring[i].x, ring[i].y);
                    this.indexArray2.emplaceBack(lineIndex + i - 1, lineIndex + i);
                    flattened.push(ring[i].x);
                    flattened.push(ring[i].y);
                }

                lineSegment.vertexLength += ring.length;
                lineSegment.primitiveLength += ring.length;
            }

            const indices = earcut(flattened, holeIndices);
            assert(indices.length % 3 === 0);

            for (let i = 0; i < indices.length; i += 3) {
                this.indexArray.emplaceBack(
                    triangleIndex + indices[i],
                    triangleIndex + indices[i + 1],
                    triangleIndex + indices[i + 2]);
            }

            triangleSegment.vertexLength += numVertices;
            triangleSegment.primitiveLength += indices.length / 3;
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature.properties);
    }
}

FillBucket.programInterface = fillInterface;

module.exports = FillBucket;
