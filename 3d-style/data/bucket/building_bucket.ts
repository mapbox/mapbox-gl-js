import {BuildingPositionArray, BuildingNormalArray, BuildingColorArray, BuildingBloomAttenuationArray} from '../../../src/data/array_types';
import {calculateLightsMesh} from '../../source/model_loader';
import {clamp} from '../../../src/util/util';
import EvaluationParameters from '../../../src/style/evaluation_parameters';
import {buildingPositionAttributes, buildingNormalAttributes, buildingColorAttributes, buildingBloomAttenuationAttributes} from '../building_attributes';
import loadGeometry from '../../../src/data/load_geometry';
import {ProgramConfigurationSet} from '../../../src/data/program_configuration';
import {register} from '../../../src/util/web_worker_transfer';
import SegmentVector, {type Segment} from '../../../src/data/segment';
import {tileToMeter} from '../../../src/geo/mercator_coordinate';
import toEvaluationFeature from '../../../src/data/evaluation_feature';
import {TriangleIndexArray} from '../../../src/data/index_array_type';
import {GroundEffect} from '../../../src/data/bucket/fill_extrusion_bucket';
import Point from '@mapbox/point-geometry';
import {VectorTileFeature} from '@mapbox/vector-tile';
const vectorTileFeatureTypes = VectorTileFeature.types;
import {waitForBuildingGen, getBuildingGen} from '../../util/loaders';
import {footprintTrianglesIntersect, pointInFootprint, regionsEquals, ReplacementOrderBuilding, type Region, type ReplacementSource} from '../../source/replacement_source';
import TriangleGridIndex from '../../../src/util/triangle_grid_index';
import earcut from 'earcut';
import assert from 'assert';
import EXTENT from '../../../src/style-spec/data/extent';
import classifyRings from '../../../src/util/classify_rings';
import {PerformanceUtils} from '../../../src/util/performance';

import type {OverscaledTileID, UnwrappedTileID, CanonicalTileID} from '../../../src/source/tile_id';
import type {BucketParameters, IndexedFeature, PopulateParameters} from '../../../src/data/bucket';
import type BuildingStyleLayer from '../../style/style_layer/building_style_layer';
import type Context from '../../../src/gl/context';
import type {EvaluationFeature} from '../../../src/data/evaluation_feature';
import type {FeatureStates} from '../../../src/source/source_state';
import type {ImageId} from '../../../src/style-spec/expression/types/image_id';
import type IndexBuffer from '../../../src/gl/index_buffer';
import type {SpritePositions} from '../../../src/util/image';
import type {Style, Feature, Facade} from '../../util/building_gen';
import type {Footprint, TileFootprint} from '../../util/conflation';
import type {TileTransform} from '../../../src/geo/projection/tile_transform';
import type {TypedStyleLayer} from '../../../src/style/style_layer/typed_style_layer';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type VertexBuffer from '../../../src/gl/vertex_buffer';
import type {ProjectionSpecification} from '../../../src/style-spec/types';
import type Painter from '../../../src/render/painter';
import type {BucketWithGroundEffect} from '../../../src/render/draw_fill_extrusion';
import type {AreaLight} from '../model';
import type {vec3, vec4} from 'gl-matrix';
import type Color from '../../../src/style-spec/util/color';

export const BUILDING_VISIBLE: number = 0x0;
export const BUILDING_HIDDEN_BY_REPLACEMENT: number = 0x1;
export const BUILDING_HIDDEN_BY_TILE_BORDER_DEDUPLICATION: number = 0x2;

const MAX_INT_16 = 32767.0;

// Refer to https://github.com/mapbox/geodata-exports/blob/e863d358e04ade6301db95c6f96d1340560f7b93/pipelines/export_map_data/dags/mts_recipes/procedural_buildings_v1/procedural_buildings.json#L62
const BUILDING_TILE_PADDING = 163; // ~= 2.0% * 8192 according to the buffer_size used to generate the tile set.

function geometryFullyInsideTile(geometry: Point[][], padding: number): boolean {
    const extentWithPadding = EXTENT + padding;
    for (const polygon of geometry) {
        for (const point of polygon) {
            if (point.x < -padding || point.x > extentWithPadding || point.y < -padding || point.y > extentWithPadding) {
                return false;
            }
        }
    }
    return true;
}

interface BuildingFootprint extends Footprint {
    segment: Segment;
    hiddenFlags: number;
    indicesOffset: number;
    indicesLength: number;
    bloomIndicesOffset: number;
    bloomIndicesLength: number;
    groundEffectVertexOffset: number;
    groundEffectVertexLength: number;
    height: number;
}

type BuildingFeatureOnBorder = {
    featureId: number;
    footprintIndex: number;
};
type BuildingPartName = "roof" | "wall" | "facade_glazing" | "entrance";

interface BuildingFeaturePart {
    part: BuildingPartName,
    vertexOffset: number;
    vertexLength: number;
};

interface BuildingFeature {
    feature: EvaluationFeature,
    segment: Segment,
    parts: BuildingFeaturePart[],
    buildingBloom: BuildingFeaturePart
};

interface BuildingBloomGeometry {
    layoutVertexArray: BuildingPositionArray;
    layoutVertexBuffer: VertexBuffer;

    layoutAttenuationArray: BuildingBloomAttenuationArray;
    layoutAttenuationBuffer: VertexBuffer;

    layoutColorArray: BuildingColorArray;
    layoutColorBuffer: VertexBuffer;

    indexArray: TriangleIndexArray;
    indexArrayForConflation: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    segmentsBucket: SegmentVector;
}

class BuildingBucket implements BucketWithGroundEffect {
    index: number;
    zoom: number;
    brightness: number | null | undefined;
    canonical: CanonicalTileID;
    layers: Array<BuildingStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<BuildingStyleLayer>;
    stateDependentLayerIds: Array<string>;

    layoutVertexArray: BuildingPositionArray;
    layoutVertexBuffer: VertexBuffer;

    layoutNormalArray: BuildingNormalArray;
    layoutNormalBuffer: VertexBuffer;

    layoutColorArray: BuildingColorArray;
    layoutColorBuffer: VertexBuffer;

    layoutAOArray: Array<number> = [];

    indexArray: TriangleIndexArray;
    indexArrayForConflation: TriangleIndexArray;
    indexArrayForConflationUploaded: boolean = false;
    indexBuffer: IndexBuffer;

    entranceBloom: BuildingBloomGeometry;

    hasPattern: boolean;
    worldview: string;

    programConfigurations: ProgramConfigurationSet<BuildingStyleLayer>;
    private segmentsBucket: SegmentVector;
    uploaded: boolean;

    maxHeight: number = 0;

    projection: ProjectionSpecification;
    tileToMeter: number;
    groundEffect: GroundEffect;
    replacementUpdateTime: number = 0;
    activeReplacements: Region[] = [];

    footprints: Array<BuildingFootprint> = [];
    featuresOnBorder: Array<BuildingFeatureOnBorder> = [];
    buildingFeatures: Array<BuildingFeature> = [];

    public get segments(): SegmentVector {
        return this.segmentsBucket;
    }

    public get bloomGeometry(): BuildingBloomGeometry {
        return this.entranceBloom;
    }

    footprintLookup: {
        [_: number]: BuildingFootprint | null | undefined;
    };

    constructor(options: BucketParameters<BuildingStyleLayer>) {

        this.footprintLookup = {};

        this.zoom = options.zoom;
        this.canonical = options.canonical;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.index = options.index;
        this.hasPattern = false;
        this.worldview = options.worldview;

        this.layoutVertexArray = new BuildingPositionArray();
        this.layoutNormalArray = new BuildingNormalArray();
        this.layoutColorArray = new BuildingColorArray();
        this.indexArray = new TriangleIndexArray();
        this.indexArrayForConflation = new TriangleIndexArray();

        this.entranceBloom = {
            layoutVertexArray: new BuildingPositionArray(),
            layoutVertexBuffer: null,
            layoutAttenuationArray: new BuildingBloomAttenuationArray(),
            layoutAttenuationBuffer: null,
            layoutColorArray: new BuildingColorArray(),
            layoutColorBuffer: null,
            indexArray: new TriangleIndexArray(),
            indexArrayForConflation: new TriangleIndexArray(),
            indexBuffer: null,
            segmentsBucket: new SegmentVector()
        };

        this.programConfigurations = new ProgramConfigurationSet(options.layers, {zoom: options.zoom, lut: options.lut});
        this.segmentsBucket = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.projection = options.projection;

        this.groundEffect = new GroundEffect(options);
    }

    updateFootprints(_id: UnwrappedTileID, _footprints: Array<TileFootprint>) {
        for (const footprint of this.footprints) {
            _footprints.push({
                footprint,
                id: _id
            });
        }
    }

    prepare(): Promise<unknown> {
        return waitForBuildingGen();
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        const m = PerformanceUtils.beginMeasure('BuildingBucket:populate');

        const buildingGen = getBuildingGen();
        if (!buildingGen) {
            return;
        }

        const tileToMeters = tileToMeter(canonical);
        this.tileToMeter = tileToMeters;
        this.brightness = options.brightness;

        // Some parameters sent to building-gen were found experimentally, we need to decide
        // what needs to be made configurable.
        const style: Style = {
            convertToMeters: false,
            entranceColorRgb: [1.0, 1.0, 1.0],
            facadeGlazingColorRgb: [0.5607843137254902, 0.6745098039215687, 0.7215686274509804],
            normalScale: [1.0, -1.0, tileToMeters],
            ridgeHeight: 3.0,
            roofColorRgb: [0.886274516, 0.784313738, 0.713725507],
            tileToMeters,
            tileZoom: 16,
            wallColorRgb: [0.988235294, 0.933333337, 0.811764717]
        };
        buildingGen.setStyle(style);
        buildingGen.setAOOptions(false, 0.3);
        buildingGen.setMetricOptions(false, 16);
        buildingGen.setStructuralOptions(true);
        buildingGen.setFacadeOptions(4.0, true);
        buildingGen.setFauxFacadeOptions(false, false, 1.0);
        buildingGen.setFacadeClassifierOptions(3.0);

        // First, we process facade data
        const facadeDataForFeature = new Map<string | number | boolean, Facade[]>();
        for (const {feature} of features) {
            const isFacade = vectorTileFeatureTypes[feature.type] === 'LineString';
            if (!isFacade) {
                continue;
            }

            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;

            const geometry = needGeometry ? evaluationFeature.geometry : loadGeometry(feature, canonical, tileTransform);

            const coordinates = [];
            for (const polygon of geometry) {
                for (const point of polygon) {
                    coordinates.push({x: point.x, y: point.y});
                }
            }

            const facadeProperties: Facade = {
                coordinates,
                crossPerc: feature.properties.cross_perc as number,
                distanceToRoad: feature.properties.distance_to_road as number,
                entrances: feature.properties.entrances as string,
                sourceId: 0
            };

            const sourceId = feature.properties.source_id;
            let facades = facadeDataForFeature.get(sourceId);
            if (!facades) {
                facades = [];
                facadeDataForFeature.set(sourceId, facades);
            }

            facades.push(facadeProperties);
        }

        this.maxHeight = 0;

        // Next, we process the building footprints, and combine them
        // with the facade data.
        for (const {feature, index} of features) {
            const isFacade = vectorTileFeatureTypes[feature.type] === 'LineString';
            if (isFacade) {
                continue;
            }

            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;

            const geometry = needGeometry ? evaluationFeature.geometry : loadGeometry(feature, canonical, tileTransform);

            const EARCUT_MAX_RINGS = 500;
            const classifiedRings = classifyRings(geometry, EARCUT_MAX_RINGS);

            // Do not render data beyond tile buffer/padding
            if (!geometryFullyInsideTile(geometry, BUILDING_TILE_PADDING)) {
                continue;
            }

            const layer = this.layers[0];
            const base = layer.layout.get('building-base').evaluate(feature, {}, canonical);
            const height = layer.layout.get('building-height').evaluate(feature, {}, canonical);
            const buildingRoofShape = layer.layout.get('building-roof-shape').evaluate(feature, {}, canonical);
            const aoIntensity = layer.paint.get('building-ambient-occlusion-intensity');
            const aoGroundRadius = layer.paint.get('building-ambient-occlusion-ground-radius');
            const maxRadius = aoGroundRadius / this.tileToMeter;

            // Skip flat roofs -> render as fill-extrusion
            if (buildingRoofShape === 'flat') {
                continue;
            }

            const sourceId = feature.properties.source_id;
            let facades: Facade[];
            if (facadeDataForFeature.has(sourceId)) {
                facades = facadeDataForFeature.get(sourceId);
            } else {
                facades = [];
            }

            const buildingGenFeatures = [];
            const bboxMin = new Point(Infinity, Infinity);
            const bboxMax = new Point(-Infinity, -Infinity);
            for (const polygon of classifiedRings) {
                if (polygon.length > 0) {
                    const coordinates = [];
                    for (const ring of polygon) {
                        const polygonCoords = [];

                        // We need to flip the footprint for now, but ideally
                        // building-gen will support the winding received from
                        // the source data.
                        for (let i = ring.length - 1; i >= 0; i--) {
                            const point = ring[i];
                            polygonCoords.push({x: point.x, y: point.y});

                            bboxMin.x = Math.min(bboxMin.x, point.x);
                            bboxMin.y = Math.min(bboxMin.y, point.y);
                            bboxMax.x = Math.max(bboxMax.x, point.x);
                            bboxMax.y = Math.max(bboxMax.y, point.y);
                        }
                        coordinates.push(polygonCoords);
                    }

                    const featureInput: Feature = {
                        id: feature.id,
                        height,
                        minHeight: base,
                        sourceId: 0,
                        roofType: buildingRoofShape,
                        coordinates
                    };
                    buildingGenFeatures.push(featureInput);
                }
            }

            const result = buildingGen.generateMesh(buildingGenFeatures, facades);
            if (typeof result === 'string') {
                continue;
            }
            if (result.meshes.length === 0 || result.modifiedPolygonRings.length === 0) {
                continue;
            }

            let vertexCount = 0;
            for (const mesh of result.meshes) {
                vertexCount += mesh.positions.length / 3;
            }

            const segment = this.segmentsBucket.prepareSegment(vertexCount, this.layoutVertexArray, this.indexArray);
            const buildingParts = [];
            let buildingBloom: BuildingFeaturePart = null;
            let bloomIndicesOffset = 0;
            let bloomIndicesLength = -1;

            const indexArrayRangeStartOffset = this.indexArray.length;
            let footprintHeight = 0;
            for (const mesh of result.meshes) {
                const partVertexOffset = this.layoutVertexArray.length;
                if (mesh.buildingPart === "entrance") {
                    const areaLights = new Array<AreaLight>();
                    // Doors are represented as four vertices each, so we need to process them in
                    // groups of 12 vertices (3 vertices per corner, 4 corners). The first two are
                    // the bottom corners, and the other two are the top corners. We use the bottom
                    // corners to calculate the position and normal of the area light, and only one
                    // of the top vertices to calculate the door height.
                    for (let i = 0; i < mesh.indices.length; i += 12) {
                        const x0 = mesh.positions[i + 0];
                        const y0 = mesh.positions[i + 1];
                        const x1 = mesh.positions[i + 3];
                        const y1 = mesh.positions[i + 4];

                        const elevation = mesh.positions[i + 2];
                        const height = mesh.positions[i + 8] - elevation;

                        const depth = 1.0;

                        const dx = x1 - x0;
                        const dy = y1 - y0;
                        const width = Math.hypot(dx, dy);
                        const normal: vec3 = [dy / width, -dx / width, 0];
                        const pos: vec3 = [x0 + dx * 0.5, y0 + dy * 0.5, elevation];
                        const points: vec4 = [x0, y0, x1, y1];
                        areaLights.push({pos, normal, width, height, depth, points});
                    }

                    // The expected number of vertices is 10 per area light, as calculated in calculateLightsMesh
                    const expectedLightVertices = areaLights.length * 10;
                    const bloomSegment = this.entranceBloom.segmentsBucket.prepareSegment(
                        expectedLightVertices,
                        this.entranceBloom.layoutVertexArray,
                        this.entranceBloom.indexArray
                    );

                    const bloomVertexOffset = this.entranceBloom.layoutVertexArray.length;
                    bloomIndicesOffset = this.entranceBloom.indexArray.length;
                    calculateLightsMesh(areaLights, 0.5 / this.tileToMeter, this.entranceBloom.indexArray, this.entranceBloom.layoutVertexArray, this.entranceBloom.layoutAttenuationArray);

                    const bloomVertexLength = this.entranceBloom.layoutVertexArray.length - bloomVertexOffset;
                    bloomIndicesLength = this.entranceBloom.indexArray.length - bloomIndicesOffset;

                    for (let p = 0; p < bloomVertexLength; p++) {
                        const fullEmissive = (255 << 8) | 255;
                        this.entranceBloom.layoutColorArray.emplaceBack(fullEmissive, fullEmissive);
                    }

                    bloomSegment.vertexLength += bloomVertexLength;
                    bloomSegment.primitiveLength += bloomIndicesLength;

                    buildingBloom = {
                        part: mesh.buildingPart,
                        vertexOffset: bloomVertexOffset,
                        vertexLength: bloomVertexLength
                    };
                }

                for (let p = 0; p < mesh.positions.length; p += 3) {
                    footprintHeight = Math.max(footprintHeight, mesh.positions[p + 2]);
                    this.layoutVertexArray.emplaceBack(mesh.positions[p], mesh.positions[p + 1], mesh.positions[p + 2]);
                }

                for (let n = 0; n < mesh.normals.length; n += 3) {
                    const nx = mesh.normals[n + 0] * MAX_INT_16;
                    const ny = mesh.normals[n + 1] * MAX_INT_16;
                    const nz = mesh.normals[n + 2] * MAX_INT_16;
                    this.layoutNormalArray.emplaceBack(nx, ny, nz);
                }

                for (let a = 0; a < mesh.ao.length; a++) {
                    this.layoutAOArray.push(mesh.ao[a]);
                }

                for (let c = 0; c < mesh.colors.length; c += 3) {
                    const colorFactor = 1.0 + (mesh.ao[c / 3] - 1.0) * aoIntensity;

                    const r = mesh.colors[c] * colorFactor;
                    const g = mesh.colors[c + 1] * colorFactor;
                    const b = mesh.colors[c + 2] * colorFactor;

                    const c1 = (r << 8) | g;
                    const c2 = (b << 8);

                    this.layoutColorArray.emplaceBack(c1, c2);
                }

                const triangleIndex = segment.vertexLength;
                for (let i = 0; i < mesh.indices.length; i += 3) {
                    this.indexArray.emplaceBack(
                        triangleIndex + mesh.indices[i],
                        triangleIndex + mesh.indices[i + 1],
                        triangleIndex + mesh.indices[i + 2]);
                }

                segment.vertexLength += mesh.positions.length / 3;
                segment.primitiveLength += mesh.indices.length / 3;

                if (mesh.buildingPart === "roof" || mesh.buildingPart === "wall" ||
                    mesh.buildingPart === "facade_glazing" || mesh.buildingPart === "entrance") {
                    const buildingFeaturePart: BuildingFeaturePart = {
                        part: mesh.buildingPart,
                        vertexOffset: partVertexOffset,
                        vertexLength: mesh.positions.length / 3
                    };
                    buildingParts.push(buildingFeaturePart);
                }
            }
            this.maxHeight = Math.max(this.maxHeight, footprintHeight);

            const buildingFeature: BuildingFeature = {
                feature: evaluationFeature, segment, parts: buildingParts, buildingBloom
            };
            this.buildingFeatures.push(buildingFeature);

            const indexArrayRangeLength = this.indexArray.length - indexArrayRangeStartOffset;

            const footprintFlattened = [];
            const footprintflattenedPts = [];
            const footprintBoundsMin = new Point(Infinity, Infinity);
            const footprintBoundsMax = new Point(-Infinity, -Infinity);

            // Add ground effect data
            const groundEffectVertexOffset = this.groundEffect.vertexArray.length;

            for (const ring of result.modifiedPolygonRings) {
                const groundPolyline: Array<Point> = [];
                const boundsMin = new Point(Infinity, Infinity);
                const boundsMax = new Point(-Infinity, -Infinity);

                for (let i = 0; i < ring.length; i += 2) {
                    const reverseIdx = ring.length - i - 2;
                    boundsMin.x = Math.min(boundsMin.x, ring[reverseIdx]);
                    boundsMin.y = Math.min(boundsMin.y, ring[reverseIdx + 1]);
                    boundsMax.x = Math.max(boundsMax.x, ring[reverseIdx]);
                    boundsMax.y = Math.max(boundsMax.y, ring[reverseIdx + 1]);
                    const point = new Point(ring[reverseIdx], ring[reverseIdx + 1]);
                    groundPolyline.push(point);

                    footprintFlattened.push(point.x, point.y);
                    footprintflattenedPts.push(point.clone());
                }

                footprintBoundsMin.x = Math.min(footprintBoundsMin.x, boundsMin.x);
                footprintBoundsMin.y = Math.min(footprintBoundsMin.y, boundsMin.y);
                footprintBoundsMax.x = Math.max(footprintBoundsMax.x, boundsMax.x);
                footprintBoundsMax.y = Math.max(footprintBoundsMax.y, boundsMax.y);

                this.groundEffect.addData(groundPolyline, [boundsMin, boundsMax], maxRadius);
            }

            const groundEffectVertexLength = this.groundEffect.vertexArray.length - groundEffectVertexOffset;

            // Check if the feature crosses tile borders
            if (bboxMin.x < 0 || bboxMax.x > EXTENT || bboxMin.y < 0 || bboxMax.y > EXTENT) {
                this.featuresOnBorder.push({featureId: feature.id, footprintIndex: this.footprints.length});
            }

            // Store footprint data for later conflation with fill-extrusions and model layers
            {
                const indices = earcut(footprintFlattened, null, 2);
                assert(indices.length % 3 === 0);
                const grid = new TriangleGridIndex(footprintflattenedPts, indices, 8, 256);

                let buildingOrFeatureId = feature.id;
                if (feature.properties && feature.properties.hasOwnProperty('building_id')) {
                    buildingOrFeatureId = feature.properties['building_id'] as number;
                }

                const footprint = {
                    vertices: footprintflattenedPts,
                    indices,
                    grid,
                    min: footprintBoundsMin,
                    max: footprintBoundsMax,
                    buildingId: buildingOrFeatureId,
                    hiddenFlags: BUILDING_VISIBLE,
                    indicesOffset: indexArrayRangeStartOffset,
                    indicesLength: indexArrayRangeLength,
                    bloomIndicesOffset,
                    bloomIndicesLength,
                    groundEffectVertexOffset,
                    groundEffectVertexLength,
                    segment,
                    height: footprintHeight
                };
                this.footprints.push(footprint);
            }

            this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, {}, options.availableImages, canonical, options.brightness);
            this.groundEffect.addPaintPropertiesData(feature, index, {}, options.availableImages, canonical, options.brightness);
        }

        this.groundEffect.prepareBorderSegments();
        this.evaluate(this.layers[0]);

        PerformanceUtils.endMeasure(m);
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: Array<ImageId>, imagePositions: SpritePositions, layers: ReadonlyArray<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null) {
        this.programConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness);
        this.groundEffect.update(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness);
    }

    isEmpty(): boolean {
        return this.layoutVertexArray.length === 0;
    }

    uploadPending(): boolean {
        return !this.uploaded || this.programConfigurations.needsUpload || this.groundEffect.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        if (!this.uploaded) {
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, buildingPositionAttributes.members);
            this.layoutNormalBuffer = context.createVertexBuffer(this.layoutNormalArray, buildingNormalAttributes.members);
            this.entranceBloom.layoutVertexBuffer = context.createVertexBuffer(this.entranceBloom.layoutVertexArray, buildingPositionAttributes.members);
            this.entranceBloom.layoutAttenuationBuffer = context.createVertexBuffer(this.entranceBloom.layoutAttenuationArray, buildingBloomAttenuationAttributes.members);
            this.uploadUpdatedColorBuffer(context);
            this.uploadUpdatedIndexBuffer(context);
            this.groundEffect.upload(context);
        }
        this.groundEffect.uploadPaintProperties(context);
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    destroy() {
        if (!this.layoutVertexBuffer) {
            return;
        }

        this.layoutVertexBuffer.destroy();
        this.layoutNormalBuffer.destroy();
        this.layoutColorBuffer.destroy();
        this.groundEffect.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segmentsBucket.destroy();

        this.entranceBloom.layoutVertexBuffer.destroy();
        this.entranceBloom.layoutColorBuffer.destroy();
        this.entranceBloom.layoutAttenuationBuffer.destroy();
        this.entranceBloom.indexBuffer.destroy();
        this.entranceBloom.segmentsBucket.destroy();
    }

    public updateFootprintHiddenFlags(footprintIndices: Array<number>, hiddenFlags: number, operationSetFlag = true) {
        let changed = false;
        const orMask = operationSetFlag ? hiddenFlags : 0;
        const andMask = (operationSetFlag ? ~0 : ~hiddenFlags) | 0;

        if (this.groundEffect.hiddenByLandmarkVertexArray.length === 0) {
            this.groundEffect.hiddenByLandmarkVertexArray.resize(this.groundEffect.vertexArray.length);
        }
        for (const footprintIndex of footprintIndices) {
            const footprint = this.footprints[footprintIndex];
            const newHiddenFlags = (footprint.hiddenFlags & andMask) | orMask;
            if (footprint.hiddenFlags !== newHiddenFlags) {
                footprint.hiddenFlags = newHiddenFlags;
                changed = true;
                this.groundEffect.updateHiddenByLandmarkRange(footprint.groundEffectVertexOffset, footprint.groundEffectVertexLength, footprint.hiddenFlags !== BUILDING_VISIBLE);
            }
        }
        if (changed) {
            this.indexArrayForConflationUploaded = false;
        }
        return changed;
    }

    public uploadUpdatedIndexBuffer(context: Context) {
        this.groundEffect.uploadHiddenByLandmark(context);

        if (this.indexArrayForConflationUploaded || this.indexArray.length === 0) {
            return;
        }
        const m = PerformanceUtils.beginMeasure("BuldingBucket:uploadUpdatedIndexBuffer");

        this.indexArrayForConflation.resize(this.indexArray.length);
        this.indexArrayForConflation.uint16.set(this.indexArray.uint16);

        this.entranceBloom.indexArrayForConflation.resize(this.entranceBloom.indexArray.length);
        this.entranceBloom.indexArrayForConflation.uint16.set(this.entranceBloom.indexArray.uint16);

        // Update segments after conflation
        for (const footprint of this.footprints) {
            const footprintIndicesEnd = footprint.indicesOffset + footprint.indicesLength;
            const isVisible = footprint.hiddenFlags === BUILDING_VISIBLE;
            // Instead of removing indices of hidden footprints, use [0,0,0] generate degenerated triangles
            // Alternative would be removing hidden parts and patch segment array for rendering (primitive offsets and length  )
            if (!isVisible) {
                for (let idx = footprint.indicesOffset; idx < footprintIndicesEnd; idx++) {
                    this.indexArrayForConflation.uint16[idx * 3 + 0] = 0;
                    this.indexArrayForConflation.uint16[idx * 3 + 1] = 0;
                    this.indexArrayForConflation.uint16[idx * 3 + 2] = 0;
                }

                const bloomIndicesEnd = footprint.bloomIndicesOffset + footprint.bloomIndicesLength;
                for (let idx = footprint.bloomIndicesOffset; idx < bloomIndicesEnd; idx++) {
                    this.entranceBloom.indexArrayForConflation.uint16[idx * 3 + 0] = 0;
                    this.entranceBloom.indexArrayForConflation.uint16[idx * 3 + 1] = 0;
                    this.entranceBloom.indexArrayForConflation.uint16[idx * 3 + 2] = 0;
                }
            }
        }

        if (!this.indexBuffer) {
            this.indexBuffer = context.createIndexBuffer(this.indexArrayForConflation, true);
        } else {
            this.indexBuffer.updateData(this.indexArrayForConflation);
        }

        if (!this.entranceBloom.indexBuffer) {
            this.entranceBloom.indexBuffer = context.createIndexBuffer(this.entranceBloom.indexArrayForConflation, true);
        } else {
            this.entranceBloom.indexBuffer.updateData(this.entranceBloom.indexArrayForConflation);
        }
        this.indexArrayForConflationUploaded = true;
        PerformanceUtils.endMeasure(m);
    }

    public uploadUpdatedColorBuffer(context: Context) {
        if (!this.layoutColorBuffer) {
            this.layoutColorBuffer = context.createVertexBuffer(this.layoutColorArray, buildingColorAttributes.members, true);
        } else {
            this.layoutColorBuffer.updateData(this.layoutColorArray);
        }

        if (!this.entranceBloom.layoutColorBuffer) {
            this.entranceBloom.layoutColorBuffer = context.createVertexBuffer(this.entranceBloom.layoutColorArray, buildingColorAttributes.members, true);
        } else {
            this.entranceBloom.layoutColorBuffer.updateData(this.entranceBloom.layoutColorArray);
        }
    }

    evaluate(layer: BuildingStyleLayer) {
        const aoIntensity = layer.paint.get('building-ambient-occlusion-intensity');
        for (const buildingFeature of this.buildingFeatures) {
            const feature = buildingFeature.feature;

            feature.properties['building-part'] = 'roof';
            const roofColor = layer.paint.get('building-color').evaluate(feature, {}, this.canonical);
            const roofEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, {}, this.canonical);

            feature.properties['building-part'] = 'wall';
            const wallsColor = layer.paint.get('building-color').evaluate(feature, {}, this.canonical);
            const wallsEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, {}, this.canonical);

            feature.properties['building-part'] = 'window';
            const windowColor = layer.paint.get('building-color').evaluate(feature, {}, this.canonical);
            const windowEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, {}, this.canonical);

            feature.properties['building-part'] = 'door';
            const entranceColor = layer.paint.get('building-color').evaluate(feature, {}, this.canonical);
            const entranceEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, {}, this.canonical);

            for (const buildingPart of buildingFeature.parts) {
                let color: Color = roofColor;
                let emissive: number;
                if (buildingPart.part === "roof") {
                    color = roofColor;
                    emissive = roofEmissive;
                } else if (buildingPart.part === "wall") {
                    color = wallsColor;
                    emissive = wallsEmissive;
                } else if (buildingPart.part === "facade_glazing") {
                    color = windowColor;
                    emissive = windowEmissive;
                } else if (buildingPart.part === "entrance") {
                    color = entranceColor;
                    emissive = entranceEmissive;
                }
                // Clamp emissive so that it can be packed into 8-bit part of the
                // paint buffer. We only use the unclamped value for bloom.
                emissive = clamp(emissive, 0, 1);

                for (let i = 0; i < buildingPart.vertexLength; i++) {
                    const vertexOffset = buildingPart.vertexOffset + i;
                    const colorFactor = 1.0 + (this.layoutAOArray[vertexOffset] - 1.0) * aoIntensity;

                    const r = color.r * colorFactor * 255;
                    const g = color.g * colorFactor * 255;
                    const b = color.b * colorFactor * 255;
                    const e = emissive * 255;
                    const c1 = (r << 8) | g;
                    const c2 = (b << 8) | e;

                    this.layoutColorArray.emplace(vertexOffset, c1, c2);
                }
            }

            const buildingBloom = buildingFeature.buildingBloom;
            if (buildingBloom) {
                for (let i = 0; i < buildingBloom.vertexLength; i++) {
                    const vertexOffset = buildingBloom.vertexOffset + i;

                    const r = entranceColor.r * 255;
                    const g = entranceColor.g * 255;
                    const b = entranceColor.b * 255;
                    const e = entranceEmissive * 51; // The emission range [0,5] remapped to [0,255]
                    const c1 = (r << 8) | g;
                    const c2 = (b << 8) | e;

                    this.bloomGeometry.layoutColorArray.emplace(vertexOffset, c1, c2);
                }
            }
        }
    }

    needsEvaluation(painter: Painter, layer: BuildingStyleLayer): boolean {
        // eslint-disable-next-line no-warning-comments
        // TODO: This code is partially based on model bucket code, we can maybe taylor
        // this more closely to what fill extrusions are doing, assuming that can
        // be made more efficient.
        const projection = painter.transform.projectionOptions;
        const calculatedBrightness = painter.style.getBrightness();
        if (!this.uploaded || projection.name !== this.projection.name ||
            this.brightness !== calculatedBrightness) {
            this.projection = projection;
            this.brightness = calculatedBrightness;
            return true;
        }
        return false;
    }

    updateReplacement(coord: OverscaledTileID, source: ReplacementSource, layerIndex: number) {
        // Replacement has to be re-checked if the source has been updated since last time
        if (source.updateTime === this.replacementUpdateTime) {
            return;
        }
        this.replacementUpdateTime = source.updateTime;

        // Check if replacements have changed
        const newReplacements = source.getReplacementRegionsForTile(coord.toUnwrapped());
        if (regionsEquals(this.activeReplacements, newReplacements)) {
            return;
        }
        const m = PerformanceUtils.beginMeasure("BuldingBucket:updateReplacement");
        this.activeReplacements = newReplacements;

        for (const footprint of this.footprints) {
            footprint.hiddenFlags &= ~BUILDING_HIDDEN_BY_REPLACEMENT;
        }

        const transformedVertices: Array<Point> = [];

        // Hide all centroids that are overlapping with footprints from the replacement source
        for (const region of this.activeReplacements) {
            if ((region.order <= ReplacementOrderBuilding)) continue; // fill-extrusions always get removed. This will be separated (similar to symbol and model) in future.

            // Apply slight padding to footprints. This reduces false positives where two adjacent lines
            // would be reported overlapping due to limited precision (16 bit) of tile units.
            const padding = Math.max(1.0, Math.pow(2.0, region.footprintTileId.canonical.z - coord.canonical.z));

            for (const footprint of this.footprints) {
                if (footprint.min.x > region.max.x || footprint.max.x < region.min.x) {
                    continue;
                } else if (footprint.min.y > region.max.y || footprint.max.y < region.min.y) {
                    continue;
                }

                // Transform vertices to footprint's coordinate space
                transformedVertices.length = 0;
                transformFootprintVertices(
                    footprint.vertices,
                    0,
                    footprint.vertices.length,
                    region.footprintTileId.canonical,
                    coord.canonical,
                    transformedVertices);

                if (footprintTrianglesIntersect(
                    region.footprint,
                    transformedVertices,
                    footprint.indices,
                    0,
                    footprint.indices.length,
                    0,
                    -padding)) {
                    footprint.hiddenFlags |= BUILDING_HIDDEN_BY_REPLACEMENT;
                }

            }
        }

        // Update ground effect
        if (this.groundEffect.hiddenByLandmarkVertexArray.length === 0) {
            this.groundEffect.hiddenByLandmarkVertexArray.resize(this.groundEffect.vertexArray.length);
        }
        for (const footprint of this.footprints) {
            this.groundEffect.updateHiddenByLandmarkRange(footprint.groundEffectVertexOffset, footprint.groundEffectVertexLength, footprint.hiddenFlags !== BUILDING_VISIBLE);
        }

        this.indexArrayForConflationUploaded = false;

        PerformanceUtils.endMeasure(m);
    }

    getHeightAtTileCoord(x: number, y: number): {
        height: number;
        hidden: boolean;
    } | null | undefined {
        let height = Number.NEGATIVE_INFINITY;
        let hidden = true;

        // Follows approach taken by fill_extrusion_bucket to determine the height at a given tile coordinate x, y.
        assert(x > -EXTENT && y > -EXTENT && x < 2 * EXTENT && y < 2 * EXTENT);

        // We use a lookup table to cache the results of the footprint search
        // to avoid searching through all footprints for every tile coordinate.
        const lookupKey = (x + EXTENT) * 4 * EXTENT + (y + EXTENT);
        if (this.footprintLookup.hasOwnProperty(lookupKey)) {
            const footprint = this.footprintLookup[lookupKey];
            return footprint ? {height: footprint.height, hidden: footprint.hiddenFlags !== BUILDING_VISIBLE} : undefined;
        }
        const pt = new Point(x, y);
        for (const footprint of this.footprints) {
            // Check if the point is inside the footprint's bounding box
            if (x > footprint.max.x || footprint.min.x > x || y > footprint.max.y || footprint.min.y > y) {
                continue;
            }
            if (footprint.height <= height) {
                continue;
            }
            if (pointInFootprint(pt, footprint)) {
                height = footprint.height;
                this.footprintLookup[lookupKey] = footprint;
                hidden = footprint.hiddenFlags !== BUILDING_VISIBLE;
            }
        }
        if (height === Number.NEGATIVE_INFINITY) {
            // nothing found, cache that info too.
            this.footprintLookup[lookupKey] = undefined;
            return;
        }
        return {height, hidden};
    }
}

function transformFootprintVertices(vertices: Array<Point>, offset: number, count: number, footprintId: CanonicalTileID, centroidId: CanonicalTileID, out: Array<Point>) {
    const zDiff = Math.pow(2.0, footprintId.z - centroidId.z);

    for (let i = 0; i < count; i++) {
        let x = vertices[i + offset].x;
        let y = vertices[i + offset].y;

        x = (x + centroidId.x * EXTENT) * zDiff - footprintId.x * EXTENT;
        y = (y + centroidId.y * EXTENT) * zDiff - footprintId.y * EXTENT;

        out.push(new Point(x, y));
    }
}

register(BuildingBucket, 'BuildingBucket', {omit: ['layers']});

export default BuildingBucket;
