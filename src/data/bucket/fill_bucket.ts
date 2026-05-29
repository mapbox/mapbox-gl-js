import earcut from 'earcut';
import classifyRings from '../../util/classify_rings';
import assert from '../../style-spec/util/assert';
const EARCUT_MAX_RINGS = 500;
import {register} from '../../util/web_worker_transfer';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features';
import loadGeometry from '../load_geometry';
import toEvaluationFeature from '../evaluation_feature';
import EvaluationParameters from '../../style/evaluation_parameters';
import FillBufferData from './fill_buffer_data';

import type Point from '@mapbox/point-geometry';
import type {CanonicalTileID, UnwrappedTileID} from '../../source/tile_id';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket';
import type FillStyleLayer from '../../style/style_layer/fill_style_layer';
import type Context from '../../gl/context';
import type {FeatureStates} from '../../source/source_state';
import type {SpritePositions} from '../../util/image';
import type {ProjectionSpecification} from '../../style-spec/types';
import type {TileTransform} from '../../geo/projection/tile_transform';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {TileFootprint} from '../../../3d-style/util/conflation';
import type {TypedStyleLayer} from '../../style/style_layer/typed_style_layer';
import type {ImageId} from '../../style-spec/expression/types/image_id';
import type {GlobalProperties} from "../../style-spec/expression";
import type {LUT} from '../../util/lut';
import type {ElevatedStructures} from '../../../3d-style/elevation/elevated_structures';
import type {ElevationFeature} from '../../../3d-style/elevation/elevation_feature';
import type {ElevationParams, FillHDExtension} from '../../../3d-style/data/bucket/fill_hd_extension';
import type ElevatedFillBufferData from '../../../3d-style/data/bucket/elevated_fill_buffer_data';

class FillBucket implements Bucket {
    index: number;
    zoom: number;
    pixelRatio: number;
    overscaling: number;
    layers: Array<FillStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<FillStyleLayer>;
    stateDependentLayerIds: Array<string>;
    patternFeatures: Array<BucketFeature>;
    lut: LUT | null;

    bufferData: FillBufferData;

    hasPattern: boolean;

    uploaded: boolean;
    projection: ProjectionSpecification;

    sourceLayerIndex: number;
    sourceLayerName: string;

    worldview: string;
    hasAppearances: boolean | null;

    // Optional HD augmentation, populated by maybeAttachFillHDExt (3d-style/data/bucket/fill_hd_extension.ts)
    // when the layer declares a non-'none' fill-elevation-reference. Owns all elevation-specific
    // state (elevation buffer data, elevated structures, portal graph).
    hdExt: FillHDExtension | undefined;

    constructor(options: BucketParameters<FillStyleLayer>) {
        this.zoom = options.zoom;
        this.pixelRatio = options.pixelRatio;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.index = options.index;
        this.hasPattern = false;
        this.patternFeatures = [];
        this.lut = options.lut;

        this.bufferData = new FillBufferData(options.layers, options.zoom, options.lut);

        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.projection = options.projection;

        this.sourceLayerIndex = options.sourceLayerIndex;
        this.sourceLayerName = options.sourceLayerName || '';

        this.worldview = options.worldview;
        this.hasAppearances = null;
    }

    updateFootprints(_id: UnwrappedTileID, _footprints: Array<TileFootprint>) {
    }

    updateAppearances(_canonical?: CanonicalTileID, _featureState?: FeatureStates, _availableImages?: Array<ImageId>, _globalProperties?: GlobalProperties) {
        return {
            hasLayoutChanges: false,
            hasUboChanges: false
        };
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        this.hasPattern = hasPattern('fill', this.layers, this.pixelRatio, options);
        const fillSortKey = this.layers[0].layout.get('fill-sort-key');
        const bucketFeatures: BucketFeature[] = [];

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            const passesFilter = this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom, {worldview: this.worldview, activeFloors: options.activeFloors}), evaluationFeature, canonical);

            if (!passesFilter) continue;

            const sortKey = fillSortKey ?

                fillSortKey.evaluate(evaluationFeature, {}, canonical, options.availableImages) :
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

        if (fillSortKey) {
            bucketFeatures.sort((a, b) => {
                // a.sortKey is always a number when fillSortKey is defined
                return a.sortKey - b.sortKey;
            });
        }

        for (const bucketFeature of bucketFeatures) {
            const {geometry, index, sourceLayerIndex} = bucketFeature;

            if (this.hasPattern) {
                const patternFeature = addPatternDependencies('fill', this.layers, bucketFeature, this.zoom, this.pixelRatio, options);
                // pattern features are added only once the pattern is loaded into the image atlas
                // so are stored during populate until later updated with positions by tile worker in addFeatures
                this.patternFeatures.push(patternFeature);
            } else {
                this.addFeature(bucketFeature, geometry, index, canonical, {}, options.availableImages, options.brightness, options.elevationFeatures);
            }

            const feature = features[index].feature;
            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index);
        }

        // Build per-FRC-level segments for non-pattern features (pattern features
        // are handled in addFeatures separately). The extension early-returns when
        // FRC tracking isn't enabled on this bucket.
        if (!this.hasPattern && this.hdExt) {
            this.hdExt.buildFrcSegments(this);
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: ImageId[], imagePositions: SpritePositions, layers: ReadonlyArray<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null) {
        this.bufferData.update(states, vtLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness, this.worldview);
        if (this.hdExt) {
            this.hdExt.update(states, vtLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness, this.worldview);
        }
    }

    updateExpressions(layers: ReadonlyArray<TypedStyleLayer>) {
        this.bufferData.programConfigurations.updateExpressions(layers);
        if (this.hdExt) {
            this.hdExt.updateExpressions(layers);
        }
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: ImageId[], _: TileTransform, brightness?: number | null) {
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, imagePositions, availableImages, brightness, options.elevationFeatures);
        }
        if (this.hdExt) {
            this.hdExt.buildFrcSegments(this);
        }
    }

    isEmpty(): boolean {
        return this.bufferData.isEmpty() && (!this.hdExt || this.hdExt.isEmpty());
    }

    uploadPending(): boolean {
        return !this.uploaded || this.bufferData.needsUpload() || (this.hdExt != null && this.hdExt.needsUpload());
    }

    upload(context: Context) {
        this.bufferData.upload(context);
        if (this.hdExt) {
            this.hdExt.upload(context);
        }
    }

    destroy() {
        this.bufferData.destroy();
        if (this.hdExt) {
            this.hdExt.destroy();
        }
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: ImageId[] = [], brightness?: number | null, elevationFeatures?: ElevationFeature[]) {
        const frc = this.hdExt ? this.hdExt.trackFeatureFrc(feature.properties) : null;
        const triStartIndex = this.bufferData.indexArray.length;

        const polygons = classifyRings(geometry, EARCUT_MAX_RINGS);

        // Route through the HD extension first if present; it may consume the feature
        // (writing to its own elevated buffer and structures) or decline and leave the
        // feature for the core non-elevated path below.
        const consumedByHD = this.hdExt != null && this.hdExt.handleFeature(feature, polygons, index, canonical, elevationFeatures, this);
        if (!consumedByHD) {
            this.addGeometry(polygons, this.bufferData);
        }
        this.bufferData.populatePaintArrays(feature, index, imagePositions, availableImages, canonical, brightness, this.worldview);
        if (this.hdExt) {
            this.hdExt.populatePaintArrays(feature, index, imagePositions, availableImages, canonical, brightness, this.worldview);
        }

        if (this.hdExt) {
            this.hdExt.recordFeatureRange(this, triStartIndex, this.bufferData.indexArray.length, frc);
        }
    }

    /**
     * @private
     */
    addGeometry(polygons: Point[][][], bufferData: FillBufferData, elevationParams?: ElevationParams, elevatedStructures?: ElevatedStructures): [number, number] {
        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;

        let constantHeight: number = null;
        if (elevationParams) {
            constantHeight = elevationParams.elevationSampler.constantElevation(elevationParams.elevation, elevationParams.bias);
            if (constantHeight != null) {
                min = constantHeight;
                max = constantHeight;
            }
        }

        // Callers supply `elevationParams` only with an `ElevatedFillBufferData` instance
        // (set up by `FillHDExtension`). The cast localises the invariant so the closure
        // below can write to the elevated array without the whole core type knowing about it.
        const elevatedBufferData = elevationParams ? bufferData as ElevatedFillBufferData : null;

        const addElevatedVertex = (point: Point, points: Point[], heights: number[]) => {
            if (elevationParams == null) return;

            points.push(point);

            // Sample elevation feature to find interpolated heights for each added vertex.
            if (constantHeight != null) {
                elevatedBufferData.elevatedLayoutVertexArray.emplaceBack(constantHeight);
                heights.push(constantHeight);
            } else {
                const height = elevationParams.elevationSampler.pointElevation(point, elevationParams.elevation, elevationParams.bias);
                elevatedBufferData.elevatedLayoutVertexArray.emplaceBack(height);
                heights.push(height);
                min = Math.min(min, height);
                max = Math.max(max, height);
            }
        };

        for (const polygon of polygons) {
            let numVertices = 0;
            for (const ring of polygon) {
                numVertices += ring.length;
            }

            const triangleSegment = bufferData.triangleSegments.prepareSegment(numVertices, bufferData.layoutVertexArray, bufferData.indexArray);
            const triangleIndex = triangleSegment.vertexLength;

            const flattened = [];
            const holeIndices = [];

            const points: Point[] = [];
            const heights: number[] = [];
            // Track ring indices
            const ringVertexOffsets: number[] = [];
            const vOffset = bufferData.layoutVertexArray.length;

            for (const ring of polygon) {
                if (ring.length === 0) {
                    continue;
                }

                if (ring !== polygon[0]) {
                    holeIndices.push(flattened.length / 2);
                }

                const lineSegment = bufferData.lineSegments.prepareSegment(ring.length, bufferData.layoutVertexArray, bufferData.lineIndexArray);
                const lineIndex = lineSegment.vertexLength;

                if (elevationParams) {
                    ringVertexOffsets.push(bufferData.layoutVertexArray.length - vOffset);
                }

                addElevatedVertex(ring[0], points, heights);
                bufferData.layoutVertexArray.emplaceBack(ring[0].x, ring[0].y);
                bufferData.lineIndexArray.emplaceBack(lineIndex + ring.length - 1, lineIndex);
                flattened.push(ring[0].x);
                flattened.push(ring[0].y);

                for (let i = 1; i < ring.length; i++) {
                    addElevatedVertex(ring[i], points, heights);
                    bufferData.layoutVertexArray.emplaceBack(ring[i].x, ring[i].y);
                    bufferData.lineIndexArray.emplaceBack(lineIndex + i - 1, lineIndex + i);
                    flattened.push(ring[i].x);
                    flattened.push(ring[i].y);
                }

                lineSegment.vertexLength += ring.length;
                lineSegment.primitiveLength += ring.length;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            const indices: number[] = earcut(flattened, holeIndices);
            assert(indices.length % 3 === 0);

            for (let i = 0; i < indices.length; i += 3) {
                bufferData.indexArray.emplaceBack(
                    triangleIndex + indices[i],
                    triangleIndex + indices[i + 1],
                    triangleIndex + indices[i + 2]);
            }

            // elevatedStructures is supplied only for hd-road-base features; markup features
            // use elevationParams without elevatedStructures and skip the portal/structure work.
            if (indices.length > 0 && elevationParams && elevatedStructures) {
                const isTunnel = elevationParams.elevation.isTunnel();
                const safeArea = elevationParams.elevation.safeArea;
                const vOffset = elevatedStructures.addVertices(points, heights);
                elevatedStructures.addTriangles(indices, vOffset, isTunnel);

                const ringCount = ringVertexOffsets.length;
                if (ringCount > 0) {
                    for (let i = 0; i < ringCount - 1; i++) {
                        elevatedStructures.addRenderableRing(
                            elevationParams.index, ringVertexOffsets[i] + vOffset, ringVertexOffsets[i + 1] - ringVertexOffsets[i], isTunnel, safeArea, elevationParams.featureInfo
                        );
                    }
                    elevatedStructures.addRenderableRing(
                        elevationParams.index, ringVertexOffsets[ringCount - 1] + vOffset, points.length - ringVertexOffsets[ringCount - 1], isTunnel, safeArea, elevationParams.featureInfo
                    );
                }
            }

            triangleSegment.vertexLength += numVertices;
            triangleSegment.primitiveLength += indices.length / 3;
        }

        return [min, max];
    }
}

register(FillBucket, 'FillBucket', {omit: ['layers', 'patternFeatures']});

export default FillBucket;
