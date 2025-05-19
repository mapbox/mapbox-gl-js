import {CircleLayoutArray, CircleGlobeExtArray, CircleExtLayoutArray} from '../array_types';
import {circleAttributes, circleAttributesExt, circleGlobeAttributesExt} from './circle_attributes';
import SegmentVector from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {TriangleIndexArray} from '../index_array_type';
import loadGeometry from '../load_geometry';
import toEvaluationFeature from '../evaluation_feature';
import EXTENT from '../../style-spec/data/extent';
import {register} from '../../util/web_worker_transfer';
import EvaluationParameters from '../../style/evaluation_parameters';
import Point from '@mapbox/point-geometry';
import {ElevationFeatures, type ElevationFeature} from '../../../3d-style/elevation/elevation_feature';
import assert from 'assert';

import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type {TypedStyleLayer} from '../../style/style_layer/typed_style_layer';
import type CircleStyleLayer from '../../style/style_layer/circle_style_layer';
import type HeatmapStyleLayer from '../../style/style_layer/heatmap_style_layer';
import type Context from '../../gl/context';
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import type {FeatureStates} from '../../source/source_state';
import type {SpritePositions} from '../../util/image';
import type {TileTransform} from '../../geo/projection/tile_transform';
import type {ProjectionSpecification} from '../../style-spec/types';
import type Projection from '../../geo/projection/projection';
import type {vec3} from 'gl-matrix';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {TileFootprint} from '../../../3d-style/util/conflation';
import type {ImageId} from '../../style-spec/expression/types/image_id';

/**
 * Circles are represented by two triangles.
 *
 * Each corner has a pos that is the center of the circle and an extrusion
 * vector that is where it points.
 * @private
 */
class CircleBucket<Layer extends CircleStyleLayer | HeatmapStyleLayer = CircleStyleLayer | HeatmapStyleLayer> implements Bucket {
    index: number;
    zoom: number;
    overscaling: number;
    layerIds: Array<string>;
    layers: Array<Layer>;
    stateDependentLayers: Array<CircleStyleLayer>;
    stateDependentLayerIds: Array<string>;

    layoutVertexArray: CircleLayoutArray;
    layoutVertexBuffer: VertexBuffer;
    elevatedLayoutVertexArray: CircleExtLayoutArray | undefined;
    elevatedLayoutVertexBuffer: VertexBuffer | undefined;
    globeExtVertexArray: CircleGlobeExtArray | null | undefined;
    globeExtVertexBuffer: VertexBuffer | null | undefined;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<Layer>;
    segments: SegmentVector;
    uploaded: boolean;
    projection: ProjectionSpecification;

    elevationMode: 'none' | 'hd-road-markup';
    hasElevation: boolean;

    worldview: string | undefined;

    constructor(options: BucketParameters<Layer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.index = options.index;
        this.hasPattern = false;
        this.projection = options.projection;

        this.layoutVertexArray = new CircleLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.segments = new SegmentVector();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, {zoom: options.zoom, lut: options.lut});
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);

        this.elevationMode = (this.layers[0] as CircleStyleLayer).layout.get('circle-elevation-reference');
        this.hasElevation = false;
        if (this.elevationMode !== 'none') {
            this.elevatedLayoutVertexArray = new CircleExtLayoutArray();
        }

        this.worldview = options.worldview;
    }

    updateFootprints(_id: UnwrappedTileID, _footprints: Array<TileFootprint>) {
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        const styleLayer = this.layers[0];
        const bucketFeatures = [];
        let circleSortKey = null;

        // Heatmap layers are handled in this bucket and have no evaluated properties, so we check our access
        if (styleLayer.type === 'circle') {
            circleSortKey = styleLayer.layout.get('circle-sort-key');
        }

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom, {worldview: this.worldview}), evaluationFeature, canonical))
                continue;

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
                return (a.sortKey as number) - (b.sortKey as number);
            });
        }

        let globeProjection: Projection | null | undefined = null;

        if (tileTransform.projection.name === 'globe') {
            // Extend vertex attributes if the globe projection is enabled
            this.globeExtVertexArray = new CircleGlobeExtArray();
            globeProjection = tileTransform.projection;
        }

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;
            const feature = features[index].feature;

            this.addFeature(bucketFeature, geometry, index, options.availableImages, canonical, globeProjection, options.brightness, options.elevationFeatures);
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }

        if (!this.hasElevation) {
            this.elevatedLayoutVertexArray = undefined;
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: ImageId[], imagePositions: SpritePositions, layers: ReadonlyArray<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null) {
        this.programConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness, this.worldview);
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

            if (this.elevatedLayoutVertexArray) {
                assert(this.layoutVertexArray.length === this.elevatedLayoutVertexArray.length);
                this.elevatedLayoutVertexBuffer = context.createVertexBuffer(this.elevatedLayoutVertexArray, circleAttributesExt.members);
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
        if (this.elevatedLayoutVertexBuffer) {
            this.elevatedLayoutVertexBuffer.destroy();
        }
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, availableImages: ImageId[], canonical: CanonicalTileID, projection?: Projection | null, brightness?: number | null, elevationFeatures?: ElevationFeature[]) {
        let tiledElevation: ElevationFeature | undefined;
        if (this.elevationMode !== 'none') {
            tiledElevation = ElevationFeatures.getElevationFeature(feature, elevationFeatures);
        }

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

                    this.addGlobeExtVertex(projectedPoint, normal);
                    this.addGlobeExtVertex(projectedPoint, normal);
                    this.addGlobeExtVertex(projectedPoint, normal);
                    this.addGlobeExtVertex(projectedPoint, normal);
                }
                const segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray, feature.sortKey);
                const index = segment.vertexLength;

                this.addCircleVertex(x, y, -1, -1);
                this.addCircleVertex(x, y, 1, -1);
                this.addCircleVertex(x, y, 1, 1);
                this.addCircleVertex(x, y, -1, 1);

                if (this.elevationMode !== 'none') {
                    const z = tiledElevation ? tiledElevation.pointElevation(new Point(x, y)) : 0.0;
                    this.hasElevation = this.hasElevation || z !== 0.0;
                    for (let i = 0; i < 4; i++) {
                        this.elevatedLayoutVertexArray.emplaceBack(z);
                    }
                }

                this.indexArray.emplaceBack(index, index + 1, index + 2);
                this.indexArray.emplaceBack(index, index + 2, index + 3);

                segment.vertexLength += 4;
                segment.primitiveLength += 2;
            }
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {}, availableImages, canonical, brightness, undefined, this.worldview);
    }

    private addCircleVertex(x: number, y: number, extrudeX: number, extrudeY: number) {
        const circleX = (x * 2) + ((extrudeX + 1) / 2);
        const circleY = (y * 2) + ((extrudeY + 1) / 2);
        this.layoutVertexArray.emplaceBack(circleX, circleY);
    }

    private addGlobeExtVertex(pos: {
        x: number;
        y: number;
        z: number;
    }, normal: vec3) {
        const encode = 1 << 14;
        this.globeExtVertexArray.emplaceBack(
            pos.x, pos.y, pos.z,
            normal[0] * encode, normal[1] * encode, normal[2] * encode);
    }
}

register(CircleBucket, 'CircleBucket', {omit: ['layers']});

export default CircleBucket;
