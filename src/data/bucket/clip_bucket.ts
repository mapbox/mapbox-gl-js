import earcut from 'earcut';
import classifyRings from '../../util/classify_rings';
import assert from 'assert';
import {register} from '../../util/web_worker_transfer';
import loadGeometry from '../load_geometry';
import toEvaluationFeature from '../evaluation_feature';
import EvaluationParameters from '../../style/evaluation_parameters';
import TriangleGridIndex from '../../util/triangle_grid_index';

import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type ClipStyleLayer from '../../style/style_layer/clip_style_layer';
import type Context from '../../gl/context';
import type {FeatureStates} from '../../source/source_state';
import type {TileTransform} from '../../geo/projection/tile_transform';
import type {Footprint, TileFootprint} from '../../../3d-style/util/conflation';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {SpritePositions} from '../../util/image';

import Point from "@mapbox/point-geometry";

class ClipBucket implements Bucket {
    index: number;
    zoom: number;
    layers: Array<ClipStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<ClipStyleLayer>;
    stateDependentLayerIds: Array<string>;
    hasPattern: boolean;

    footprints: Array<Footprint>;

    constructor(options: BucketParameters<ClipStyleLayer>) {
        this.zoom = options.zoom;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.index = options.index;
        this.hasPattern = false;

        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.footprints = [];
    }

    updateFootprints(id: UnwrappedTileID, footprints: Array<TileFootprint>) {
        for (const footprint of this.footprints) {
            footprints.push({
                footprint,
                id
            });
        }
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        const bucketFeatures = [];

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;

            const bucketFeature: BucketFeature = {
                id,
                properties: feature.properties,
                // @ts-expect-error - TS2322 - Type '0 | 2 | 1 | 3' is not assignable to type '2 | 1 | 3'.
                type: feature.type,
                sourceLayerIndex,
                index,
                // @ts-expect-error - TS2345 - Argument of type 'VectorTileFeature' is not assignable to parameter of type 'FeatureWithGeometry'.
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature, canonical, tileTransform),
                patterns: {}
            };

            bucketFeatures.push(bucketFeature);
        }

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;

            this.addFeature(bucketFeature, geometry, index, canonical, {}, options.availableImages, options.brightness);
            const feature = features[index].feature;
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }
    }

    isEmpty(): boolean {
        return this.footprints.length === 0;
    }

    uploadPending(): boolean {
        return false;
    }

    upload(_context: Context) {
    }

    update(_states: FeatureStates, _vtLayer: VectorTileLayer, _availableImages: Array<string>, _imagePositions: SpritePositions, _brightness?: number | null) {
    }

    destroy() {
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: SpritePositions, _availableImages: Array<string> = [], _brightness?: number | null) {
        for (const polygon of classifyRings(geometry, 2)) {
            const points: Array<Point> = [];
            const flattened = [];
            const holeIndices = [];

            const min = new Point(Infinity, Infinity);
            const max = new Point(-Infinity, -Infinity);

            for (const ring of polygon) {
                if (ring.length === 0) {
                    continue;
                }

                if (ring !== polygon[0]) {
                    holeIndices.push(flattened.length / 2);
                }

                for (let i = 0; i < ring.length; i++) {
                    flattened.push(ring[i].x);
                    flattened.push(ring[i].y);
                    points.push(ring[i]);

                    min.x = Math.min(min.x, ring[i].x);
                    min.y = Math.min(min.y, ring[i].y);
                    max.x = Math.max(max.x, ring[i].x);
                    max.y = Math.max(max.y, ring[i].y);
                }
            }

            const indices = earcut(flattened, holeIndices);
            assert(indices.length % 3 === 0);

            const grid = new TriangleGridIndex(points, indices, 8, 256);
            this.footprints.push({
                vertices: points,
                indices,
                grid,
                min,
                max
            });
        }
    }
}

register(ClipBucket, 'ClipBucket', {omit: ['layers']});

export default ClipBucket;
