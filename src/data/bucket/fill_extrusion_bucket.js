// @flow

import {FillExtrusionLayoutArray, FillExtrusionExtArray, FillExtrusionCentroidArray} from '../array_types.js';

import {members as layoutAttributes, centroidAttributes, fillExtrusionAttributesExt} from './fill_extrusion_attributes.js';
import SegmentVector from '../segment.js';
import {ProgramConfigurationSet} from '../program_configuration.js';
import {TriangleIndexArray} from '../index_array_type.js';
import EXTENT from '../extent.js';
import earcut from 'earcut';
import mvt from '@mapbox/vector-tile';
const vectorTileFeatureTypes = mvt.VectorTileFeature.types;
import classifyRings from '../../util/classify_rings.js';
import assert from 'assert';
const EARCUT_MAX_RINGS = 500;
import {register} from '../../util/web_worker_transfer.js';
import {hasPattern, addPatternDependencies} from './pattern_bucket_features.js';
import loadGeometry from '../load_geometry.js';
import toEvaluationFeature from '../evaluation_feature.js';
import EvaluationParameters from '../../style/evaluation_parameters.js';
import Point from '@mapbox/point-geometry';
import {number as interpolate} from '../../style-spec/util/interpolate.js';
import {lngFromMercatorX, latFromMercatorY, mercatorYfromLat} from '../../geo/mercator_coordinate.js';
import {subdividePolygons} from '../../util/polygon_clipping.js';
import type {ClippedPolygon} from '../../util/polygon_clipping.js';
import type {Vec3} from 'gl-matrix';
import type {CanonicalTileID} from '../../source/tile_id.js';
import type {
    Bucket,
    BucketParameters,
    BucketFeature,
    IndexedFeature,
    PopulateParameters
} from '../bucket.js';

import type FillExtrusionStyleLayer from '../../style/style_layer/fill_extrusion_style_layer.js';
import type Context from '../../gl/context.js';
import type IndexBuffer from '../../gl/index_buffer.js';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import type {FeatureStates} from '../../source/source_state.js';
import type {SpritePositions} from '../../util/image.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';
import type {TileTransform} from '../../geo/projection/tile_transform.js';
import {earthRadius} from '../../geo/lng_lat.js';

const FACTOR = Math.pow(2, 13);

// Also declared in _prelude_terrain.vertex.glsl
// Used to scale most likely elevation values to fit well in an uint16
// (Elevation of Dead Sea + ELEVATION_OFFSET) * ELEVATION_SCALE is roughly 0
// (Height of mt everest + ELEVATION_OFFSET) * ELEVATION_SCALE is roughly 64k
export const ELEVATION_SCALE = 7.0;
export const ELEVATION_OFFSET = 450;

function addVertex(vertexArray, x, y, nxRatio, nySign, normalUp, top, e) {
    vertexArray.emplaceBack(
        // a_pos_normal_ed:
        // Encode top and side/up normal using the least significant bits
        (x << 1) + top,
        (y << 1) + normalUp,
        // dxdy is signed, encode quadrant info using the least significant bit
        (Math.floor(nxRatio * FACTOR) << 1) + nySign,
        // edgedistance (used for wrapping patterns around extrusion sides)
        Math.round(e)
    );
}

function addGlobeExtVertex(vertexArray: FillExtrusionExtArray, pos: {x: number, y: number, z: number}, normal: Vec3) {
    const encode = 1 << 14;
    vertexArray.emplaceBack(
        pos.x, pos.y, pos.z,
        normal[0] * encode, normal[1] * encode, normal[2] * encode);
}

class PartMetadata {
    acc: Point;
    min: Point;
    max: Point;
    polyCount: Array<{edges: number, top: number}>;
    currentPolyCount: {edges: number, top: number};
    borders: Array<[number, number]>; // Array<[min, max]>
    vertexArrayOffset: number;

    constructor() {
        this.acc = new Point(0, 0);
        this.polyCount = [];
    }

    startRing(p: Point) {
        this.currentPolyCount = {edges: 0, top: 0};
        this.polyCount.push(this.currentPolyCount);
        if (this.min) return;
        this.min = new Point(p.x, p.y);
        this.max = new Point(p.x, p.y);
    }

    append(p: Point, prev: Point) {
        this.currentPolyCount.edges++;

        this.acc._add(p);
        const min = this.min, max = this.max;
        if (p.x < min.x) {
            min.x = p.x;
        } else if (p.x > max.x) {
            max.x = p.x;
        }
        if (p.y < min.y) {
            min.y = p.y;
        } else if (p.y > max.y) {
            max.y = p.y;
        }
        if (((p.x === 0 || p.x === EXTENT) && p.x === prev.x) !== ((p.y === 0 || p.y === EXTENT) && p.y === prev.y)) {
            // Custom defined geojson buildings are cut on borders. Points are
            // repeated when edge cuts tile corner (reason for using xor).
            this.processBorderOverlap(p, prev);
        }
        // check border intersection
        if ((prev.x < 0) !== (p.x < 0)) {
            this.addBorderIntersection(0, interpolate(prev.y, p.y, (0 - prev.x) / (p.x - prev.x)));
        }
        if ((prev.x > EXTENT) !== (p.x > EXTENT)) {
            this.addBorderIntersection(1, interpolate(prev.y, p.y, (EXTENT - prev.x) / (p.x - prev.x)));
        }
        if ((prev.y < 0) !== (p.y < 0)) {
            this.addBorderIntersection(2, interpolate(prev.x, p.x, (0 - prev.y) / (p.y - prev.y)));
        }
        if ((prev.y > EXTENT) !== (p.y > EXTENT)) {
            this.addBorderIntersection(3, interpolate(prev.x, p.x, (EXTENT - prev.y) / (p.y - prev.y)));
        }
    }

    addBorderIntersection(index: 0 | 1 | 2 | 3, i: number) {
        if (!this.borders) {
            this.borders = [
                [Number.MAX_VALUE, -Number.MAX_VALUE],
                [Number.MAX_VALUE, -Number.MAX_VALUE],
                [Number.MAX_VALUE, -Number.MAX_VALUE],
                [Number.MAX_VALUE, -Number.MAX_VALUE]
            ];
        }
        const b = this.borders[index];
        if (i < b[0]) b[0] = i;
        if (i > b[1]) b[1] = i;
    }

    processBorderOverlap(p: Point, prev: Point) {
        if (p.x === prev.x) {
            if (p.y === prev.y) return; // custom defined geojson could have points repeated.
            const index = p.x === 0 ? 0 : 1;
            this.addBorderIntersection(index, prev.y);
            this.addBorderIntersection(index, p.y);
        } else {
            assert(p.y === prev.y);
            const index = p.y === 0 ? 2 : 3;
            this.addBorderIntersection(index, prev.x);
            this.addBorderIntersection(index, p.x);
        }
    }

    centroid(): Point {
        const count = this.polyCount.reduce((acc, p) => acc + p.edges, 0);
        return count !== 0 ? this.acc.div(count)._round() : new Point(0, 0);
    }

    span(): Point {
        return new Point(this.max.x - this.min.x, this.max.y - this.min.y);
    }

    intersectsCount(): number {
        return this.borders.reduce((acc, p) => acc + +(p[0] !== Number.MAX_VALUE), 0);
    }
}

class FillExtrusionBucket implements Bucket {
    index: number;
    zoom: number;
    canonical: CanonicalTileID;
    overscaling: number;
    enableTerrain: boolean;
    layers: Array<FillExtrusionStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<FillExtrusionStyleLayer>;
    stateDependentLayerIds: Array<string>;

    layoutVertexArray: FillExtrusionLayoutArray;
    layoutVertexBuffer: VertexBuffer;

    centroidVertexArray: FillExtrusionCentroidArray;
    centroidVertexBuffer: VertexBuffer;

    layoutVertexExtArray: ?FillExtrusionExtArray;
    layoutVertexExtBuffer: ?VertexBuffer;

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<FillExtrusionStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    features: Array<BucketFeature>;

    featuresOnBorder: Array<PartMetadata>;
    // borders / borderDoneWithNeighborZ: 0 - left, 1, right, 2 - top, 3 - bottom
    borders: Array<Array<number>>; // For each side, indices into featuresOnBorder array.
    borderDoneWithNeighborZ: Array<number>;
    needsCentroidUpdate: boolean;
    tileToMeter: number; // cache conversion.
    projection: ProjectionSpecification;

    constructor(options: BucketParameters<FillExtrusionStyleLayer>) {
        this.zoom = options.zoom;
        this.canonical = options.canonical;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;
        this.projection = options.projection;

        this.layoutVertexArray = new FillExtrusionLayoutArray();
        this.centroidVertexArray = new FillExtrusionCentroidArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.enableTerrain = options.enableTerrain;
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID, tileTransform: TileTransform) {
        this.features = [];
        this.hasPattern = hasPattern('fill-extrusion', this.layers, options);
        this.featuresOnBorder = [];
        this.borders = [[], [], [], []];
        this.borderDoneWithNeighborZ = [-1, -1, -1, -1];
        this.tileToMeter = tileToMeter(canonical);

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

            const bucketFeature: BucketFeature = {
                id,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature, canonical, tileTransform),
                properties: feature.properties,
                type: feature.type,
                patterns: {}
            };

            const vertexArrayOffset = this.layoutVertexArray.length;
            if (this.hasPattern) {
                this.features.push(addPatternDependencies('fill-extrusion', this.layers, bucketFeature, this.zoom, options));
            } else {
                this.addFeature(bucketFeature, bucketFeature.geometry, index, canonical, {}, options.availableImages, tileTransform);
            }

            options.featureIndex.insert(feature, bucketFeature.geometry, index, sourceLayerIndex, this.index, vertexArrayOffset);
        }
        this.sortBorders();
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: Array<string>, tileTransform: TileTransform) {
        for (const feature of this.features) {
            const {geometry} = feature;
            this.addFeature(feature, geometry, feature.index, canonical, imagePositions, availableImages, tileTransform);
        }
        this.sortBorders();
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: Array<string>, imagePositions: SpritePositions) {
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
            this.layoutVertexBuffer = context.createVertexBuffer(this.layoutVertexArray, layoutAttributes);
            this.indexBuffer = context.createIndexBuffer(this.indexArray);

            if (this.layoutVertexExtArray) {
                this.layoutVertexExtBuffer = context.createVertexBuffer(this.layoutVertexExtArray, fillExtrusionAttributesExt.members, true);
            }
        }
        this.programConfigurations.upload(context);
        this.uploaded = true;
    }

    uploadCentroid(context: Context) {
        if (this.centroidVertexArray.length === 0) return;
        if (!this.centroidVertexBuffer) {
            this.centroidVertexBuffer = context.createVertexBuffer(this.centroidVertexArray, centroidAttributes.members, true);
        } else if (this.needsCentroidUpdate) {
            this.centroidVertexBuffer.updateData(this.centroidVertexArray);
        }
        this.needsCentroidUpdate = false;
    }

    destroy() {
        if (!this.layoutVertexBuffer) return;
        this.layoutVertexBuffer.destroy();
        if (this.centroidVertexBuffer) {
            this.centroidVertexBuffer.destroy();
        }
        if (this.layoutVertexExtBuffer) {
            this.layoutVertexExtBuffer.destroy();
        }
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: SpritePositions, availableImages: Array<string>, tileTransform: TileTransform) {
        const tileBounds = [new Point(0, 0), new Point(EXTENT, EXTENT)];
        const projection = tileTransform.projection;
        const isGlobe = projection.name === 'globe';
        const metadata = this.enableTerrain && !isGlobe ? new PartMetadata() : null;

        if (isGlobe && !this.layoutVertexExtArray) {
            this.layoutVertexExtArray = new FillExtrusionExtArray();
        }

        const polygons = classifyRings(geometry, EARCUT_MAX_RINGS);

        for (let i = polygons.length - 1; i >= 0; i--) {
            const polygon = polygons[i];
            if (polygon.length === 0 || isEntirelyOutside(polygon[0])) {
                polygons.splice(i, 1);
            }
        }

        let clippedPolygons: ClippedPolygon[];
        if (isGlobe) {
            // Perform tesselation for polygons of tiles in order to support long planar
            // triangles on the curved surface of the globe. This is done for all polygons
            // regardless of their size in order guarantee identical results on all sides of
            // tile boundaries.
            //
            // The globe is subdivided into a 32x16 grid. The number of subdivisions done
            // for a tile depends on the zoom level. For example tile with z=0 requires 2⁴
            // subdivisions, tile with z=1 2³ etc. The subdivision is done in polar coordinates
            // instead of tile coordinates.
            clippedPolygons = resampleFillExtrusionPolygonsForGlobe(polygons, tileBounds, canonical);
        } else {
            clippedPolygons = [];
            for (const polygon of polygons) {
                clippedPolygons.push({polygon, bounds: tileBounds});
            }
        }

        for (const clippedPolygon of clippedPolygons) {
            const polygon = clippedPolygon.polygon;
            let numVertices = 0;
            let segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);

            for (let i = 0; i < polygon.length; i++) {
                const ring = polygon[i];
                if (ring.length === 0) {
                    continue;
                }
                numVertices += ring.length;

                let edgeDistance = 0;
                if (metadata) metadata.startRing(ring[0]);

                for (let p = 0; p < ring.length; p++) {
                    const p1 = ring[p];

                    if (p >= 1) {
                        const p2 = ring[p - 1];
                        if (!isBoundaryEdge(p1, p2, clippedPolygon.bounds)) {
                            if (metadata) metadata.append(p1, p2);
                            if (segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                                segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
                            }

                            const d = p1.sub(p2)._perp();
                            // Given that nz === 0, encode nx / (abs(nx) + abs(ny)) and signs.
                            // This information is sufficient to reconstruct normal vector in vertex shader.
                            const nxRatio = d.x / (Math.abs(d.x) + Math.abs(d.y));
                            const nySign = d.y > 0 ? 1 : 0;
                            const dist = p2.dist(p1);
                            if (edgeDistance + dist > 32768) edgeDistance = 0;

                            addVertex(this.layoutVertexArray, p1.x, p1.y, nxRatio, nySign, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p1.x, p1.y, nxRatio, nySign, 0, 1, edgeDistance);

                            edgeDistance += dist;

                            addVertex(this.layoutVertexArray, p2.x, p2.y, nxRatio, nySign, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p2.x, p2.y, nxRatio, nySign, 0, 1, edgeDistance);

                            const bottomRight = segment.vertexLength;

                            // ┌──────┐
                            // │ 0  1 │ Counter-clockwise winding order.
                            // │      │ Triangle 1: 0 => 2 => 1
                            // │ 2  3 │ Triangle 2: 1 => 2 => 3
                            // └──────┘
                            this.indexArray.emplaceBack(bottomRight, bottomRight + 2, bottomRight + 1);
                            this.indexArray.emplaceBack(bottomRight + 1, bottomRight + 2, bottomRight + 3);

                            segment.vertexLength += 4;
                            segment.primitiveLength += 2;

                            if (isGlobe) {
                                const array: any = this.layoutVertexExtArray;

                                const projectedP1 = projection.projectTilePoint(p1.x, p1.y, canonical);
                                const projectedP2 = projection.projectTilePoint(p2.x, p2.y, canonical);

                                const n1 = projection.upVector(canonical, p1.x, p1.y);
                                const n2 = projection.upVector(canonical, p2.x, p2.y);

                                addGlobeExtVertex(array, projectedP1, n1);
                                addGlobeExtVertex(array, projectedP1, n1);
                                addGlobeExtVertex(array, projectedP2, n2);
                                addGlobeExtVertex(array, projectedP2, n2);
                            }
                        }
                    }
                }
            }

            if (segment.vertexLength + numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                segment = this.segments.prepareSegment(numVertices, this.layoutVertexArray, this.indexArray);
            }

            //Only triangulate and draw the area of the feature if it is a polygon
            //Other feature types (e.g. LineString) do not have area, so triangulation is pointless / undefined
            if (vectorTileFeatureTypes[feature.type] !== 'Polygon')
                continue;

            const flattened = [];
            const holeIndices = [];
            const triangleIndex = segment.vertexLength;

            for (let i = 0; i < polygon.length; i++) {
                const ring = polygon[i];
                if (ring.length === 0) {
                    continue;
                }

                if (ring !== polygon[0]) {
                    holeIndices.push(flattened.length / 2);
                }

                for (let i = 0; i < ring.length; i++) {
                    const p = ring[i];

                    addVertex(this.layoutVertexArray, p.x, p.y, 0, 0, 1, 1, 0);

                    flattened.push(p.x);
                    flattened.push(p.y);
                    if (metadata) metadata.currentPolyCount.top++;

                    if (isGlobe) {
                        const array: any = this.layoutVertexExtArray;
                        const projectedP = projection.projectTilePoint(p.x, p.y, canonical);
                        const n = projection.upVector(canonical, p.x, p.y);
                        addGlobeExtVertex(array, projectedP, n);
                    }
                }
            }

            const indices = earcut(flattened, holeIndices);
            assert(indices.length % 3 === 0);

            for (let j = 0; j < indices.length; j += 3) {
                // Counter-clockwise winding order.
                this.indexArray.emplaceBack(
                    triangleIndex + indices[j],
                    triangleIndex + indices[j + 2],
                    triangleIndex + indices[j + 1]);
            }

            segment.primitiveLength += indices.length / 3;
            segment.vertexLength += numVertices;
        }

        assert(!isGlobe || (this.layoutVertexExtArray && this.layoutVertexExtArray.length === this.layoutVertexArray.length));

        if (metadata && metadata.polyCount.length > 0) {
            // When building is split between tiles, don't handle flat roofs here.
            if (metadata.borders) {
                // Store to the bucket. Flat roofs are handled in flatRoofsUpdate,
                // after joining parts that lay in different buckets.
                metadata.vertexArrayOffset = this.centroidVertexArray.length;
                const borders = metadata.borders;
                const index = this.featuresOnBorder.push(metadata) - 1;
                for (let i = 0; i < 4; i++) {
                    if (borders[i][0] !== Number.MAX_VALUE) { this.borders[i].push(index); }
                }
            }
            this.encodeCentroid(metadata.borders ? undefined : metadata.centroid(), metadata);
            assert(!this.centroidVertexArray.length || this.centroidVertexArray.length === this.layoutVertexArray.length);
        }

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, availableImages, canonical);
    }

    sortBorders() {
        for (let i = 0; i < 4; i++) {
            // Sort by border intersection area minimums, ascending.
            this.borders[i].sort((a, b) => this.featuresOnBorder[a].borders[i][0] - this.featuresOnBorder[b].borders[i][0]);
        }
    }

    encodeCentroid(c: Point, metadata: PartMetadata, append: boolean = true) {
        let x, y;
        // Encoded centroid x and y:
        //     x     y
        // ---------------------------------------------
        //     0     0    Default, no flat roof.
        //     0     1    Hide, used to hide parts of buildings on border while expecting the other side to get loaded
        //    >0     0    Elevation encoded to uint16 word
        //    >0    >0    Encoded centroid position and x & y span
        if (c) {
            if (c.y !== 0) {
                const span = metadata.span()._mult(this.tileToMeter);
                x = (Math.max(c.x, 1) << 3) + Math.min(7, Math.round(span.x / 10));
                y = (Math.max(c.y, 1) << 3) + Math.min(7, Math.round(span.y / 10));
            } else { // encode height:
                x = Math.ceil((c.x + ELEVATION_OFFSET) * ELEVATION_SCALE);
                y = 0;
            }
        } else {
            // Use the impossible situation (building that has width and doesn't cross border cannot have centroid
            // at border) to encode unprocessed border building: it is initially (append === true) hidden until
            // computing centroid for joined building parts in rendering thread (flatRoofsUpdate). If it intersects more than
            // two borders, flat roof approach is not applied.
            x = 0;
            y = +append; // Hide (1) initially when creating - visibility is changed in draw_fill_extrusion as soon as neighbor tile gets loaded.
        }

        assert(append || metadata.vertexArrayOffset !== undefined);
        let offset = append ? this.centroidVertexArray.length : metadata.vertexArrayOffset;
        for (const polyInfo of metadata.polyCount) {
            if (append) {
                this.centroidVertexArray.resize(this.centroidVertexArray.length + polyInfo.edges * 4 + polyInfo.top);
            }
            for (let i = 0; i < polyInfo.edges * 2; i++) {
                this.centroidVertexArray.emplace(offset++, 0, y);
                this.centroidVertexArray.emplace(offset++, x, y);
            }
            for (let i = 0; i < polyInfo.top; i++) {
                this.centroidVertexArray.emplace(offset++, x, y);
            }
        }
    }
}

register(FillExtrusionBucket, 'FillExtrusionBucket', {omit: ['layers', 'features']});
register(PartMetadata, 'PartMetadata');

export default FillExtrusionBucket;

function isBoundaryEdge(p1, p2, bounds) {
    return (p1.x === p2.x && (p1.x < bounds[0].x || p1.x > bounds[1].x)) ||
           (p1.y === p2.y && (p1.y < bounds[0].y || p1.y > bounds[1].y));
}

function isEntirelyOutside(ring) {
    // Discard rings with corners on border if all other vertices are outside: they get defined
    // also in the tile across the border. Eventual zero area rings at border are discarded by classifyRings
    // and there is no need to handle that case here.
    return ring.every(p => p.x <= 0) ||
        ring.every(p => p.x >= EXTENT) ||
        ring.every(p => p.y <= 0) ||
        ring.every(p => p.y >= EXTENT);
}

function tileToMeter(canonical: CanonicalTileID) {
    const circumferenceAtEquator = 40075017;
    const mercatorY = canonical.y / (1 << canonical.z);
    const exp = Math.exp(Math.PI * (1 - 2 * mercatorY));
    // simplify cos(2 * atan(e) - PI/2) from mercator_coordinate.js, remove trigonometrics.
    return circumferenceAtEquator * 2 * exp / (exp * exp + 1) / EXTENT / (1 << canonical.z);
}

export function fillExtrusionHeightLift(): number {
    // A rectangle covering globe is subdivided into a grid of 32 cells
    // This information can be used to deduce a minimum lift value so that
    // fill extrusions with 0 height will never go below the ground.
    const angle = Math.PI / 32.0;
    const tanAngle = Math.tan(angle);
    const r = earthRadius;
    return r * Math.sqrt(1.0 + 2.0 * tanAngle * tanAngle) - r;
}

// Resamples fill extrusion polygons by subdividing them into 32x16 cells in mercator space.
// The idea is to allow reprojection of large continuous planar shapes on the surface of the globe
export function resampleFillExtrusionPolygonsForGlobe(polygons: Point[][][], tileBounds: [Point, Point], tileID: CanonicalTileID): ClippedPolygon[] {
    const cellCount = 360.0 / 32.0;
    const tiles = 1 << tileID.z;
    const leftLng = lngFromMercatorX(tileID.x / tiles);
    const rightLng = lngFromMercatorX((tileID.x + 1) / tiles);
    const topLat = latFromMercatorY(tileID.y / tiles);
    const bottomLat = latFromMercatorY((tileID.y + 1) / tiles);
    const cellCountOnXAxis = Math.ceil((rightLng - leftLng) / cellCount);
    const cellCountOnYAxis = Math.ceil((topLat - bottomLat) / cellCount);

    const splitFn = (axis, min, max) => {
        if (axis === 0) {
            return 0.5 * (min + max);
        } else {
            const maxLat = latFromMercatorY((tileID.y + min / EXTENT) / tiles);
            const minLat = latFromMercatorY((tileID.y + max / EXTENT) / tiles);
            const midLat = 0.5 * (minLat + maxLat);
            return (mercatorYfromLat(midLat) * tiles - tileID.y) * EXTENT;
        }
    };

    return subdividePolygons(polygons, tileBounds, cellCountOnXAxis, cellCountOnYAxis, 1.0, splitFn);
}
