// @flow

const {SegmentVector} = require('../segment');
const {ProgramConfigurationSet} = require('../program_configuration');
const createVertexArrayType = require('../vertex_array_type');
const {TriangleIndexArray} = require('../index_array_type');
const loadGeometry = require('../load_geometry');
const EXTENT = require('../extent');
const {register} = require('../../util/web_worker_transfer');

import type {
    Bucket,
    BucketParameters,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type {ProgramInterface} from '../program_configuration';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer';
import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer';
import type {StructArray} from '../../util/struct_array';
import type Context from '../../gl/context';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import type Point from '@mapbox/point-geometry';

const circleInterface = {
    layoutAttributes: [
        {name: 'a_pos', components: 2, type: 'Int16'}
    ],
    indexArrayType: TriangleIndexArray,

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
class CircleBucket<Layer: CircleStyleLayer | HeatmapStyleLayer> implements Bucket {
    static classRegistryName;
    static programInterface: ProgramInterface;
    index: number;
    zoom: number;
    overscaling: number;
    layerIds: Array<string>;
    layers: Array<Layer>;

    layoutVertexArray: StructArray;
    layoutVertexBuffer: VertexBuffer;

    indexArray: StructArray;
    indexBuffer: IndexBuffer;

    programConfigurations: ProgramConfigurationSet<Layer>;
    segments: SegmentVector;
    uploaded: boolean;

    constructor(options: BucketParameters<Layer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;

        this.layoutVertexArray = new LayoutVertexArrayType();
        this.indexArray = new TriangleIndexArray();
        this.segments = new SegmentVector();
        this.programConfigurations = new ProgramConfigurationSet(
            this.constructor.programInterface, options.layers, options.zoom);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters) {
        for (const {feature, index, sourceLayerIndex} of features) {
            if (this.layers[0]._featureFilter({zoom: this.zoom}, feature)) {
                const geometry = loadGeometry(feature);
                this.addFeature(feature, geometry);
                options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
            }
        }
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    upload(context: Context) {
        this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray);
        this.indexBuffer = context.createIndexBuffer(this.indexArray);
        this.programConfigurations.upload(context);
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    addFeature(feature: VectorTileFeature, geometry: Array<Array<Point>>) {
        for (const ring of geometry) {
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

                const segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
                const index = segment.vertexLength;

                addCircleVertex(this.layoutVertexArray, x, y, -1, -1);
                addCircleVertex(this.layoutVertexArray, x, y, 1, -1);
                addCircleVertex(this.layoutVertexArray, x, y, 1, 1);
                addCircleVertex(this.layoutVertexArray, x, y, -1, 1);

                this.indexArray.emplaceBack(index, index + 1, index + 2);
                this.indexArray.emplaceBack(index, index + 3, index + 2);

                segment.vertexLength += 4;
                segment.primitiveLength += 2;
            }
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature);
    }
}

register('CircleBucket', CircleBucket, {omit: ['layers']});

CircleBucket.programInterface = circleInterface;

module.exports = CircleBucket;
