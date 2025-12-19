import {
    BuildingPositionArray,
    BuildingNormalArray,
    BuildingCentroidArray,
    BuildingColorArray,
    BuildingFacadePaintArray,
    BuildingFacadeDataArray,
    BuildingFacadeVerticalRangeArray,
    BuildingBloomAttenuationArray,
    BuildingFloodLightWallRadiusArray,
    FillExtrusionGroundRadiusLayoutArray,
    StructArrayLayout1ub1,
    StructArrayLayout2f8,
    StructArrayLayout1ui2
} from '../../../src/data/array_types';
import {calculateLightsMesh} from '../../source/model_loader';
import {clamp, warnOnce} from '../../../src/util/util';
import EvaluationParameters from '../../../src/style/evaluation_parameters';
import {
    buildingPositionAttributes,
    buildingNormalAttributes,
    buildingCentroidAttributes,
    buildingColorAttributes,
    buildingFacadePaintAttributes,
    buildingFacadeDataAttributes,
    buildingFacadeVerticalRangeAttributes,
    buildingBloomAttenuationAttributes,
    buildingFloodLightWallRadiusAttributes
} from '../building_attributes';
import loadGeometry from '../../../src/data/load_geometry';
import {ProgramConfigurationSet} from '../../../src/data/program_configuration';
import {register} from '../../../src/util/web_worker_transfer';
import SegmentVector from '../../../src/data/segment';
import {tileToMeter} from '../../../src/geo/mercator_coordinate';
import toEvaluationFeature from '../../../src/data/evaluation_feature';
import {TriangleIndexArray} from '../../../src/data/index_array_type';
import {GroundEffect} from '../../../src/data/bucket/fill_extrusion_bucket';
import Point from '@mapbox/point-geometry';
import {VectorTileFeature} from '@mapbox/vector-tile';
const vectorTileFeatureTypes = VectorTileFeature.types;
import {waitForBuildingGen, getBuildingGen} from '../../util/loaders';
import {footprintTrianglesIntersect, regionsEquals, type Region, type ReplacementSource} from '../../source/replacement_source';
import TriangleGridIndex from '../../../src/util/triangle_grid_index';
import earcut from 'earcut';
import assert from 'assert';
import EXTENT from '../../../src/style-spec/data/extent';
import classifyRings from '../../../src/util/classify_rings';
import {PerformanceUtils} from '../../../src/util/performance';
import {
    ROOF_TYPE_FLAT,
    ROOF_TYPE_HIPPED,
    ROOF_TYPE_GABLED,
    ROOF_TYPE_PARAPET,
    ROOF_TYPE_MANSARD,
    ROOF_TYPE_SKILLION,
    ROOF_TYPE_PYRAMIDAL,
    BUILDING_PART_ROOF,
    BUILDING_PART_WALL,
    BUILDING_PART_FACADE_GLAZING,
    BUILDING_PART_ENTRANCE
} from '../../util/building_gen';

import type {OverscaledTileID, UnwrappedTileID, CanonicalTileID} from '../../../src/source/tile_id';
import type {BucketParameters, IndexedFeature, PopulateParameters} from '../../../src/data/bucket';
import type BuildingStyleLayer from '../../style/style_layer/building_style_layer';
import type Context from '../../../src/gl/context';
import type {EvaluationFeature} from '../../../src/data/evaluation_feature';
import type {FeatureStates} from '../../../src/source/source_state';
import type {ImageId} from '../../../src/style-spec/expression/types/image_id';
import type {GlobalProperties} from "../../../src/style-spec/expression";
import type IndexBuffer from '../../../src/gl/index_buffer';
import type {LUT} from '../../../src/util/lut';
import type {SpritePositions} from '../../../src/util/image';
import type {
    Style,
    Feature,
    Facade,
    RoofType,
    BuildingPart
} from '../../util/building_gen';
import type {Footprint, TileFootprint} from '../../util/conflation';
import type {TileTransform} from '../../../src/geo/projection/tile_transform';
import type {TypedStyleLayer} from '../../../src/style/style_layer/typed_style_layer';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type VertexBuffer from '../../../src/gl/vertex_buffer';
import type {ProjectionSpecification} from '../../../src/style-spec/types';
import type {BucketWithGroundEffect} from '../../../src/render/draw_fill_extrusion';
import type {AreaLight} from '../model';
import type {NonPremultipliedRenderColor} from '../../../src/style-spec/util/color';

export const BUILDING_VISIBLE: number = 0x0;
export const BUILDING_HIDDEN_BY_REPLACEMENT: number = 0x1;
export const BUILDING_HIDDEN_BY_TILE_BORDER_DEDUPLICATION: number = 0x2;
const BUILDING_HIDDEN_WITH_INCOMPLETE_PARTS: number = 0x4;

const MAX_INT_16 = 32767.0;

// Refer to https://github.com/mapbox/geodata-exports/blob/e863d358e04ade6301db95c6f96d1340560f7b93/pipelines/export_map_data/dags/mts_recipes/procedural_buildings_v1/procedural_buildings.json#L62
const BUILDING_TILE_PADDING = 163; // ~= 2.0% * 8192 according to the buffer_size used to generate the tile set.
const FLOOD_LIGHT_MAX_RADIUS_METER = 2048;

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

type RoofShapeString = 'flat' | 'hipped' | 'gabled' | 'parapet' | 'mansard' | 'skillion' | 'pyramidal';
function translateRoofType(roofShape: RoofShapeString): RoofType {
    switch (roofShape) {
    case 'flat':
        return ROOF_TYPE_FLAT;
    case 'hipped':
        return ROOF_TYPE_HIPPED;
    case 'gabled':
        return ROOF_TYPE_GABLED;
    case 'parapet':
        return ROOF_TYPE_PARAPET;
    case 'mansard':
        return ROOF_TYPE_MANSARD;
    case 'skillion':
        return ROOF_TYPE_SKILLION;
    case 'pyramidal':
        return ROOF_TYPE_PYRAMIDAL;
    default:
        throw new Error(`Unknown roof shape: ${roofShape}`);
    }
}

interface BuildingFeaturePart {
    part: BuildingPart,
    vertexOffset: number;
    vertexLength: number;
};

interface BuildingFootprint {
    hiddenFlags: number;
    indicesOffset: number;
    indicesLength: number;
    bloomIndicesOffset: number;
    bloomIndicesLength: number;
    groundEffectVertexOffset: number;
    groundEffectVertexLength: number;
    footprintVertexOffset: number;
    footprintVertexLength: number;
    footprintIndexOffset: number;
    footprintIndexLength: number;
    hasFauxFacade: boolean,
    height: number;
    min: Point;
    max: Point;
    promoteId: string | number;
    feature: EvaluationFeature,
    parts: BuildingFeaturePart[],
    buildingBloom: BuildingFeaturePart
}

type BuildingFeatureOnBorder = {
    featureId: number;
    footprintIndex: number;
};

export class BuildingBloomGeometry {
    layoutVertexArray = new BuildingPositionArray();
    layoutVertexBuffer: VertexBuffer;

    layoutAttenuationArray = new BuildingBloomAttenuationArray();
    layoutAttenuationBuffer: VertexBuffer;

    layoutColorArray = new BuildingColorArray();
    layoutColorBuffer: VertexBuffer;

    indexArray = new TriangleIndexArray();
    indexArrayForConflation = new TriangleIndexArray();
    indexBuffer: IndexBuffer;

    segmentsBucket = new SegmentVector();
}

export class BuildingGeometry {
    layoutVertexArray: BuildingPositionArray;
    layoutVertexBuffer: VertexBuffer;

    layoutNormalArray: BuildingNormalArray;
    layoutNormalBuffer: VertexBuffer;

    layoutCentroidArray: BuildingCentroidArray;
    layoutCentroidBuffer: VertexBuffer;

    layoutColorArray: BuildingColorArray;
    layoutColorBuffer: VertexBuffer;

    layoutFacadePaintArray: BuildingFacadePaintArray = null;
    layoutFacadePaintBuffer: VertexBuffer;

    layoutFacadeDataArray: BuildingFacadeDataArray = null;
    layoutFacadeDataBuffer: VertexBuffer;

    layoutFacadeVerticalRangeArray: BuildingFacadeVerticalRangeArray = null;
    layoutFacadeVerticalRangeBuffer: VertexBuffer;

    layoutFloodLightDataArray: BuildingFloodLightWallRadiusArray;
    layoutFloodLightDataBuffer: VertexBuffer;

    layoutAOArray: StructArrayLayout1ub1;

    indexArray: TriangleIndexArray;
    indexArrayForConflation: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    segmentsBucket = new SegmentVector();

    entranceBloom = new BuildingBloomGeometry();

    constructor(withFauxFacade: boolean) {
        const initialVertexCapacity = 65 * 1024;
        const initialIndexCapactiy = 65 * 1024;

        this.layoutVertexArray = new BuildingPositionArray();
        this.layoutVertexArray.reserve(initialVertexCapacity);

        this.layoutNormalArray = new BuildingNormalArray();
        this.layoutNormalArray.reserve(initialVertexCapacity);

        this.layoutCentroidArray = new BuildingCentroidArray();
        this.layoutCentroidArray.reserve(initialVertexCapacity);

        this.layoutColorArray = new BuildingColorArray();
        this.layoutColorArray.reserve(initialVertexCapacity);

        this.layoutFloodLightDataArray = new BuildingFloodLightWallRadiusArray();
        this.layoutFloodLightDataArray.reserve(initialVertexCapacity);

        this.layoutAOArray = new StructArrayLayout1ub1();
        this.layoutAOArray.reserve(initialVertexCapacity);

        this.indexArray = new TriangleIndexArray();
        this.indexArray.reserve(initialIndexCapactiy);
        this.indexArrayForConflation = new TriangleIndexArray();
        this.segmentsBucket = new SegmentVector();
        this.entranceBloom = new BuildingBloomGeometry();
        if (withFauxFacade) {
            this.layoutFacadePaintArray = new BuildingFacadePaintArray();
            this.layoutFacadeDataArray = new BuildingFacadeDataArray();
            this.layoutFacadeVerticalRangeArray = new BuildingFacadeVerticalRangeArray();
        }
    }

    reserve(numVertices: number, numIndices: number, withFauxFacade: boolean) {
        this.layoutVertexArray.reserveForAdditional(numVertices);
        this.layoutCentroidArray.reserveForAdditional(numVertices);
        this.layoutFloodLightDataArray.reserveForAdditional(numVertices);
        this.layoutNormalArray.reserveForAdditional(numVertices);
        this.layoutAOArray.reserveForAdditional(numVertices);
        this.layoutColorArray.reserveForAdditional(numVertices);

        this.indexArray.reserveForAdditional(numIndices);

        if (withFauxFacade) {
            this.layoutFacadePaintArray.reserveForAdditional(numVertices);
            this.layoutFacadeDataArray.reserveForAdditional(numVertices);
            this.layoutFacadeVerticalRangeArray.reserveForAdditional(numVertices);
        }
    }
}

export class BuildingBucket implements BucketWithGroundEffect {
    index: number;
    zoom: number;
    brightness: number | null | undefined;
    canonical: CanonicalTileID;
    layers: Array<BuildingStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<BuildingStyleLayer>;
    stateDependentLayerIds: Array<string>;

    hasPattern: boolean;
    worldview: string;

    programConfigurations: ProgramConfigurationSet<BuildingStyleLayer>;
    uploaded: boolean;
    colorBufferUploaded = false;

    maxHeight: number = 0;

    projection: ProjectionSpecification;
    tileToMeter: number;
    groundEffect: GroundEffect;
    replacementUpdateTime: number = 0;
    activeReplacements: Region[] = [];

    footprints: Array<BuildingFootprint> = [];
    footprintsVertices: StructArrayLayout2f8 = new StructArrayLayout2f8();
    footprintsIndices: StructArrayLayout1ui2 = new StructArrayLayout1ui2();
    footprintsMin: Point = new Point(Infinity, Infinity);
    footprintsMax: Point = new Point(-Infinity, -Infinity);

    featuresOnBorder: Array<BuildingFeatureOnBorder> = [];

    buildingWithoutFacade: BuildingGeometry = new BuildingGeometry(false);
    buildingWithFacade: BuildingGeometry = new BuildingGeometry(true);

    indexArrayForConflationUploaded: boolean = false;

    featureFootprintLookup = new Map<number, number>();
    footprintLookup: {
        [_: number]: BuildingFootprint | null | undefined;
    };

    buildingIds: Set<number> = new Set<number>();

    lut: LUT;
    hasAppearances: boolean | null;

    constructor(options: BucketParameters<BuildingStyleLayer>) {

        this.footprintLookup = {};

        this.zoom = options.zoom;
        this.canonical = options.canonical;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.fqid);
        this.index = options.index;
        this.hasPattern = false;
        this.worldview = options.worldview;
        this.lut = options.lut;

        this.programConfigurations = new ProgramConfigurationSet(options.layers, {zoom: options.zoom, lut: options.lut});
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.projection = options.projection;

        this.groundEffect = new GroundEffect(options);
        this.groundEffect.groundRadiusArray = new FillExtrusionGroundRadiusLayoutArray();
        this.hasAppearances = null;
    }

    updateFootprints(_id: UnwrappedTileID, _footprints: Array<TileFootprint>) {
        const emptyGrid: TriangleGridIndex = new TriangleGridIndex([], [], 1);
        const footprintForBucket: Footprint = {
            vertices: [],
            indices: new Uint32Array(0),
            grid: emptyGrid,
            min: this.footprintsMin,
            max: this.footprintsMax,
            buildingIds: this.buildingIds
        };

        _footprints.push({
            footprint: footprintForBucket,
            id: _id
        });
    }

    updateAppearances(_canonical?: CanonicalTileID, _featureState?: FeatureStates, _availableImages?: Array<ImageId>, _globalProperties?: GlobalProperties) {
    }

    prepare(): Promise<unknown> {
        return waitForBuildingGen();
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        const perfStartTime = PerformanceUtils.now();
        let perfBuildingGenTime = 0;
        let perfBuildingGenCount = 0;
        let perfMeshLoopAccuTime = 0;

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
            normalScale: [1.0, -1.0, tileToMeters],
            tileToMeters
        };
        buildingGen.setStyle(style);
        buildingGen.setAOOptions(false, 0.3);
        buildingGen.setMetricOptions(false, 16);
        buildingGen.setStructuralOptions(true);
        buildingGen.setFacadeClassifierOptions(3.0);

        // First, we process facade data. For building parts, facades are linked to the
        // parent building, so we also create a map linking feature id to source id to
        // query later.
        const featureSourceIdMap = new Map<string | number, string | number | boolean>();
        const facadeDataForFeature = new Map<string | number | boolean, Facade[]>();
        let featuresFacadesCount = 0;
        for (const {feature} of features) {
            const isFacade = vectorTileFeatureTypes[feature.type] === 'LineString';
            if (!isFacade) {
                featureSourceIdMap.set(feature.id, feature.properties.source_id);
                continue;
            }

            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            if (needGeometry && !this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), feature, canonical))
                continue;

            const evaluationFeature = toEvaluationFeature(feature, needGeometry);
            if (!needGeometry && !this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;

            const geometry = needGeometry ? evaluationFeature.geometry : loadGeometry(feature, canonical, tileTransform);

            const coordinates: number[] = [];
            for (const polygon of geometry) {
                for (const point of polygon) {
                    coordinates.push(point.x);
                    coordinates.push(point.y);
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
            ++featuresFacadesCount;
        }

        this.maxHeight = 0;

        // We keep track of buildings which have been disabled because
        // a building part was removed. When disabling a building, we
        // remove all existing parts (via conflation) and stop adding
        // new parts.
        const disabledFootprintLookup = new Array<{buildingId: number, footprintIndex: number}>();
        const disabledBuildings = new Set<number>();
        const disableBuilding = (buildingId: number | null) => {
            if (buildingId != null) {
                disabledBuildings.add(buildingId);
            }
        };
        const addBuildingFootprint = (buildingId: number | null, footprintIndex: number) => {
            if (buildingId == null) {
                return;
            }
            disabledFootprintLookup.push({buildingId, footprintIndex});
        };

        const estimatedVertexCapacity = (features.length - featuresFacadesCount) * 64;
        const estimatedIndexCapacity = estimatedVertexCapacity / 2;
        this.buildingWithFacade.reserve(estimatedVertexCapacity, estimatedIndexCapacity, true);
        this.buildingWithoutFacade.reserve(estimatedVertexCapacity * 2, estimatedIndexCapacity * 2, false);
        this.footprintsIndices.reserve((features.length - featuresFacadesCount) * 16);
        this.footprintsVertices.reserve((features.length - featuresFacadesCount) * 8);

        // Now we process the building footprints, and combine them
        // with the facade data.
        for (const {feature, id, index, sourceLayerIndex} of features) {
            const isFacade = vectorTileFeatureTypes[feature.type] === 'LineString';
            if (isFacade) {
                continue;
            }

            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            if (needGeometry && !this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), feature, canonical))
                continue;

            let buildingId: number | null = null;
            if (feature.properties && feature.properties.hasOwnProperty('building_id')) {
                buildingId = Number(feature.properties['building_id']);
                if (disabledBuildings.has(buildingId)) {
                    continue;
                }
            }

            const evaluationFeature = toEvaluationFeature(feature, needGeometry);
            if (!needGeometry && !this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical))
                continue;

            const geometry = needGeometry ? evaluationFeature.geometry : loadGeometry(feature, canonical, tileTransform);

            const EARCUT_MAX_RINGS = 500;
            const classifiedRings = classifyRings(geometry, EARCUT_MAX_RINGS);

            // We don't support complex buildings with holes for now. So we skip them, and fall back to fill-extrusions.
            let hasHoles = false;
            for (const ring of classifiedRings) {
                if (ring.length !== 1) {
                    hasHoles = true;
                    break;
                }
            }
            if (hasHoles) {
                disableBuilding(buildingId);
                continue;
            }

            // Do not render data beyond tile buffer/padding
            if (!geometryFullyInsideTile(geometry, BUILDING_TILE_PADDING)) {
                disableBuilding(buildingId);
                continue;
            }

            const layer = this.layers[0];
            const roofShapeString = layer.layout.get('building-roof-shape').evaluate(feature, {}, canonical);
            const roofType = translateRoofType(roofShapeString);

            const base = layer.layout.get('building-base').evaluate(feature, {}, canonical);
            const height = layer.layout.get('building-height').evaluate(feature, {}, canonical);
            const floodLightGroundRadius = layer.layout.get('building-flood-light-ground-radius').evaluate(feature, {}, canonical);
            const aoIntensity = layer.paint.get('building-ambient-occlusion-intensity');
            const maxRadius = floodLightGroundRadius / this.tileToMeter;

            feature.properties['building-part'] = 'roof';
            const roofColor = layer.paint.get('building-color').evaluate(feature, {}, this.canonical).toPremultipliedRenderColor(this.lut);
            const roofEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, {}, this.canonical);

            feature.properties['building-part'] = 'wall';
            const wallsColor = layer.paint.get('building-color').evaluate(feature, {}, this.canonical).toPremultipliedRenderColor(this.lut);
            const wallsEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, {}, this.canonical);

            feature.properties['building-part'] = 'window';
            const windowColor = layer.paint.get('building-color').evaluate(feature, {}, this.canonical).toPremultipliedRenderColor(this.lut);
            const windowEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, {}, this.canonical);

            feature.properties['building-part'] = 'door';
            const entranceColor = layer.paint.get('building-color').evaluate(feature, {}, this.canonical).toPremultipliedRenderColor(this.lut);
            const entranceEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, {}, this.canonical);

            // Note: For procedural buildings we can set an upper limit for the radius walls.
            // This is possible because procedural buildings are in practice visible at high zoom levels (i.e. no globe)
            // and unlike fill-extrusions they are not repurposed to achieve different effects (e.g. gradient effect).
            // This allows us to use a short integer which should give us more than enough precision and desireable visuals.
            // In the case of ground flood lighting we're still using fill_extrusion_ground_effect shaders.
            let floodLightWallRadius = layer.layout.get('building-flood-light-wall-radius').evaluate(feature, {}, canonical);
            floodLightWallRadius = clamp(floodLightWallRadius, 0.0, FLOOD_LIGHT_MAX_RADIUS_METER);
            const floodLightWallRadiusNormalized = floodLightWallRadius / FLOOD_LIGHT_MAX_RADIUS_METER * MAX_INT_16;

            const sourceId = featureSourceIdMap.get(id);
            const facades: Facade[] = facadeDataForFeature.get(sourceId) || [];

            const hasFauxFacade = facades.length !== 0 && layer.layout.get('building-facade').evaluate(feature, {}, canonical);
            buildingGen.setFacadeOptions(4.0, true);
            buildingGen.setFauxFacadeOptions(hasFauxFacade, false, 1.0);

            let windowXPerc = 0.0;
            let windowYPerc = 0.0;
            let floorXTile = 0.0;
            let floorYTile = 0.0;
            let startPositionTile = 0.0;
            let endPositionTile = 0.0;
            let normalizedStartTile = 0;
            let normalizedEndTile = 0;
            let g1 = 0;
            let b1 = 0;
            let a1 = 0;
            if (hasFauxFacade) {
                // Some of this data such as facadeHeights and floorWidths were chosen experimentally
                // and hard-coded. These will be parameterised as style properties in a follow-up change.
                let numFloors = Math.round(layer.layout.get('building-facade-floors').evaluate(feature, {}, canonical));
                if (base === 0.0) {
                    const facadeHintAvailable = facades.length > 0;
                    // If base == 0 then "one story" is already modelled geometrically
                    // so for better visuals, we can subtract one floor.
                    numFloors = Math.max(1.0, numFloors - (facadeHintAvailable ? 1.0 : 0.0));

                    // Rule is that with buildings with height < 100 we used default facadeHeight from
                    // building-gen which is currently 4m.
                    // If below building height is below 10 meters use 3 meters for facadeHeight.
                    let facadeHeight = 4.0;
                    if (height > 100) {
                        const facadeHeights = [10.0, 13.0, 15.0];
                        facadeHeight = facadeHeights[feature.id ? feature.id % facadeHeights.length : 0];
                    } else if (height <= 10) {
                        facadeHeight = 3.0;
                    }
                    buildingGen.setFacadeOptions(facadeHeight, true);

                    // The buffer between geometric facades and the faux facades is based on the height
                    // of the geometric facades multiplied by golden ratio.
                    startPositionTile = (height < 15 ? 1.3 : 1.61803) * facadeHeight / tileToMeters;
                } else {
                    // No geometric facades when base > 0.
                    startPositionTile = base / tileToMeters;
                }
                endPositionTile = height / tileToMeters;
                startPositionTile = Math.min(startPositionTile, endPositionTile);

                const unitWidth = layer.layout.get('building-facade-unit-width').evaluate(feature, {}, canonical);
                floorXTile = unitWidth / tileToMeters;
                floorYTile = (endPositionTile - startPositionTile) / numFloors;

                buildingGen.setFauxFacadeOptions(true, true, floorXTile);

                const window = layer.layout.get('building-facade-window').evaluate(feature, {}, canonical);
                windowXPerc = window[0];
                windowYPerc = window[1];

                normalizedStartTile = Math.floor(Math.min(1.0, startPositionTile / EXTENT) * 0xFFFF);
                normalizedEndTile = Math.floor(Math.min(1.0, endPositionTile / EXTENT) * 0xFFFF);
                const windowX = Math.floor(windowXPerc * 255.0);
                const windowY = Math.floor(windowYPerc * 255.0);
                g1 = (windowX << 8) | windowY;
                const normalizedFloorXTile = Math.floor(Math.min(1.0, floorXTile / EXTENT) * 0xFFFF);
                b1 = normalizedFloorXTile;
                const normalizedFloorYTile = Math.floor(Math.min(1.0, floorYTile / EXTENT) * 0xFFFF);
                a1 = normalizedFloorYTile;
            }

            const buildingGenFeatures = Array(classifiedRings.length);
            const bboxMin = {x: Infinity, y: Infinity};
            const bboxMax = {x: -Infinity, y: -Infinity};
            const centroid = {x: 0, y: 0};
            let pointCount = 0;
            for (let p = 0; p < classifiedRings.length; p++) {
                const polygon = classifiedRings[p];
                if (polygon.length > 0) {
                    const coordinates = [];
                    const ringIndices = Array<number>(polygon.length + 1);
                    ringIndices[0] = 0;
                    for (let r = 0; r < polygon.length; r++) {
                        const ring = polygon[r];
                        // We need to flip the footprint for now, but ideally
                        // building-gen will support the winding received from
                        // the source data.
                        for (let i = 0; i < ring.length; i++) {
                            const point = ring[ring.length - i - 1];
                            bboxMin.x = Math.min(bboxMin.x, point.x);
                            bboxMin.y = Math.min(bboxMin.y, point.y);
                            bboxMax.x = Math.max(bboxMax.x, point.x);
                            bboxMax.y = Math.max(bboxMax.y, point.y);

                            centroid.x += point.x;
                            centroid.y += point.y;
                            pointCount++;

                            coordinates.push(point.x);
                            coordinates.push(point.y);
                        }
                        ringIndices[r + 1] = coordinates.length;
                    }

                    const featureInput: Feature = {
                        id: feature.id ? feature.id : 0,
                        height,
                        minHeight: base,
                        sourceId: 0,
                        roofType,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        coordinates,
                        ringIndices
                    };
                    buildingGenFeatures[p] = featureInput;
                }
            }
            assert(pointCount > 0);
            centroid.x /= pointCount || 1;
            centroid.y /= pointCount || 1;

            const perfBeforeGenMesh = PerformanceUtils.now();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const result = buildingGen.generateMesh(buildingGenFeatures, facades);
            perfBuildingGenTime += PerformanceUtils.now() - perfBeforeGenMesh;
            ++perfBuildingGenCount;

            if (typeof result === 'string') {
                warnOnce(`Unable to generate building ${feature.id}: ${result}`);
                disableBuilding(buildingId);
                continue;
            }
            if (result.meshes.length === 0 || result.modifiedPolygonRings.length === 0) {
                disableBuilding(buildingId);
                continue;
            }

            const building = hasFauxFacade ? this.buildingWithFacade : this.buildingWithoutFacade;

            // Reserve memory upfront to reduce reallocations
            let vertexCount = 0;
            for (const mesh of result.meshes) {
                vertexCount += mesh.positions.length / 3;
            }

            const segment = building.segmentsBucket.prepareSegment(vertexCount, building.layoutVertexArray, building.indexArray);
            const buildingParts: BuildingFeaturePart[] = [];
            let buildingBloom: BuildingFeaturePart = null;
            let bloomIndicesOffset = 0;
            let bloomIndicesLength = -1;

            const vertexArrayOffset = building.layoutVertexArray.length;
            const newVertexCount = vertexArrayOffset + vertexCount;
            building.layoutVertexArray.resize(newVertexCount);
            building.layoutCentroidArray.resize(newVertexCount);
            building.layoutNormalArray.resize(newVertexCount);
            building.layoutAOArray.resize(newVertexCount);
            building.layoutColorArray.resize(newVertexCount);
            building.layoutFloodLightDataArray.resize(newVertexCount);
            if (hasFauxFacade) {
                building.layoutFacadePaintArray.resize(newVertexCount);
                building.layoutFacadeDataArray.resize(newVertexCount);
                building.layoutFacadeVerticalRangeArray.resize(newVertexCount);
            }

            const indexArrayRangeStartOffset = building.indexArray.length;
            let footprintHeight = 0;
            const perfMeshLoopStartTime = PerformanceUtils.now();

            let partVertexOffset = vertexArrayOffset;
            for (const mesh of result.meshes) {
                let partColor: NonPremultipliedRenderColor;
                let emissive: number;
                if (mesh.buildingPart === BUILDING_PART_ROOF) {
                    partColor = roofColor;
                    emissive = roofEmissive;
                } else if (mesh.buildingPart === BUILDING_PART_WALL) {
                    partColor = wallsColor;
                    emissive = wallsEmissive;
                } else if (mesh.buildingPart === BUILDING_PART_FACADE_GLAZING) {
                    partColor = windowColor;
                    emissive = windowEmissive;
                } else if (mesh.buildingPart === BUILDING_PART_ENTRANCE) {
                    partColor = entranceColor;
                    emissive = entranceEmissive;
                } else {
                    continue;
                }
                // Clamp emissive so that it can be packed into 8-bit part of the
                // paint buffer. We only use the unclamped value for bloom.
                emissive = clamp(emissive, 0, 1);

                if (mesh.buildingPart === BUILDING_PART_ENTRANCE) {
                    const areaLights = new Array<AreaLight>();
                    // Doors are represented as four vertices each, so we need to process them in
                    // groups of 12 vertices (3 vertices per corner, 4 corners). The first two are
                    // the bottom corners, and the other two are the top corners. We use the bottom
                    // corners to calculate the position and normal of the area light, and only one
                    // of the top vertices to calculate the door height.
                    for (let i = 0; i < mesh.positions.length; i += 12) {
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
                        const normal: [number, number, number] = [dy / width, -dx / width, 0];
                        const pos: [number, number, number] = [x0 + dx * 0.5, y0 + dy * 0.5, elevation];
                        const points: [number, number, number, number] = [x0, y0, x1, y1];
                        areaLights.push({pos, normal, width, height, depth, points});
                    }

                    // The expected number of vertices is 10 per area light, as calculated in calculateLightsMesh
                    const expectedLightVertices = areaLights.length * 10;
                    const bloomSegment = building.entranceBloom.segmentsBucket.prepareSegment(
                        expectedLightVertices,
                        building.entranceBloom.layoutVertexArray,
                        building.entranceBloom.indexArray
                    );

                    const bloomVertexOffset = building.entranceBloom.layoutVertexArray.length;
                    bloomIndicesOffset = building.entranceBloom.indexArray.length;
                    calculateLightsMesh(areaLights, 0.5 / this.tileToMeter, building.entranceBloom.indexArray, building.entranceBloom.layoutVertexArray, building.entranceBloom.layoutAttenuationArray);

                    const bloomVertexLength = building.entranceBloom.layoutVertexArray.length - bloomVertexOffset;
                    bloomIndicesLength = building.entranceBloom.indexArray.length - bloomIndicesOffset;

                    for (let p = 0; p < bloomVertexLength; p++) {
                        const r = entranceColor.r * 255;
                        const g = entranceColor.g * 255;
                        const b = entranceColor.b * 255;
                        const e = entranceEmissive * 51; // The emission range [0,5] remapped to [0,255]
                        const c1 = (r << 8) | g;
                        const c2 = (b << 8) | e;

                        building.entranceBloom.layoutColorArray.emplaceBack(c1, c2);
                    }

                    bloomSegment.vertexLength += bloomVertexLength;
                    bloomSegment.primitiveLength += bloomIndicesLength;

                    buildingBloom = {
                        part: mesh.buildingPart,
                        vertexOffset: bloomVertexOffset,
                        vertexLength: bloomVertexLength
                    };
                }

                building.layoutVertexArray.float32.set(mesh.positions, partVertexOffset * 3);
                const partVertexCount = mesh.positions.length / 3;
                for (let v = 0; v < partVertexCount; ++v) {
                    const vertIdx = v * 3;
                    footprintHeight = Math.max(footprintHeight, mesh.positions[vertIdx + 2]);

                    const nx = mesh.normals[vertIdx] * MAX_INT_16;
                    const ny = mesh.normals[vertIdx + 1] * MAX_INT_16;
                    const nz = mesh.normals[vertIdx + 2] * MAX_INT_16;
                    const nrmIdx = (partVertexOffset + v) * 3;
                    building.layoutNormalArray.int16[nrmIdx] = nx;
                    building.layoutNormalArray.int16[nrmIdx + 1] = ny;
                    building.layoutNormalArray.int16[nrmIdx + 2] = nz;

                    const ao = mesh.ao[v];
                    building.layoutAOArray.uint8[partVertexOffset + v] = ao * 255;

                    const colorFactor = 1.0 + (ao - 1.0) * aoIntensity;

                    const r = partColor.r * 255 * colorFactor;
                    const g = partColor.g * 255 * colorFactor;
                    const b = partColor.b * 255 * colorFactor;
                    const e = emissive * 255;

                    const c1 = (r << 8) | g;
                    const c2 = (b << 8) | e;
                    building.layoutColorArray.uint16[(partVertexOffset + v) * 2] = c1;
                    building.layoutColorArray.uint16[(partVertexOffset + v) * 2 + 1] = c2;
                }

                const cx = Math.floor(centroid.x);
                const cy = Math.floor(centroid.y);
                const ch = Math.floor(height);
                for (let v = 0; v < partVertexCount; ++v) {
                    const idx = (partVertexOffset + v) * 3;
                    building.layoutCentroidArray.int16[idx] = cx;
                    building.layoutCentroidArray.int16[idx + 1] = cy;
                    building.layoutCentroidArray.int16[idx + 2] = ch;
                }

                if (mesh.buildingPart === BUILDING_PART_WALL) {
                    building.layoutFloodLightDataArray.uint16.fill(floodLightWallRadiusNormalized, partVertexOffset, partVertexOffset + partVertexCount);
                } else {
                    building.layoutFloodLightDataArray.uint16.fill(0, partVertexOffset, partVertexOffset + partVertexCount);
                }

                if (hasFauxFacade) {
                    const r = windowColor.r * 255;
                    const g = windowColor.g * 255;
                    const b = windowColor.b * 255;
                    const e = windowEmissive * 255;
                    const c1 = (r << 8) | g;
                    const c2 = (b << 8) | e;
                    for (let v = 0; v < partVertexCount; ++v) {
                        const i = (partVertexOffset + v) * 2;
                        building.layoutFacadePaintArray.uint16[i] = c1;
                        building.layoutFacadePaintArray.uint16[i + 1] = c2;
                    }

                    for (let v = 0; v < partVertexCount; ++v) {
                        const uvIdx = v * 2;
                        if (mesh.isFauxFacade[v]) {
                            const edgeDistanceTile = mesh.uv[uvIdx] * result.outerRingLength;

                            const normalizedEdgeDistance = Math.min(0xFFFF, Math.floor(edgeDistanceTile));
                            const r1 = normalizedEdgeDistance | 0x1;

                            building.layoutFacadeDataArray.emplace(partVertexOffset + v, r1, g1, b1, a1);
                            building.layoutFacadeVerticalRangeArray.emplace(partVertexOffset + v, normalizedStartTile, normalizedEndTile);
                        } else {
                            building.layoutFacadeDataArray.emplace(partVertexOffset + v, 0, 0, 0, 0);
                            building.layoutFacadeVerticalRangeArray.emplace(partVertexOffset + v, 0, 0);
                        }
                    }
                }

                const triangleIndex = segment.vertexLength;
                const indexCount = mesh.indices.length / 3;
                const indexOffset = building.indexArray.length;
                building.indexArray.resize(indexOffset + indexCount);
                for (let i = 0; i < indexCount; ++i) {
                    const idx = i * 3;
                    const o = indexOffset * 3 + idx;
                    building.indexArray.uint16[o] = triangleIndex + mesh.indices[idx];
                    building.indexArray.uint16[o + 1] = triangleIndex + mesh.indices[idx + 1];
                    building.indexArray.uint16[o + 2] = triangleIndex + mesh.indices[idx + 2];
                }

                if (mesh.buildingPart === BUILDING_PART_ROOF || mesh.buildingPart === BUILDING_PART_WALL ||
                    mesh.buildingPart === BUILDING_PART_FACADE_GLAZING || mesh.buildingPart === BUILDING_PART_ENTRANCE) {
                    const buildingFeaturePart: BuildingFeaturePart = {
                        part: mesh.buildingPart,
                        vertexOffset: partVertexOffset,
                        vertexLength: mesh.positions.length / 3
                    };
                    buildingParts.push(buildingFeaturePart);
                }

                partVertexOffset += partVertexCount;
                segment.vertexLength += partVertexCount;
                segment.primitiveLength += mesh.indices.length / 3;
            }

            perfMeshLoopAccuTime += PerformanceUtils.now() - perfMeshLoopStartTime;

            this.maxHeight = Math.max(this.maxHeight, footprintHeight);

            const indexArrayRangeLength = building.indexArray.length - indexArrayRangeStartOffset;

            const footprintIndexOffset = this.footprintsIndices.length;
            const footprintVertexOffset = this.footprintsVertices.length;

            const footprintFlattened = [];
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
                    this.footprintsVertices.emplaceBack(point.x, point.y);
                }

                footprintBoundsMin.x = Math.min(footprintBoundsMin.x, boundsMin.x);
                footprintBoundsMin.y = Math.min(footprintBoundsMin.y, boundsMin.y);
                footprintBoundsMax.x = Math.max(footprintBoundsMax.x, boundsMax.x);
                footprintBoundsMax.y = Math.max(footprintBoundsMax.y, boundsMax.y);

                this.groundEffect.addData(groundPolyline, [boundsMin, boundsMax], maxRadius);
            }

            const groundEffectVertexLength = this.groundEffect.vertexArray.length - groundEffectVertexOffset;
            this.groundEffect.groundRadiusArray.reserveForAdditional(groundEffectVertexLength);
            for (let v = 0; v < groundEffectVertexLength; v++) {
                this.groundEffect.groundRadiusArray.emplaceBack(floodLightGroundRadius);
            }

            // Check if the feature crosses tile borders
            if (bboxMin.x < 0 || bboxMax.x > EXTENT || bboxMin.y < 0 || bboxMax.y > EXTENT) {
                this.featuresOnBorder.push({featureId: feature.id, footprintIndex: this.footprints.length});
            }

            // Store footprint data for later conflation with fill-extrusions and model layers
            {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                const indices = earcut(footprintFlattened, null, 2) as Array<number>;
                assert(indices.length % 3 === 0);
                assert(footprintFlattened.length / 2 < 0xFFFF); // enforce 16bit indices

                this.footprintsIndices.resize(this.footprintsIndices.length + indices.length);
                this.footprintsIndices.uint16.set(indices, footprintIndexOffset);

                const buildingOrFeatureId = buildingId != null ? buildingId : feature.id;
                this.buildingIds.add(buildingOrFeatureId);
                this.footprintsMin.x = Math.min(this.footprintsMin.x, footprintBoundsMin.x);
                this.footprintsMin.y = Math.min(this.footprintsMin.y, footprintBoundsMin.y);
                this.footprintsMax.x = Math.max(this.footprintsMax.x, footprintBoundsMax.x);
                this.footprintsMax.y = Math.max(this.footprintsMax.y, footprintBoundsMax.y);

                const footprint: BuildingFootprint = {
                    footprintVertexOffset,
                    footprintVertexLength: this.footprintsVertices.length - footprintVertexOffset,
                    footprintIndexOffset,
                    footprintIndexLength: this.footprintsIndices.length - footprintIndexOffset,
                    min: footprintBoundsMin,
                    max: footprintBoundsMax,
                    hiddenFlags: BUILDING_VISIBLE,
                    indicesOffset: indexArrayRangeStartOffset,
                    indicesLength: indexArrayRangeLength,
                    bloomIndicesOffset,
                    bloomIndicesLength,
                    groundEffectVertexOffset,
                    groundEffectVertexLength,
                    hasFauxFacade,
                    height: footprintHeight,
                    promoteId: id,
                    feature: evaluationFeature,
                    parts: buildingParts,
                    buildingBloom
                };
                const footprintIndex = this.footprints.length;
                if (feature.id !== undefined) {
                    this.featureFootprintLookup.set(feature.id, footprintIndex);
                }
                addBuildingFootprint(buildingId, footprintIndex);
                this.footprints.push(footprint);
            }

            this.programConfigurations.populatePaintArrays(building.layoutVertexArray.length, feature, index, {}, options.availableImages, canonical, options.brightness);
            this.groundEffect.addPaintPropertiesData(feature, index, {}, options.availableImages, canonical, options.brightness);

            options.featureIndex.insert(feature, geometry, index, sourceLayerIndex, this.index, vertexArrayOffset);
        }

        disabledFootprintLookup.forEach(({buildingId, footprintIndex}) => {
            if (disabledBuildings.has(buildingId)) {
                const footprint = this.footprints[footprintIndex];
                footprint.hiddenFlags |= BUILDING_HIDDEN_WITH_INCOMPLETE_PARTS;
            }
        });

        const filteredBuildingIds = new Set<number>();
        this.buildingIds.forEach((buildingId, value2, set) => {
            if (!disabledBuildings.has(buildingId)) {
                filteredBuildingIds.add(buildingId);
            }
        });
        this.buildingIds = filteredBuildingIds;

        this.groundEffect.prepareBorderSegments();

        PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_COMMON, 'BuildingBucket.populate', 'BuildingBucket', perfStartTime, [
            ["buildingGen", perfBuildingGenTime],
            ["buildingGenCount", perfBuildingGenCount],
            ["buildingGenFeatPerMs", features.length / perfBuildingGenTime],
            ["meshLoopAccuTime", perfMeshLoopAccuTime]
        ], "primary-dark");
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: Array<ImageId>, imagePositions: SpritePositions, layers: ReadonlyArray<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null) {
        const perfStartTime = PerformanceUtils.now();

        this.programConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness);
        this.groundEffect.update(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness);

        this.evaluate(this.layers[0], states);
        this.colorBufferUploaded = false;

        PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_COMMON, 'BuildingBucket.update', 'BuildingBucket', perfStartTime);
    }

    isEmpty(): boolean {
        return this.buildingWithoutFacade.layoutVertexArray.length === 0 && this.buildingWithFacade.layoutVertexArray.length === 0;
    }

    uploadPending(): boolean {
        return !this.uploaded || this.programConfigurations.needsUpload || this.groundEffect.programConfigurations.needsUpload;
    }

    upload(context: Context) {
        const perfStartTime = PerformanceUtils.now();
        const uploadBuilding = (building: BuildingGeometry) => {
            building.layoutVertexBuffer = context.createVertexBuffer(building.layoutVertexArray, buildingPositionAttributes.members);
            building.layoutNormalBuffer = context.createVertexBuffer(building.layoutNormalArray, buildingNormalAttributes.members);
            building.layoutCentroidBuffer = context.createVertexBuffer(building.layoutCentroidArray, buildingCentroidAttributes.members);
            building.layoutFloodLightDataBuffer = context.createVertexBuffer(building.layoutFloodLightDataArray, buildingFloodLightWallRadiusAttributes.members);

            if (building.layoutFacadeDataArray && building.layoutFacadeDataArray.length) {
                building.layoutFacadeDataBuffer = context.createVertexBuffer(building.layoutFacadeDataArray, buildingFacadeDataAttributes.members);
            }
            if (building.layoutFacadeVerticalRangeArray && building.layoutFacadeVerticalRangeArray.length) {
                building.layoutFacadeVerticalRangeBuffer = context.createVertexBuffer(building.layoutFacadeVerticalRangeArray, buildingFacadeVerticalRangeAttributes.members);
            }

            if (building.entranceBloom.layoutVertexArray.length) {
                building.entranceBloom.layoutVertexBuffer = context.createVertexBuffer(building.entranceBloom.layoutVertexArray, buildingPositionAttributes.members);
                building.entranceBloom.layoutAttenuationBuffer = context.createVertexBuffer(building.entranceBloom.layoutAttenuationArray, buildingBloomAttenuationAttributes.members);
            }
            this.uploadUpdatedColorBuffer(context);
            this.uploadUpdatedIndexBuffer(context);
        };

        if (!this.uploaded) {
            uploadBuilding(this.buildingWithoutFacade);
            uploadBuilding(this.buildingWithFacade);
            this.groundEffect.upload(context);
        }
        this.groundEffect.uploadPaintProperties(context);
        this.programConfigurations.upload(context);
        this.uploaded = true;
        PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_COMMON, 'BuildingBucket.upload', 'BuildingBucket', perfStartTime);
    }

    destroy() {
        const destroyBuilding = (building: BuildingGeometry) => {
            if (!building.layoutVertexBuffer) {
                return;
            }

            building.layoutVertexBuffer.destroy();
            building.layoutNormalBuffer.destroy();
            building.layoutColorBuffer.destroy();
            building.segmentsBucket.destroy();

            if (building.indexBuffer) {
                building.indexBuffer.destroy();
            }

            if (building.entranceBloom.layoutVertexBuffer) {
                building.entranceBloom.layoutVertexBuffer.destroy();
                building.entranceBloom.layoutColorBuffer.destroy();
                building.entranceBloom.layoutAttenuationBuffer.destroy();
                building.entranceBloom.indexBuffer.destroy();
                building.entranceBloom.segmentsBucket.destroy();
            }
        };

        destroyBuilding(this.buildingWithoutFacade);
        destroyBuilding(this.buildingWithFacade);

        this.groundEffect.destroy();
        this.programConfigurations.destroy();
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

        if (this.indexArrayForConflationUploaded) {
            return;
        }

        const clearBuildingIndexBuffer = (building: BuildingGeometry) => {
            if (building.indexArray.length === 0) {
                return;
            }

            building.indexArrayForConflation.resize(building.indexArray.length);
            building.indexArrayForConflation.uint16.set(building.indexArray.uint16);

            building.entranceBloom.indexArrayForConflation.resize(building.entranceBloom.indexArray.length);
            building.entranceBloom.indexArrayForConflation.uint16.set(building.entranceBloom.indexArray.uint16);
        };
        clearBuildingIndexBuffer(this.buildingWithoutFacade);
        clearBuildingIndexBuffer(this.buildingWithFacade);

        // Update segments after conflation
        for (const footprint of this.footprints) {
            const building = footprint.hasFauxFacade ? this.buildingWithFacade : this.buildingWithoutFacade;
            const footprintIndicesEnd = footprint.indicesOffset + footprint.indicesLength;
            const isVisible = footprint.hiddenFlags === BUILDING_VISIBLE;
            // Instead of removing indices of hidden footprints, use [0,0,0] generate degenerated triangles
            // Alternative would be removing hidden parts and patch segment array for rendering (primitive offsets and length  )
            if (!isVisible) {
                for (let idx = footprint.indicesOffset; idx < footprintIndicesEnd; idx++) {
                    building.indexArrayForConflation.uint16[idx * 3 + 0] = 0;
                    building.indexArrayForConflation.uint16[idx * 3 + 1] = 0;
                    building.indexArrayForConflation.uint16[idx * 3 + 2] = 0;
                }

                const bloomIndicesEnd = footprint.bloomIndicesOffset + footprint.bloomIndicesLength;
                for (let idx = footprint.bloomIndicesOffset; idx < bloomIndicesEnd; idx++) {
                    building.entranceBloom.indexArrayForConflation.uint16[idx * 3 + 0] = 0;
                    building.entranceBloom.indexArrayForConflation.uint16[idx * 3 + 1] = 0;
                    building.entranceBloom.indexArrayForConflation.uint16[idx * 3 + 2] = 0;
                }
            }
        }

        const uploadBuildingIndexBuffer = (building: BuildingGeometry) => {
            if (building.indexArray.length === 0) {
                return;
            }

            if (!building.indexBuffer) {
                building.indexBuffer = context.createIndexBuffer(building.indexArrayForConflation, true);
            } else {
                building.indexBuffer.updateData(building.indexArrayForConflation);
            }

            if (!building.entranceBloom.indexBuffer) {
                building.entranceBloom.indexBuffer = context.createIndexBuffer(building.entranceBloom.indexArrayForConflation, true);
            } else {
                building.entranceBloom.indexBuffer.updateData(building.entranceBloom.indexArrayForConflation);
            }
        };
        uploadBuildingIndexBuffer(this.buildingWithoutFacade);
        uploadBuildingIndexBuffer(this.buildingWithFacade);

        this.indexArrayForConflationUploaded = true;
    }

    public uploadUpdatedColorBuffer(context: Context) {
        const uploadBuildingColorBuffer = (building: BuildingGeometry) => {
            if (!building.layoutColorBuffer) {
                building.layoutColorBuffer = context.createVertexBuffer(building.layoutColorArray, buildingColorAttributes.members, true);
            } else {
                building.layoutColorBuffer.updateData(building.layoutColorArray);
            }

            if (building.layoutFacadePaintArray) {
                if (!building.layoutFacadePaintBuffer) {
                    building.layoutFacadePaintBuffer = context.createVertexBuffer(building.layoutFacadePaintArray, buildingFacadePaintAttributes.members, true);
                } else {
                    building.layoutFacadePaintBuffer.updateData(building.layoutFacadePaintArray);
                }
            }

            if (!building.entranceBloom.layoutColorBuffer) {
                building.entranceBloom.layoutColorBuffer = context.createVertexBuffer(building.entranceBloom.layoutColorArray, buildingColorAttributes.members, true);
            } else {
                building.entranceBloom.layoutColorBuffer.updateData(building.entranceBloom.layoutColorArray);
            }
        };

        uploadBuildingColorBuffer(this.buildingWithoutFacade);
        uploadBuildingColorBuffer(this.buildingWithFacade);

        this.colorBufferUploaded = true;
    }

    evaluate(layer: BuildingStyleLayer, featureState: FeatureStates) {
        const perfStartTime = PerformanceUtils.now();

        const aoIntensity = layer.paint.get('building-ambient-occlusion-intensity');
        for (const buildingFeature of this.footprints) {
            if (buildingFeature.hiddenFlags & BUILDING_HIDDEN_WITH_INCOMPLETE_PARTS) {
                continue;
            }
            const state = featureState[buildingFeature.promoteId];
            const feature = buildingFeature.feature;

            feature.properties['building-part'] = 'roof';
            const roofColor = layer.paint.get('building-color').evaluate(feature, state, this.canonical).toPremultipliedRenderColor(this.lut);
            const roofEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, state, this.canonical);

            feature.properties['building-part'] = 'wall';
            const wallsColor = layer.paint.get('building-color').evaluate(feature, state, this.canonical).toPremultipliedRenderColor(this.lut);
            const wallsEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, state, this.canonical);

            feature.properties['building-part'] = 'window';
            const windowColor = layer.paint.get('building-color').evaluate(feature, state, this.canonical).toPremultipliedRenderColor(this.lut);
            const windowEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, state, this.canonical);

            feature.properties['building-part'] = 'door';
            const entranceColor = layer.paint.get('building-color').evaluate(feature, state, this.canonical).toPremultipliedRenderColor(this.lut);
            const entranceEmissive = layer.paint.get('building-emissive-strength').evaluate(feature, state, this.canonical);

            const building = buildingFeature.hasFauxFacade ? this.buildingWithFacade : this.buildingWithoutFacade;
            for (const buildingPart of buildingFeature.parts) {
                let color = roofColor;
                let emissive: number;
                if (buildingPart.part === BUILDING_PART_ROOF) {
                    color = roofColor;
                    emissive = roofEmissive;
                } else if (buildingPart.part === BUILDING_PART_WALL) {
                    color = wallsColor;
                    emissive = wallsEmissive;
                } else if (buildingPart.part === BUILDING_PART_FACADE_GLAZING) {
                    color = windowColor;
                    emissive = windowEmissive;
                } else if (buildingPart.part === BUILDING_PART_ENTRANCE) {
                    color = entranceColor;
                    emissive = entranceEmissive;
                }
                // Clamp emissive so that it can be packed into 8-bit part of the
                // paint buffer. We only use the unclamped value for bloom.
                emissive = clamp(emissive, 0, 1);

                for (let i = 0; i < buildingPart.vertexLength; i++) {
                    const vertexOffset = buildingPart.vertexOffset + i;
                    const colorFactor = 1.0 + (building.layoutAOArray.uint8[vertexOffset] / 255.0 - 1.0) * aoIntensity;

                    const r = color.r * colorFactor * 255;
                    const g = color.g * colorFactor * 255;
                    const b = color.b * colorFactor * 255;
                    const e = emissive * 255;
                    const c1 = (r << 8) | g;
                    const c2 = (b << 8) | e;

                    building.layoutColorArray.emplace(vertexOffset, c1, c2);

                    if (buildingFeature.hasFauxFacade) {
                        const r = windowColor.r * 255;
                        const g = windowColor.g * 255;
                        const b = windowColor.b * 255;
                        const e = windowEmissive * 255;
                        const c1 = (r << 8) | g;
                        const c2 = (b << 8) | e;

                        building.layoutFacadePaintArray.emplace(vertexOffset, c1, c2);
                    }
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

                    building.entranceBloom.layoutColorArray.emplace(vertexOffset, c1, c2);
                }
            }
        }

        PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_COMMON, 'BuildingBucket.evaluate', 'BuildingBucket', perfStartTime);
    }

    needsEvaluation(): boolean {
        return !this.colorBufferUploaded;
    }

    updateReplacement(coord: OverscaledTileID, source: ReplacementSource, layerIndex: number) {
        const perfStartTime = PerformanceUtils.now();

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
        this.activeReplacements = newReplacements;

        for (const footprint of this.footprints) {
            footprint.hiddenFlags &= ~BUILDING_HIDDEN_BY_REPLACEMENT;
        }

        const transformedVertices: Array<Point> = [];

        // Hide all centroids that are overlapping with footprints from the replacement source
        for (const region of this.activeReplacements) {
            if ((region.order < layerIndex)) continue;

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
                transformFootprintVerticesFloat32(
                    this.footprintsVertices,
                    footprint.footprintVertexOffset,
                    footprint.footprintVertexLength,
                    region.footprintTileId.canonical,
                    coord.canonical,
                    transformedVertices);

                if (footprintTrianglesIntersect(
                    region.footprint,
                    transformedVertices,
                    this.footprintsIndices.uint16,
                    footprint.footprintIndexOffset,
                    footprint.footprintIndexLength,
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

        PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_COMMON, 'BuildingBucket.updateReplacement', 'BuildingBucket', perfStartTime);
    }

    getFootprint(feature: VectorTileFeature) : BuildingFootprint | null {
        if (feature.id !== undefined) {
            assert(this.featureFootprintLookup.has(feature.id));
            const footprintIndex = this.featureFootprintLookup.get(feature.id);
            return this.footprints[footprintIndex];
        }

        return null;
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
            const footprintVertices = this.footprintsVertices.float32.subarray(footprint.footprintVertexOffset * 2, (footprint.footprintVertexOffset + footprint.footprintVertexLength) * 2);
            const footprintIndices = this.footprintsIndices.uint16.subarray(footprint.footprintIndexOffset, footprint.footprintIndexOffset + footprint.footprintIndexLength);
            if (pointInTriangleMesh(pt, footprintVertices, footprintIndices)) {
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

/*
public static bool PointInTriangle(Point p, Point p0, Point p1, Point p2)
{
    var s = (p0.X - p2.X) * (p.Y - p2.Y) - (p0.Y - p2.Y) * (p.X - p2.X);
    var t = (p1.X - p0.X) * (p.Y - p0.Y) - (p1.Y - p0.Y) * (p.X - p0.X);

    if ((s < 0) != (t < 0) && s != 0 && t != 0)
        return false;

    var d = (p2.X - p1.X) * (p.Y - p1.Y) - (p2.Y - p1.Y) * (p.X - p1.X);
    return d == 0 || (d < 0) == (s + t <= 0);
}
*/

function pointInTriangleMesh(pt: Point, vertices: Float32Array, indices: Uint32Array | Uint16Array) {
    for (let triIndex = 0; triIndex < indices.length; triIndex += 3) {
        const i0 = indices[triIndex];
        const i1 = indices[triIndex + 1];
        const i2 = indices[triIndex + 2];
        const p0X = vertices[i0 * 2 + 0];
        const p0Y = vertices[i0 * 2 + 1];
        const p1X = vertices[i1 * 2 + 0];
        const p1Y = vertices[i1 * 2 + 1];
        const p2X = vertices[i2 * 2 + 0];
        const p2Y = vertices[i2 * 2 + 1];

        const s = (p0X - p2X) * (pt.y - p2Y) - (p0Y - p2Y) * (pt.x - p2X);
        const t = (p1X - p0X) * (pt.y - p0Y) - (p1Y - p0Y) * (pt.x - p0X);

        if ((s < 0) !== (t < 0) && s !== 0 && t !== 0)
            continue;

        const d = (p2X - p1X) * (pt.y - p1Y) - (p2Y - p1Y) * (pt.x - p1X);
        if (d === 0 || (d < 0) === (s + t <= 0)) {
            return true;
        }
    }
    return false;
}

function transformFootprintVerticesFloat32(vertices: StructArrayLayout2f8, offset: number, count: number, footprintId: CanonicalTileID, centroidId: CanonicalTileID, out: Array<Point>) {
    const zDiff = Math.pow(2.0, footprintId.z - centroidId.z);

    for (let i = 0; i < count; i++) {
        let x = vertices.float32[(i + offset) * 2 + 0];
        let y = vertices.float32[(i + offset) * 2 + 1];

        x = (x + centroidId.x * EXTENT) * zDiff - footprintId.x * EXTENT;
        y = (y + centroidId.y * EXTENT) * zDiff - footprintId.y * EXTENT;

        out.push(new Point(x, y));
    }
}

register(BuildingBucket, 'BuildingBucket', {omit: ['layers']});
register(BuildingGeometry, 'BuildingGeometry');
register(BuildingBloomGeometry, 'BuildingBloomGeometry');

export default BuildingBucket;
