// @flow

import {CircleLayoutArray, CircleGlobeExtArray} from '../array_types.js';

import {circleAttributes, circleGlobeAttributesExt} from './circle_attributes.js';
import SegmentVector from '../segment.js';
import {ProgramConfigurationSet} from '../program_configuration.js';
import {TriangleIndexArray} from '../index_array_type.js';
import loadGeometry from '../load_geometry.js';
import toEvaluationFeature from '../evaluation_feature.js';
import EXTENT from '../extent.js';
import {register} from '../../util/web_worker_transfer.js';
import EvaluationParameters from '../../style/evaluation_parameters.js';

import type {CanonicalTileID} from '../../source/tile_id.js';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket.js';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer.js';
import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer.js';
import type Context from '../../gl/context.js';
import type IndexBuffer from '../../gl/index_buffer.js';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state.js';
import type {SpritePositions} from '../../util/image.js';
import type {TileTransform} from '../../geo/projection/tile_transform.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';
import type Projection from '../../geo/projection/projection.js';
import type {Vec3} from 'gl-matrix';
import type {IVectorTileLayer} from '@mapbox/vector-tile';

function addCircleVertex(layoutVertexArray, x, y, extrudeX, extrudeY) {
    layoutVertexArray.emplaceBack(
        (x * 2) + ((extrudeX + 1) / 2),
        (y * 2) + ((extrudeY + 1) / 2));
}

function addGlobeExtVertex(vertexArray: CircleGlobeExtArray, pos: {x: number, y: number, z: number}, normal: Vec3) {
    const encode = 1 << 14;
    vertexArray.emplaceBack(
        pos.x, pos.y, pos.z,
        normal[0] * encode, normal[1] * encode, normal[2] * encode);
}

/**
 * Circles are represented by two triangles.
 *
 * Each corner has a pos that is the center of the circle and an extrusion
 * vector that is where it points.
 * @private
 */
class CircleBucket<Layer: CircleStyleLayer | HeatmapStyleLayer> implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layerIds: Array<string>;
    layers: Array<Layer>;
    stateDependentLayers: Array<Layer>;
    stateDependentLayerIds: Array<string>;

    layoutVertexArray: CircleLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    globeExtVertexArray: ?CircleGlobeExtArray;
    globeExtVertexBuffer: ?VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<Layer>;
    segments: SegmentVector;
    uploaded: boolean;
    projection: ProjectionSpecification;

    constructor(options: BucketParameters<Layer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;
        this.projection = options.projection;

        this.layoutVertexArray = new CircleLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.segments = new SegmentVector();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        const styleLayer = this.layers[0];
        const bucketFeatures = [];
        let circleSortKey = null;

        // Heatmap layers are handled in this bucket and have no evaluated properties, so we check our access
        if (styleLayer.type === 'circle') {
            circleSortKey = ((styleLayer: any): CircleStyleLayer).layout.get('circle-sort-key');
        }

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

            const sortKey = circleSortKey ?
                circleSortKey.evaluate(evaluationFeature, {}, canonical) :
                undefined;

            const bucketFeature: BucketFeature = {
                id,
                properties: feature.properties,
                type: feature.type,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature, canonical, tileTransform),
                patterns: {},
                sortKey
            };

            bucketFeatures.push(bucketFeature);

        }

        if (circleSortKey) {
            bucketFeatures.sort((a, b) => {
                // a.sortKey is always a number when in use
                return ((a.sortKey: any): number) - ((b.sortKey: any): number);
            });
        }

        let globeProjection: ?Projection = null;

        if (tileTransform.projection.name === 'globe') {
            // Extend vertex attributes if the globe projection is enabled
            this.globeExtVertexArray = new CircleGlobeExtArray();
            globeProjection = tileTransform.projection;
        }

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;
            const feature = features[index].feature;

            this.addFeature(bucketFeature, geometry, index, options.availableImages, canonical, globeProjection);
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }

    update(states: FeatureStates, vtLayer: IVectorTileLayer, availableImages: Array<string>, imagePositions: SpritePositions) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, availableImages, imagePositions);
    }

    isEmpty(): boolean {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending(): boolean {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, circleAttributes.members);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);

            if (this.globeExtVertexArray) {
                this.globeExtVertexBuffer = context.createVertexBuffer(this.globeExtVertexArray, circleGlobeAttributesExt.members);
            }
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
        if (this.globeExtVertexBuffer) {
            this.globeExtVertexBuffer.destroy();
        }
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, availableImages: Array<string>, canonical: CanonicalTileID, projection?: ?Projection) {
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

                if (projection) {
                    const projectedPoint = projection.projectTilePoint(x, y, canonical);
                    const normal = projection.upVector(canonical, x, y);
                    const array: any = this.globeExtVertexArray;

                    addGlobeExtVertex(array, projectedPoint, normal);
                    addGlobeExtVertex(array, projectedPoint, normal);
                    addGlobeExtVertex(array, projectedPoint, normal);
                    addGlobeExtVertex(array, projectedPoint, normal);
                }
                const segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray, feature.sortKey);
                const index = segment.vertexLength;

                addCircleVertex(this.layoutVertexArray, x, y, -1, -1);
                addCircleVertex(this.layoutVertexArray, x, y, 1, -1);
                addCircleVertex(this.layoutVertexArray, x, y, 1, 1);
                addCircleVertex(this.layoutVertexArray, x, y, -1, 1);

                this.indexArray.emplaceBack(index, index + 1, index + 2);
                this.indexArray.emplaceBack(index, index + 2, index + 3);

                segment.vertexLength += 4;
                segment.primitiveLength += 2;
            }
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {}, availableImages, canonical);
    }
}

register(CircleBucket, 'CircleBucket', {omit: ['layers']});

export default CircleBucket;
