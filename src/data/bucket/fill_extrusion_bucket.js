// @flow

const {SegmentVector} = require('../segment');
const VertexBuffer = require('../../gl/vertex_buffer');
const IndexBuffer = require('../../gl/index_buffer');
const {ProgramConfigurationSet} = require('../program_configuration');
const createVertexArrayType = require('../vertex_array_type');
const {TriangleElementArray} = require('../element_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');
const earcut = require('earcut');
const classifyRings = require('../../util/classify_rings');
const assert = require('assert');
const EARCUT_MAX_RINGS = 500;

import type {Bucket, IndexedFeature, PopulateParameters, SerializedBucket} from '../bucket';
import type {ProgramInterface} from '../program_configuration';
import type StyleLayer from '../../style/style_layer';
import type {StructArray} from '../../util/struct_array';

const fillExtrusionInterface = {
    layoutAttributes: [
        {name: 'a_pos',          components: 2, type: 'Int16'},
        {name: 'a_normal',       components: 3, type: 'Int16'},
        {name: 'a_edgedistance', components: 1, type: 'Int16'}
    ],
    elementArrayType: TriangleElementArray,

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

const LayoutVertexArrayType = createVertexArrayType(fillExtrusionInterface.layoutAttributes);
const ElementArrayType = fillExtrusionInterface.elementArrayType;

class FillExtrusionBucket implements Bucket {
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
            this.programConfigurations = ProgramConfigurationSet.deserialize(fillExtrusionInterface, options.layers, options.zoom, options.programConfigurations);
            this.segments = new SegmentVector(options.segments);
        } else {
            this.layoutVertexArray = new LayoutVertexArrayType();
            this.elementArray = new ElementArrayType();
            this.programConfigurations = new ProgramConfigurationSet(fillExtrusionInterface, options.layers, options.zoom);
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
        for (const polygon of classifyRings(loadGeometry(feature), EARCUT_MAX_RINGS)) {
            let numVertices = 0;
            for (const ring of polygon) {
                numVertices += ring.length;
            }

            const segment = this.segments.prepareSegment(numVertices * 5, this.layoutVertexArray, this.elementArray);

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

                    addVertex(this.layoutVertexArray, p1.x, p1.y, 0, 0, 1, 1, 0);
                    indices.push(segment.vertexLength++);

                    if (p >= 1) {
                        const p2 = ring[p - 1];

                        if (!isBoundaryEdge(p1, p2)) {
                            const perp = p1.sub(p2)._perp()._unit();

                            addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p1.x, p1.y, perp.x, perp.y, 0, 1, edgeDistance);

                            edgeDistance += p2.dist(p1);

                            addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p2.x, p2.y, perp.x, perp.y, 0, 1, edgeDistance);

                            const bottomRight = segment.vertexLength;

                            this.elementArray.emplaceBack(bottomRight, bottomRight + 1, bottomRight + 2);
                            this.elementArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

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
                this.elementArray.emplaceBack(
                    indices[triangleIndices[j]],
                    indices[triangleIndices[j + 1]],
                    indices[triangleIndices[j + 2]]);
            }

            segment.primitiveLength += triangleIndices.length / 3;
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature.properties);
    }
}

FillExtrusionBucket.programInterface = fillExtrusionInterface;

module.exports = FillExtrusionBucket;

function isBoundaryEdge(p1, p2) {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
}
