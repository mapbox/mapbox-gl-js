import {FillExtLayoutArray, FillLayoutArray} from '../array_types';
import {fillLayoutAttributesExt, fillLayoutAttributes} from './fill_attributes';
import SegmentVector from '../segment';
import {ProgramConfigurationSet} from '../program_configuration';
import {LineIndexArray, TriangleIndexArray} from '../index_array_type';
import earcut from 'earcut';
import classifyRings from '../../util/classify_rings';
import assert from 'assert';
const EARCUT_MAX_RINGS = 500;
import {register} from '../../util/web_worker_transfer';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features';
import loadGeometry from '../load_geometry';
import toEvaluationFeature from '../evaluation_feature';
import EvaluationParameters from '../../style/evaluation_parameters';
import {ElevationFeatureSampler, type ElevationFeature, type Range} from '../../../3d-style/elevation/elevation_feature';
import {MARKUP_ELEVATION_BIAS, PROPERTY_ELEVATION_ID, PROPERTY_ELEVATION_ROAD_BASE_Z_LEVEL} from '../../../3d-style/elevation/elevation_constants';
import {ElevatedStructures} from '../../../3d-style/elevation/elevated_structures';

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
import type IndexBuffer from '../../gl/index_buffer';
import type VertexBuffer from '../../gl/vertex_buffer';
import type {FeatureStates} from '../../source/source_state';
import type {SpritePositions} from '../../util/image';
import type {ProjectionSpecification} from '../../style-spec/types';
import type {TileTransform} from '../../geo/projection/tile_transform';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {TileFootprint} from '../../../3d-style/util/conflation';
import type {TypedStyleLayer} from '../../style/style_layer/typed_style_layer';
import type Point from '@mapbox/point-geometry';
import type {ElevationPolygons, ElevationPortalGraph} from '../../../3d-style/elevation/elevation_graph';
import type {ImageId} from '../../style-spec/expression/types/image_id';

class FillBufferData {
    layoutVertexArray: FillLayoutArray;
    layoutVertexBuffer: VertexBuffer | undefined;

    elevatedLayoutVertexArray: FillExtLayoutArray | undefined;
    elevatedLayoutVertexBuffer: VertexBuffer | undefined;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer | undefined;

    lineIndexArray: LineIndexArray;
    lineIndexBuffer: IndexBuffer | undefined;

    triangleSegments: SegmentVector;
    lineSegments: SegmentVector;

    programConfigurations: ProgramConfigurationSet<FillStyleLayer>;
    uploaded: boolean;

    heightRange: Range | undefined;

    constructor(options: BucketParameters<FillStyleLayer>, elevated: boolean) {
        this.layoutVertexArray = new FillLayoutArray();
        this.indexArray = new TriangleIndexArray();
        this.lineIndexArray = new LineIndexArray();
        this.triangleSegments = new SegmentVector();
        this.lineSegments = new SegmentVector();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, {zoom: options.zoom, lut: options.lut});
        this.uploaded = false;

        if (elevated) {
            this.elevatedLayoutVertexArray = new FillExtLayoutArray();
        }
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: ImageId[], imagePositions: SpritePositions, layers: Array<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null) {
        this.programConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness);
    }

    isEmpty(): boolean {
        return this.layoutVertexArray.length === 0;
    }

    needsUpload(): boolean {
        return this.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, fillLayoutAttributes.members);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);
            this.lineIndexBuffer = context.createIndexBuffer(this.lineIndexArray);

            if (this.elevatedLayoutVertexArray && this.elevatedLayoutVertexArray.length > 0) {
                assert(this.layoutVertexArray.length === this.elevatedLayoutVertexArray.length);
                this.elevatedLayoutVertexBuffer = context.createVertexBuffer(this.elevatedLayoutVertexArray, fillLayoutAttributesExt.members);
            }
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        if (this.elevatedLayoutVertexBuffer) {
            this.elevatedLayoutVertexBuffer.destroy();
        }
        this.layoutVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.lineIndexBuffer.destroy();
        this.programConfigurations.destroy();
        this.triangleSegments.destroy();
        this.lineSegments.destroy();
    }

    populatePaintArrays(feature: BucketFeature, index: number, imagePositions: SpritePositions, availableImages: ImageId[], canonical: CanonicalTileID, brightness?: number | null) {
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, availableImages, canonical, brightness);
    }
}

interface ElevationParams {
    elevation: ElevationFeature;
    elevationSampler: ElevationFeatureSampler;
    bias: number;
    index: number;
}

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

    bufferData: FillBufferData;
    elevationBufferData: FillBufferData;

    hasPattern: boolean;

    uploaded: boolean;
    projection: ProjectionSpecification;

    elevationMode: 'none' | 'hd-road-base' | 'hd-road-markup';
    elevatedStructures: ElevatedStructures | undefined;

    constructor(options: BucketParameters<FillStyleLayer>) {
        this.zoom = options.zoom;
        this.pixelRatio = options.pixelRatio;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.index = options.index;
        this.hasPattern = false;
        this.patternFeatures = [];

        this.bufferData = new FillBufferData(options, false);
        this.elevationBufferData = new FillBufferData(options, true);

        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.projection = options.projection;

        this.elevationMode = this.layers[0].layout.get('fill-elevation-reference');
    }

    updateFootprints(_id: UnwrappedTileID, _footprints: Array<TileFootprint>) {
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        this.hasPattern = hasPattern('fill', this.layers, this.pixelRatio, options);
        const fillSortKey = this.layers[0].layout.get('fill-sort-key');
        const bucketFeatures = [];

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;

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
                // a.sortKey is always a number when in use
                return (a.sortKey as number) - (b.sortKey as number);
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
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: ImageId[], imagePositions: SpritePositions, layers: Array<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null) {
        this.bufferData.update(states, vtLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness);
        this.elevationBufferData.update(states, vtLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness);
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: ImageId[], _: TileTransform, brightness?: number | null) {
        for (const feature of this.patternFeatures) {
            this.addFeature(feature, feature.geometry, feature.index, canonical, imagePositions, availableImages, brightness, options.elevationFeatures);
        }
    }

    isEmpty(): boolean {
        return this.bufferData.isEmpty() && this.elevationBufferData.isEmpty();
    }

    uploadPending(): boolean {
        return !this.uploaded || this.bufferData.needsUpload() || this.elevationBufferData.needsUpload();
    }

    upload(context: Context) {
        this.bufferData.upload(context);
        this.elevationBufferData.upload(context);
        if (this.elevatedStructures) {
            this.elevatedStructures.upload(context);
        }
    }

    destroy() {
        this.bufferData.destroy();
        this.elevationBufferData.destroy();
        if (this.elevatedStructures) {
            this.elevatedStructures.destroy();
        }
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: ImageId[] = [], brightness?: number | null, elevationFeatures?: ElevationFeature[]) {
        const polygons = classifyRings(geometry, EARCUT_MAX_RINGS);

        if (this.elevationMode !== 'none') {
            this.addElevatedRoadFeature(feature, polygons, canonical, index, elevationFeatures);
        } else {
            this.addGeometry(polygons, this.bufferData);
        }
        this.bufferData.populatePaintArrays(feature, index, imagePositions, availableImages, canonical, brightness);
        this.elevationBufferData.populatePaintArrays(feature, index, imagePositions, availableImages, canonical, brightness);
    }

    getUnevaluatedPortalGraph(): ElevationPortalGraph | undefined {
        return this.elevatedStructures ? this.elevatedStructures.unevaluatedPortals : undefined;
    }

    getElevationPolygons(): ElevationPolygons | undefined {
        return this.elevatedStructures ? this.elevatedStructures.portalPolygons : undefined;
    }

    setEvaluatedPortalGraph(graph: ElevationPortalGraph) {
        if (this.elevatedStructures) {
            this.elevatedStructures.construct(graph);
        }
    }

    private addElevatedRoadFeature(feature: BucketFeature, polygons: Point[][][], canonical: CanonicalTileID, index: number, elevationFeatures?: ElevationFeature[]) {
        interface ElevatedGeometry {
            polygons: Point[][][];
            elevationFeature: ElevationFeature;
            elevationTileID: CanonicalTileID;
        }

        const elevatedGeometry = new Array<ElevatedGeometry>();

        // Layers using vector sources should always use the precomputed elevation.
        // In case of geojson sources the elevation snapshot will be used instead
        const tiledElevation = this.getElevationFeature(feature, elevationFeatures);
        if (tiledElevation) {
            elevatedGeometry.push({polygons, elevationFeature: tiledElevation, elevationTileID: canonical});
        } else {
            // No elevation data available at all
            this.addGeometry(polygons, this.bufferData);
            return;
        }

        for (const elevated of elevatedGeometry) {
            if (elevated.elevationFeature) {
                if (this.elevationMode === 'hd-road-base') {
                    if (!this.elevatedStructures) {
                        this.elevatedStructures = new ElevatedStructures(elevated.elevationTileID);
                    }

                    const isTunnel = elevated.elevationFeature.isTunnel();
                    // Parse zLevel properties
                    let zLevel = 0;
                    if (feature.properties.hasOwnProperty(PROPERTY_ELEVATION_ROAD_BASE_Z_LEVEL)) {
                        zLevel = +feature.properties[PROPERTY_ELEVATION_ROAD_BASE_Z_LEVEL];
                    }

                    // Create "elevated structures" for polygons using "road" elevation mode that
                    // contains additional bridge and tunnel geometries for rendering. Additive "markup" features are
                    // stacked on top of another elevated layers and do not need these structures of their own
                    for (const polygon of elevated.polygons) {
                        // Overlapping edges between adjacent polygons form "portals", i.e. entry & exit points
                        // useful for traversing elevated polygons
                        this.elevatedStructures.addPortalCandidates(
                            elevated.elevationFeature.id, polygon, isTunnel, elevated.elevationFeature, zLevel
                        );
                    }
                }

                const elevationSampler = new ElevationFeatureSampler(canonical, elevated.elevationTileID);

                if (this.elevationMode === 'hd-road-base') {
                    this.addElevatedGeometry(elevated.polygons, elevationSampler, elevated.elevationFeature, 0.0, index);
                } else {
                    // Apply slight height bias to "markup" polygons to remove z-fighting
                    this.addElevatedGeometry(elevated.polygons, elevationSampler, elevated.elevationFeature, MARKUP_ELEVATION_BIAS, index);
                }
            }
        }
    }

    private addElevatedGeometry(polygons: Point[][][], elevationSampler: ElevationFeatureSampler, elevation: ElevationFeature, bias: number, index: number) {
        const elevationParams = <ElevationParams>{elevation, elevationSampler, bias, index};
        const [min, max] = this.addGeometry(polygons, this.elevationBufferData, elevationParams);

        if (this.elevationBufferData.heightRange == null) {
            this.elevationBufferData.heightRange = <Range>{min, max};
        } else {
            this.elevationBufferData.heightRange.min = Math.min(this.elevationBufferData.heightRange.min, min);
            this.elevationBufferData.heightRange.max = Math.max(this.elevationBufferData.heightRange.max, max);
        }
    }

    private addGeometry(polygons: Point[][][], bufferData: FillBufferData, elevationParams?: ElevationParams): [number, number] {
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

        const addElevatedVertex = (point: Point, points: Point[], heights: number[]) => {
            if (elevationParams == null) return;

            points.push(point);

            // Sample elevation feature to find interpolated heights for each added vertex.
            if (constantHeight != null) {
                bufferData.elevatedLayoutVertexArray.emplaceBack(constantHeight);
                heights.push(constantHeight);
            } else {
                const height = elevationParams.elevationSampler.pointElevation(point, elevationParams.elevation, elevationParams.bias);
                bufferData.elevatedLayoutVertexArray.emplaceBack(height);
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

            const indices: number[] = earcut(flattened, holeIndices);
            assert(indices.length % 3 === 0);

            for (let i = 0; i < indices.length; i += 3) {
                bufferData.indexArray.emplaceBack(
                    triangleIndex + indices[i],
                    triangleIndex + indices[i + 1],
                    triangleIndex + indices[i + 2]);
            }

            if (elevationParams && this.elevationMode === 'hd-road-base') {
                const isTunnel = elevationParams.elevation.isTunnel();
                const safeArea = elevationParams.elevation.safeArea;
                const vOffset = this.elevatedStructures.addVertices(points, heights);
                this.elevatedStructures.addTriangles(indices, vOffset, isTunnel);

                const ringCount = ringVertexOffsets.length;
                if (ringCount > 0) {
                    for (let i = 0; i < ringCount - 1; i++) {
                        this.elevatedStructures.addRenderableRing(
                            elevationParams.index, ringVertexOffsets[i] + vOffset, ringVertexOffsets[i + 1] - ringVertexOffsets[i], isTunnel, safeArea
                        );
                    }
                    this.elevatedStructures.addRenderableRing(
                        elevationParams.index, ringVertexOffsets[ringCount - 1] + vOffset, points.length - ringVertexOffsets[ringCount - 1], isTunnel, safeArea
                    );
                }
            }

            triangleSegment.vertexLength += numVertices;
            triangleSegment.primitiveLength += indices.length / 3;
        }

        return [min, max];
    }

    private getElevationFeature(feature: BucketFeature, elevationFeatures?: ElevationFeature[]): ElevationFeature | undefined {
        if (!elevationFeatures) return undefined;

        const value = +feature.properties[PROPERTY_ELEVATION_ID];
        if (value == null) return undefined;

        return elevationFeatures.find(f => f.id === value);
    }
}

register(FillBucket, 'FillBucket', {omit: ['layers', 'patternFeatures']});
register(FillBufferData, 'FillBufferData');
register(ElevatedStructures, 'ElevatedStructures');

export default FillBucket;
