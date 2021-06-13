// @flow

import {FillExtrusionLayoutArray, FillExtrusionCentroidArray} from '../array_types.js';

import {members as layoutAttributes, centroidAttributes} from './fill_extrusion_attributes.js';
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
import type {ImagePosition} from '../../render/image_atlas.js';

// Also declared in _prelude_terrain.vertex.glsl
// Used to scale most likely elevation values to fit well in an uint16
// (Elevation of Dead Sea + ELEVATION_OFFSET) * ELEVATION_SCALE is roughly 0
// (Height of mt everest + ELEVATION_OFFSET) * ELEVATION_SCALE is roughly 64k
export const ELEVATION_SCALE = 7.0;
export const ELEVATION_OFFSET = 450;

const NORMAL_UP = 0x7E00;

function addVertex(vertexArray, x, y, normal, normalUp, top, e) {
    vertexArray.emplaceBack(
        // a_pos_normal_ed:
        // Encode top and side/up normal using the least significant bits
        (x << 1) + top,
        (y << 1) + normalUp,
        normal,
        // edgedistance (used for wrapping patterns around extrusion sides)
        Math.round(e)
    );
}

function supportedRoofType(feature, polygons) {
    const roofType = feature.properties && feature.properties['roof:shape'];
    return (roofType === 'gabled' || roofType === 'pyramidal' || roofType == 'dome') ? roofType : null;
}

type RingBoundaryType = 'split' | 'inside';

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
        let checkBorders = !!this.borders;

        const min = this.min, max = this.max;
        if (p.x < min.x) {
            min.x = p.x;
            checkBorders = true;
        } else if (p.x > max.x) {
            max.x = p.x;
            checkBorders = true;
        }
        if (p.y < min.y) {
            min.y = p.y;
            checkBorders = true;
        } else if (p.y > max.y) {
            max.y = p.y;
            checkBorders = true;
        }
        if (((p.x === 0 || p.x === EXTENT) && p.x === prev.x) !== ((p.y === 0 || p.y === EXTENT) && p.y === prev.y)) {
            // Custom defined geojson buildings are cut on borders. Points are
            // repeated when edge cuts tile corner (reason for using xor).
            this.processBorderOverlap(p, prev);
        }
        if (checkBorders) this.checkBorderIntersection(p, prev);
    }

    checkBorderIntersection(p: Point, prev: Point) {
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

    indexArray: TriangleIndexArray;
    indexBuffer: IndexBuffer;

    hasPattern: boolean;
    programConfigurations: ProgramConfigurationSet<FillExtrusionStyleLayer>;
    segments: SegmentVector;
    uploaded: boolean;
    features: Array<BucketFeature>;

    featuresOnBorder: Array<PartMetadata>;
    // borders / borderDone: 0 - left, 1, right, 2 - top, 3 - bottom
    borders: Array<Array<number>>; // For each side, indices into featuresOnBorder array.
    borderDone: Array<boolean>;
    needsCentroidUpdate: boolean;
    tileToMeter: number; // cache conversion.

    constructor(options: BucketParameters<FillExtrusionStyleLayer>) {
        this.zoom = options.zoom;
        this.overscaling = options.overscaling;
        this.layers = options.layers;
        this.layerIds = this.layers.map(layer => layer.id);
        this.index = options.index;
        this.hasPattern = false;

        this.layoutVertexArray = new FillExtrusionLayoutArray();
        this.centroidVertexArray = new FillExtrusionCentroidArray();
        this.indexArray = new TriangleIndexArray();
        this.programConfigurations = new ProgramConfigurationSet(options.layers, options.zoom);
        this.segments = new SegmentVector();
        this.stateDependentLayerIds = this.layers.filter((l) => l.isStateDependent()).map((l) => l.id);
        this.enableTerrain = options.enableTerrain;
    }

    populate(features: Array<IndexedFeature>, options: PopulateParameters, canonical: CanonicalTileID) {
        this.features = [];
        this.hasPattern = hasPattern('fill-extrusion', this.layers, options);
        this.featuresOnBorder = [];
        this.borders = [[], [], [], []];
        this.borderDone = [false, false, false, false];
        this.tileToMeter = tileToMeter(canonical);

        for (const {feature, id, index, sourceLayerIndex} of features) {
            const needGeometry = this.layers[0]._featureFilter.needGeometry;
            const evaluationFeature = toEvaluationFeature(feature, needGeometry);

            if (!this.layers[0]._featureFilter.filter(new EvaluationParameters(this.zoom), evaluationFeature, canonical)) continue;

            const bucketFeature: BucketFeature = {
                id,
                sourceLayerIndex,
                index,
                geometry: needGeometry ? evaluationFeature.geometry : loadGeometry(feature),
                properties: feature.properties,
                type: feature.type,
                patterns: {}
            };

            const vertexArrayOffset = this.layoutVertexArray.length;
            if (this.hasPattern) {
                this.features.push(addPatternDependencies('fill-extrusion', this.layers, bucketFeature, this.zoom, options));
            } else {
                this.addFeature(bucketFeature, bucketFeature.geometry, index, canonical, {});
            }

            options.featureIndex.insert(feature, bucketFeature.geometry, index, sourceLayerIndex, this.index, vertexArrayOffset);
        }
        this.sortBorders();
    }

    addFeatures(options: PopulateParameters, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}) {
        for (const feature of this.features) {
            const {geometry} = feature;
            this.addFeature(feature, geometry, feature.index, canonical, imagePositions);
        }
        this.sortBorders();
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
        if (this.centroidVertexBuffer) this.centroidVertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.programConfigurations.destroy();
        this.segments.destroy();
    }

    encodeSideNormal(p1: Point, p2: Point): number {
        const d = p1.sub(p2)._perp();
        return this.encodeNormal(d.x, d.y, 0);
    }

    encodeNormal(x: number, y: number, z: number) {
        let normal = 0x01;
        if (y < 0) {
            y = -y;
            normal = 0;
        }

        const xAbs = Math.abs(x);
        const w = 126.0 / (xAbs + y + z);
        let xBits = Math.floor(w * xAbs);
        let zBits = Math.floor(w * z);
        normal = normal | (xBits << 1) | (zBits << 8);
        if (x < 0) {
            // endode dx sign using the sign of the int16.
            normal = -normal;
        }
        return normal;
    }

    encodeFaceNormal(p1: Point, p2: Point, p3: Point): number {
        const d21 = p1.sub(p2);
        const d23 = p3.sub(p2);
        const meter = -1 / this.tileToMeter;
        
        let x = d21.y * meter;
        let y = -d21.x * meter;
        let z = d21.x * d23.y - d21.y * d23.x;

        return this.encodeNormal(x, y, z);
    }

    addFeature(feature: BucketFeature, geometry: Array<Array<Point>>, index: number, canonical: CanonicalTileID, imagePositions: {[_: string]: ImagePosition}) {
        const flatRoof = this.enableTerrain && feature.properties &&
            vectorTileFeatureTypes[feature.type] === 'Polygon';

        const metadata = flatRoof ? new PartMetadata() : null;

        const polygons = classifyRings(geometry, EARCUT_MAX_RINGS);
        // Roof shape type is supported if there is no pattern
        const roofShapeType = !this.hasPattern && supportedRoofType(feature, polygons);

        for (const polygon of polygons) {
            let numVertices = 0;
            let segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);

            if (polygon.length === 0 || isEntirelyOutside(polygon[0])) {
                continue;
            }

            if (roofShapeType) {
                segment = this.addRoofVertices(roofShapeType, polygon, segment, metadata);
                continue;
            }
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

                        if (!isBoundaryEdge(p1, p2)) {
                            if (metadata) metadata.append(p1, p2);
                            if (segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                                segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
                            }
                            const normal = this.encodeSideNormal(p1, p2);
                            const dist = p2.dist(p1);
                            if (edgeDistance + dist > 32768) edgeDistance = 0;

                            addVertex(this.layoutVertexArray, p1.x, p1.y, normal, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p1.x, p1.y, normal, 0, 1, edgeDistance);

                            edgeDistance += dist;

                            addVertex(this.layoutVertexArray, p2.x, p2.y, normal, 0, 0, edgeDistance);
                            addVertex(this.layoutVertexArray, p2.x, p2.y, normal, 0, 1, edgeDistance);

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

                    addVertex(this.layoutVertexArray, p.x, p.y, NORMAL_UP, 1, 1, 0);

                    flattened.push(p.x);
                    flattened.push(p.y);
                    if (metadata) metadata.currentPolyCount.top++;
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

        this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length, feature, index, imagePositions, canonical);
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

    getBoundaryPosition(ring: Array<Point>): RingBoundaryType {
        let bordersCut = 0;
        let paddedBorder = 0;
        let isVerticalBorder = false;
        for (let p = 0; p < ring.length - 1; p++) {
            const p1 = ring[p];
            const p2 = ring[p + 1];
            if (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) {
                bordersCut++;
                paddedBorder = p1.x;
                isVerticalBorder = true;
            } else if (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT)) {
                bordersCut++;
                paddedBorder = p1.y;
            }
        }
        if (bordersCut === 0) {
            return 'inside';
        }
        return 'split';
    }

    addTriangleVertices(p1: Point, p2: Point, top: Point, segment: Segment, normal: number): Segment {
        if (segment.vertexLength + 3 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
            segment = this.segments.prepareSegment(3, this.layoutVertexArray, this.indexArray);
        }
        const offset = segment.vertexLength;
        addVertex(this.layoutVertexArray, p1.x, p1.y, normal, 0, 0, 0);
        addVertex(this.layoutVertexArray, top.x, top.y, normal, 0, 1, 0);
        addVertex(this.layoutVertexArray, p2.x, p2.y, normal, 0, 0, 0);
        this.indexArray.emplaceBack(offset, offset + 1, offset + 2);
        segment.vertexLength += 3;
        segment.primitiveLength++;
        return segment;
    }

    addRectVertices(p1: Point, p1t: Point, p2: Point, p2t: Point, segment: Segment, normal: ?number, center: ?Point): Segment {
        if (segment.vertexLength + 4 > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
            segment = this.segments.prepareSegment(4, this.layoutVertexArray, this.indexArray);
        }
        const offset = segment.vertexLength;
        addVertex(this.layoutVertexArray, p1.x, p1.y, normal, 0, 0, 0);
        addVertex(this.layoutVertexArray, p1t.x, p1t.y, normal, 0, 1, 0);
        addVertex(this.layoutVertexArray, p2.x, p2.y, normal, 0, 0, 0);
        addVertex(this.layoutVertexArray, p2t.x, p2t.y, normal, 0, 1, 0);
        this.indexArray.emplaceBack(offset, offset + 1, offset + 2);
        this.indexArray.emplaceBack(offset + 2, offset + 1, offset + 3);
        segment.vertexLength += 4;
        segment.primitiveLength += 2;
        return segment;
    }

    addRoofVertices(roofType: RoofType, polygon: Polygon, seg: Segment, metadata: ?PartMetadata): Segment {
        let segment = seg;
        if (roofType === 'gabled') {
            for (let i = 0; i < polygon.length; i++) {
                const ring = polygon[i];
                // TODO: cut border roofs are hidden, return and render cuboid until it is possible to reconstruct
                if (ring.length < 3 || this.getBoundaryPosition(ring) === 'split' || ring.length !== 5) {
                    continue;
                }

                if (metadata) metadata.startRing(ring[0]);
                let shortestEdge = Number.MAX_VALUE;
                let shortestEdgeStartPoint = 0;

                for (let p = 1; p < ring.length; p++) {
                    const p2 = ring[p];
                    const p1 = ring[p - 1];
                    const dist = p2.distSqr(p1);
                    if (dist < shortestEdge) {
                        shortestEdge = dist;
                        shortestEdgeStartPoint = p - 1;
                    }
                    if (metadata) metadata.append(p1, p2);
                }
                if (metadata) {
                    metadata.currentPolyCount.edges = 0;
                    metadata.currentPolyCount.top = 14; // two rectangles and two triangles
                }

                for (let p = 0; p < ring.length - 1; p++) {
                    const p1 = ring[p];
                    const p2 = ring[p + 1];
                    if (p === shortestEdgeStartPoint || p === (shortestEdgeStartPoint + 2) % 4) {
                        const normal = this.encodeSideNormal(p2, p1);
                        segment = this.addTriangleVertices(p1, p2, p1.add(p2)._mult(0.5)._round(), segment, normal);
                    } else {
                        const p0 = ring[(p + 3) % 4];
                        const p3 = ring[(p + 2) % 4];
                        const p01 = p0.add(p1)._mult(0.5)._round();
                        const p23 = p2.add(p3)._mult(0.5)._round();
                        const normal = this.encodeFaceNormal(p2, p1, p01);
                        segment = this.addRectVertices(p1, p01, p2, p23, segment, normal);
                    }
                }
            }
        } else if (roofType === 'pyramidal') {
            for (let i = 0; i < polygon.length; i++) {
                const ring = polygon[i];
                // TODO: cut border roofs are hidden, return and render cuboid until it is possible to reconstruct
                if (ring.length < 3 || this.getBoundaryPosition(ring) === 'split') {
                    continue;
                }
                if (metadata) metadata.startRing(ring[0]);

                // Low number of points expected so no need to use standard convex hull approach.
                let farthestDistanceSquare = 0;
                let farthestPoints = [0, 1];

                for (let i = 0; i < ring.length - 1; i++) {
                    const p1 = ring[i];
                    if (metadata) metadata.append(p1, ring[i + 1]);
                    for (let j = i + 1; j < ring.length; j++) {
                        const distSquare = p1.distSqr(ring[j]);
                        if (distSquare > farthestDistanceSquare) {
                            farthestDistanceSquare = distSquare;
                            farthestPoints = [i, j];
                        }
                    }
                }
                const vertexCount = (ring.length - 1) * 3; // triangle over every edge 
                if (metadata) {
                    metadata.currentPolyCount.edges = 0;
                    metadata.currentPolyCount.top = vertexCount;
                }
                const p0 = ring[farthestPoints[0]].add(ring[farthestPoints[1]])._mult(0.5)._round();

                for (let p = 0; p < ring.length - 1; p++) {
                    const p1 = ring[p];
                    const p2 = ring[p + 1];
                    const normal = this.encodeFaceNormal(p2, p1, p0);
                    segment = this.addTriangleVertices(p1, p2, p0, segment, normal);
                }
            }
        } else if (roofType === 'dome') {
            for (let i = 0; i < polygon.length; i++) {
                const ring = polygon[i];
                // TODO: cut border roofs are hidden, return and render cuboid until it is possible to reconstruct
                if (ring.length < 3 || this.getBoundaryPosition(ring) === 'split') {
                    continue;
                }
                if (metadata) metadata.startRing(ring[0]);
        
                const c = ring.reduce((acc, v) => acc._add(v), new Point(0.0, 0.0))._div(ring.length)._round();
                const height = ring[0].dist(c);

                const steps = 5;
                const meter = 1 / this.tileToMeter;
                const levelCount = ring.length - 1;
                const vertexCount = levelCount * steps + 1;

                if (metadata) {
                    metadata.currentPolyCount.edges = 0;
                    metadata.currentPolyCount.top = vertexCount;
                }
                if (segment.vertexLength + vertexCount > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) {
                    segment = this.segments.prepareSegment(vertexCount, this.layoutVertexArray, this.indexArray);
                }
                const index = segment.vertexLength;
                segment.vertexLength += vertexCount;
                segment.primitiveLength += ((steps - 1) * levelCount * 2 + levelCount);
                for (let i = 0; i < steps; i++) {
                    const cos = Math.cos(i * Math.PI / 2 / 5);
                    const sin = Math.sin(i * Math.PI / 2 / 5);
                    const hAdjusted = (height * sin) * (height * sin) / meter;

                    for (let p = 0; p < levelCount; p++) {
                        const pCircle = ring[p];
                        const offset = pCircle.sub(c)._mult(cos);
                        const p1 = c.add(offset).round();
                        // Normal direction is from center to vertex, with height scaled
                        // to one meter: as we don't know the height yet, normal.z is
                        // adjusted in shader code.
                        // While elsewhere we use face normals, here per-vertex normals are
                        // used to achieve smooth results (and use less vertices).
                        const normal = this.encodeNormal(-offset.x, -offset.y, hAdjusted);
                        // 1 (normal up) 0 (top) combination encodes that `edge` field is used
                        // for ratio of height - base (vertical offset over base).
                        addVertex(this.layoutVertexArray, p1.x, p1.y, normal, 1, 0, sin * 8192.0);
                    }
                }
                addVertex(this.layoutVertexArray, c.x, c.y, NORMAL_UP, 0, 1, 0);
        
                for (let q = 0; q < steps - 1; q++) {
                    for (let p = 0; p < levelCount; p++) {
                        const i = index + q * levelCount + p;
                        // closed circle: wire last to first
                        const j = p < levelCount - 1 ? i + 1 : i - p;
                        this.indexArray.emplaceBack(i, i + levelCount, j);
                        this.indexArray.emplaceBack(i + levelCount, j + levelCount, j);
                    }
                }
                for (let p = 0; p < levelCount; p++) {
                    const i = index + (steps - 1) * levelCount + p;
                    // closed circle: wire last to first
                    const j = p < levelCount - 1 ? i + 1 : i - p;
                    this.indexArray.emplaceBack(i, segment.vertexLength - 1, j);
                }
            }
        }
        return segment;
    }
}

register('FillExtrusionBucket', FillExtrusionBucket, {omit: ['layers', 'features']});
register('PartMetadata', PartMetadata);

export default FillExtrusionBucket;

function isBoundaryEdge(p1, p2) {
    return (p1.x === p2.x && (p1.x < 0 || p1.x > EXTENT)) ||
        (p1.y === p2.y && (p1.y < 0 || p1.y > EXTENT));
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
