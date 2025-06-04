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
import {EdgeIterator, ElevationFeatures, ElevationFeatureSampler, type ElevationFeature, type Range} from '../../../3d-style/elevation/elevation_feature';
import {ELEVATION_CLIP_MARGIN, MARKUP_ELEVATION_BIAS, PROPERTY_ELEVATION_ROAD_BASE_Z_LEVEL} from '../../../3d-style/elevation/elevation_constants';
import {ElevatedStructures, type FeatureInfo} from '../../../3d-style/elevation/elevated_structures';
import Point from '@mapbox/point-geometry';
import {tileToMeter} from '../../geo/mercator_coordinate';
import {clip, polygonSubdivision} from '../../util/polygon_clipping';
import EXTENT from '../../style-spec/data/extent';
import {computeBounds} from '../../style-spec/util/geometry_util';

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
import type {ElevationPolygons, ElevationPortalGraph} from '../../../3d-style/elevation/elevation_graph';
import type {ImageId} from '../../style-spec/expression/types/image_id';
import type {LUT} from '../../util/lut';

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

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: ImageId[], imagePositions: SpritePositions, layers: ReadonlyArray<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null, worldview?: string) {
        this.programConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness, worldview);
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

    populatePaintArrays(feature: BucketFeature, index: number, imagePositions: SpritePositions, availableImages: ImageId[], canonical: CanonicalTileID, brightness?: number | null, worldview?: string) {
        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, availableImages, canonical, brightness, undefined, worldview);
    }
}

interface ElevationParams {
    elevation: ElevationFeature;
    elevationSampler: ElevationFeatureSampler;
    bias: number;
    index: number;
    featureInfo: FeatureInfo;
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
    lut: LUT | null;

    bufferData: FillBufferData;
    elevationBufferData: FillBufferData;

    hasPattern: boolean;

    uploaded: boolean;
    projection: ProjectionSpecification;

    elevationMode: 'none' | 'hd-road-base' | 'hd-road-markup';
    elevatedStructures: ElevatedStructures | undefined;

    sourceLayerIndex: number;

    worldview: string;

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

        this.bufferData = new FillBufferData(options, false);
        this.elevationBufferData = new FillBufferData(options, true);

        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.projection = options.projection;

        this.elevationMode = this.layers[0].layout.get('fill-elevation-reference');

        this.sourceLayerIndex = options.sourceLayerIndex;

        this.worldview = options.worldview;
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

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom, {worldview: this.worldview}), evaluationFeature, canonical))
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

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: ImageId[], imagePositions: SpritePositions, layers: ReadonlyArray<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null) {
        this.bufferData.update(states, vtLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness, this.worldview);
        this.elevationBufferData.update(states, vtLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness, this.worldview);
        if (this.elevatedStructures) {
            this.elevatedStructures.update(states, vtLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness, this.worldview);
        }
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
        this.bufferData.populatePaintArrays(feature, index, imagePositions, availableImages, canonical, brightness, this.worldview);
        this.elevationBufferData.populatePaintArrays(feature, index, imagePositions, availableImages, canonical, brightness, this.worldview);
    }

    getUnevaluatedPortalGraph(): ElevationPortalGraph | undefined {
        return this.elevatedStructures ? this.elevatedStructures.unevaluatedPortals : undefined;
    }

    getElevationPolygons(): ElevationPolygons | undefined {
        return this.elevatedStructures ? this.elevatedStructures.portalPolygons : undefined;
    }

    setEvaluatedPortalGraph(graph: ElevationPortalGraph, vtLayer: VectorTileLayer, canonical: CanonicalTileID, availableImages: ImageId[], brightness: number) {
        if (this.elevatedStructures) {
            this.elevatedStructures.construct(graph);
            this.elevatedStructures.populatePaintArrays(vtLayer, canonical, availableImages, brightness, this.worldview);
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
        const tiledElevation = ElevationFeatures.getElevationFeature(feature, elevationFeatures);
        if (tiledElevation) {
            const clipped = this.clipPolygonsToTile(polygons, ELEVATION_CLIP_MARGIN);
            if (clipped.length > 0) {
                elevatedGeometry.push({polygons: clipped, elevationFeature: tiledElevation, elevationTileID: canonical});
            }
        } else {
            // No elevation data available at all
            this.addGeometry(polygons, this.bufferData);
            return;
        }

        const constructBridgeGuardRail = this.layers[0].layout.get('fill-construct-bridge-guard-rail').evaluate(feature, {}, canonical);
        const featureInfo: FeatureInfo = {guardRailEnabled: constructBridgeGuardRail, featureIndex: index};

        for (const elevated of elevatedGeometry) {
            if (elevated.elevationFeature) {
                if (this.elevationMode === 'hd-road-base') {
                    if (!this.elevatedStructures) {
                        this.elevatedStructures = new ElevatedStructures(elevated.elevationTileID, this.layers, this.zoom, this.lut);
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

                if (elevated.elevationFeature.constantHeight == null) {
                    elevated.polygons = this.prepareElevatedPolygons(elevated.polygons, elevated.elevationFeature, elevated.elevationTileID);
                }

                const elevationSampler = new ElevationFeatureSampler(canonical, elevated.elevationTileID);

                if (this.elevationMode === 'hd-road-base') {
                    this.addElevatedGeometry(elevated.polygons, elevationSampler, elevated.elevationFeature, 0.0, index, featureInfo);
                } else {
                    // Apply slight height bias to "markup" polygons to remove z-fighting
                    this.addElevatedGeometry(elevated.polygons, elevationSampler, elevated.elevationFeature, MARKUP_ELEVATION_BIAS, index, featureInfo);
                }
            }
        }
    }

    private addElevatedGeometry(polygons: Point[][][], elevationSampler: ElevationFeatureSampler, elevation: ElevationFeature, bias: number, index: number, featureInfo: FeatureInfo) {
        const elevationParams: ElevationParams = {elevation, elevationSampler, bias, index, featureInfo};
        const [min, max] = this.addGeometry(polygons, this.elevationBufferData, elevationParams);

        if (this.elevationBufferData.heightRange == null) {
            this.elevationBufferData.heightRange = {min, max} as Range;
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

            if (indices.length > 0 && elevationParams && this.elevationMode === 'hd-road-base') {
                const isTunnel = elevationParams.elevation.isTunnel();
                const safeArea = elevationParams.elevation.safeArea;
                const vOffset = this.elevatedStructures.addVertices(points, heights);
                this.elevatedStructures.addTriangles(indices, vOffset, isTunnel);

                const ringCount = ringVertexOffsets.length;
                if (ringCount > 0) {
                    for (let i = 0; i < ringCount - 1; i++) {
                        this.elevatedStructures.addRenderableRing(
                            elevationParams.index, ringVertexOffsets[i] + vOffset, ringVertexOffsets[i + 1] - ringVertexOffsets[i], isTunnel, safeArea, elevationParams.featureInfo
                        );
                    }
                    this.elevatedStructures.addRenderableRing(
                        elevationParams.index, ringVertexOffsets[ringCount - 1] + vOffset, points.length - ringVertexOffsets[ringCount - 1], isTunnel, safeArea, elevationParams.featureInfo
                    );
                }
            }

            triangleSegment.vertexLength += numVertices;
            triangleSegment.primitiveLength += indices.length / 3;
        }

        return [min, max];
    }

    private prepareElevatedPolygons(polygons: Point[][][], elevation: ElevationFeature, tileID: CanonicalTileID): Point[][][] {
        // Subdivide the polygon along the assigned elevation curve
        const metersToTile = 1.0 / tileToMeter(tileID);
        const clippedPolygons: Point[][][] = [];

        for (const poly of polygons) {
            const clippedPoly = polygonSubdivision(poly, new EdgeIterator(elevation, metersToTile));
            clippedPolygons.push(...clippedPoly);
        }

        return clippedPolygons;
    }

    private clipPolygonsToTile(polygons: Point[][][], margin: number): Point[][][] {
        const minX = -margin;
        const minY = -margin;
        const maxX = EXTENT + margin;
        const maxY = EXTENT + margin;

        // Find polygons potentially intersecting with boundaries and hence requiring clipping
        let clipIdx = 0;
        const noClippingGroup: Point[][][] = [];
        const clippingGroup: Point[][][] = [];

        for (; clipIdx < polygons.length; clipIdx++) {
            const polygon = polygons[clipIdx];
            assert(polygon.length > 0);

            const bounds = computeBounds(polygon);
            const noClipping = bounds.min.x >= minX && bounds.max.x <= maxX && bounds.min.y >= minY && bounds.max.y <= maxY;
            const dst = noClipping ? noClippingGroup : clippingGroup;
            dst.push(polygon);
        }

        if (noClippingGroup.length === polygons.length) return polygons;

        const clipPoly = [
            new Point(minX, minY),
            new Point(maxX, minY),
            new Point(maxX, maxY),
            new Point(minX, maxY),
            new Point(minX, minY)
        ];

        const clippedPolygons = noClippingGroup;
        for (const poly of clippingGroup) {
            clippedPolygons.push(...clip(poly, clipPoly));
        }

        return clippedPolygons;
    }
}

register(FillBucket, 'FillBucket', {omit: ['layers', 'patternFeatures']});
register(FillBufferData, 'FillBufferData');
register(ElevatedStructures, 'ElevatedStructures');

export default FillBucket;
