// @flow

import {CircleLayoutArray} from '../array_types';

import {members as layoutAttributes} from './circle_attributes';
import SegmentVector from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {TriangleIndexArray} from '../index_array_type';
import loadGeometry from '../load_geometry';
import EXTENT from '../extent';
import {register} from '../../util/web_worker_transfer';
import EvaluationParameters from '../../style/evaluation_parameters';

import type {CanonicalTileID} from '../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer';
import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer';
import type Context from '../../gl/context';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import type Point from '@mapbox/point-geometry';
import type {FeatureStates} from '../../source/source_state';
import type {ImagePosition} from '../../render/image_atlas';

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

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<Layer>;
    segments: SegmentVector;
    uploaded: boolean;

    constructor(options: BucketParameters<Layer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;

        this.layoutVertexArray = new CircleLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.segments = new SegmentVector();
        this.programConfigurations = new ProgramConfigurationSet(layoutAttributes, options.layers, options.zoom);
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID) {
        const styleLayer = this.layers[0];
        const bucketFeatures = [];
        let circleSortKey = null;

        // Heatmap layers are handled in this bucket and have no evaluated properties, so we check our access
        if (styleLayer.type === 'circle') {
            circleSortKey = ((styleLayer: any): CircleStyleLayer).layout.get('circle-sort-key');
        }

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = {type: feature.type,
                id,
                properties: feature.properties,
                geometry: needGeometry ? loadGeometry(feature) : []};

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

            if (!needGeometry)  evaluationFeature.geometry = loadGeometry(feature);
            const sortKey = circleSortKey ?
                circleSortKey.evaluate(evaluationFeature, {}, canonical) :
                undefined;

            const bucketFeature: BucketFeature = {
                id,
                properties: feature.properties,
                type: feature.type,
                sourceLayerIndex,
                index,
                geometry : evaluationFeature.geometry,
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

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;
            const feature = features[index].feature;

            this.addFeature(bucketFeature, geometry, index, canonical);
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, imagePositions: {[_: string]: ImagePosition}) {
        if (!this.stateDependentLayers.length) return;
        this.programConfigurations.updatePaintArrays(states, vtLayer, this.stateDependentLayers, imagePositions);
    }

    isEmpty() {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending() {
        return !this.uploaded || this.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
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
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID) {
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

                const segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray, feature.sortKey);
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

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {}, canonical);
    }
}

register('CircleBucket', CircleBucket, {omit: ['layers']});

export default CircleBucket;
