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
    edgeRadius: number;
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
        this.edgeRadius = 0;
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
        this.edgeRadius = this.layers[0].layout.get('fill-extrusion-edge-radius') / this.tileToMeter;

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
        const isPolygon = vectorTileFeatureTypes[feature.type] === 'Polygon';

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

        const edgeRadius = isPolygon ? this.edgeRadius : 0;

        for (const {polygon, bounds} of clippedPolygons) {
            // Only triangulate and draw the area of the feature if it is a polygon
            // Other feature types (e.g. LineString) do not have area, so triangulation is pointless / undefined
            let topIndex = 0;
            let numVertices = 0;
            for (const ring of polygon) {
                // make sure the ring closes
                if (isPolygon && !ring[0].equals(ring[ring.length - 1])) ring.push(ring[0]);
                numVertices += (isPolygon ? (ring.length - 1) : ring.length);
            }
            // We use "(isPolygon ? 5 : 4) * numVertices" as an estimate to ensure whether additional segments are needed or not (see SegmentVector.MAX_VERTEX_ARRAY_LENGTH).
            const segment = this.segments.prepareSegment((isPolygon ? 5 : 4) * numVertices, this.layoutVertexArray, this.indexArray);
            if (isPolygon) {
                const flattened = [];
                const holeIndices = [];
                topIndex = segment.vertexLength;

                // First we offset (inset) the top vertices (i.e the vertices that make up the roof).
                for (const ring of polygon) {
                    if (ring.length && ring !== polygon[0]) {
                        holeIndices.push(flattened.length / 2);
                    }

                    // The following vectors are used to avoid duplicate normal calculations when going over the vertices.
                    let na, nb;
                    {
                        const p0 = ring[0];
                        const p1 = ring[1];
                        na = p1.sub(p0)._perp()._unit();
                    }
                    for (let i = 1; i < ring.length; i++) {
                        const p1 = ring[i];
                        const p2 = ring[i === ring.length - 1 ? 1 : i + 1];

                        let {x, y} = p1;
                        if (edgeRadius) {
                            nb = p2.sub(p1)._perp()._unit();
                            const nm = na.add(nb)._unit();

                            const cosHalfAngle = na.x * nm.x + na.y * nm.y;
                            const offset = edgeRadius * Math.min(4, 1 / cosHalfAngle);

                            x += offset * nm.x;
                            y += offset * nm.y;

                            na = nb;
                        }

                        addVertex(this.layoutVertexArray, x, y, 0, 0, 1, 1, 0);
                        segment.vertexLength++;

                        // triangulate as if vertices were not offset to ensure correct triangulation
                        flattened.push(p1.x, p1.y);

                        if (isGlobe) {
                            const array: any = this.layoutVertexExtArray;
                            const projectedP = projection.projectTilePoint(x, y, canonical);
                            const n = projection.upVector(canonical, x, y);
                            addGlobeExtVertex(array, projectedP, n);
                        }
                    }
                }

                const indices = earcut(flattened, holeIndices);
                assert(indices.length % 3 === 0);

                for (let j = 0; j < indices.length; j += 3) {
                    // clockwise winding order.
                    this.indexArray.emplaceBack(
                        topIndex + indices[j],
                        topIndex + indices[j + 2],
                        topIndex + indices[j + 1]);
                    segment.primitiveLength++;
                }
            }

            for (const ring of polygon) {
                if (metadata && ring.length) metadata.startRing(ring[0]);
                let isPrevCornerConcave = ring.length > 4 && isAOConcaveAngle(ring[ring.length - 2], ring[0], ring[1]);
                let offsetPrev = edgeRadius ? getRoundedEdgeOffset(ring[ring.length - 2], ring[0], ring[1], edgeRadius) : 0;

                let kFirst;

                // The following vectors are used to avoid duplicate normal calculations when going over the vertices.
                let na, nb;
                {
                    const p0 = ring[0];
                    const p1 = ring[1];
                    na = p1.sub(p0)._perp()._unit();
                }
                for (let i = 1, edgeDistance = 0; i < ring.length; i++) {
                    let p0 = ring[i - 1];
                    let p1 = ring[i];
                    const p2 = ring[i === ring.length - 1 ? 1 : i + 1];

                    if (metadata && isPolygon) metadata.currentPolyCount.top++;
                    if (isEdgeOutsideBounds(p1, p0, bounds)) {
                        if (edgeRadius) {
                            na = p2.sub(p1)._perp()._unit();
                        }
                        continue;
                    }
                    if (metadata) metadata.append(p1, p0);

                    const d = p1.sub(p0)._perp();
                    // Given that nz === 0, encode nx / (abs(nx) + abs(ny)) and signs.
                    // This information is sufficient to reconstruct normal vector in vertex shader.
                    const nxRatio = d.x / (Math.abs(d.x) + Math.abs(d.y));
                    const nySign = d.y > 0 ? 1 : 0;

                    const dist = p0.dist(p1);
                    if (edgeDistance + dist > 32768) edgeDistance = 0;

                    // Next offset the vertices along the edges and create a chamfer space between them:
                    // So if we have the following (where 'x' denotes a vertex)
                    // x──────x
                    // |      |
                    // |      |
                    // |      |
                    // |      |
                    // x──────x
                    // we end up with:
                    //  x────x
                    // x      x
                    // |      |
                    // |      |
                    // x      x
                    //  x────x
                    // (drawing isn't exact but hopefully gets the point across).

                    if (edgeRadius) {
                        nb = p2.sub(p1)._perp()._unit();

                        const cosHalfAngle = getCosHalfAngle(na, nb);
                        let offsetNext = _getRoundedEdgeOffset(p0, p1, p2, cosHalfAngle, edgeRadius);

                        if (isNaN(offsetNext)) offsetNext = 0;
                        const nEdge = p1.sub(p0)._unit();
                        p0 = p0.add(nEdge.mult(offsetPrev))._round();
                        p1 = p1.add(nEdge.mult(-offsetNext))._round();
                        offsetPrev = offsetNext;

                        na = nb;
                    }

                    const k = segment.vertexLength;

                    const isConcaveCorner = ring.length > 4 && isAOConcaveAngle(p0, p1, p2);
                    let encodedEdgeDistance = encodeAOToEdgeDistance(edgeDistance, isPrevCornerConcave, true);

                    addVertex(this.layoutVertexArray, p0.x, p0.y, nxRatio, nySign, 0, 0, encodedEdgeDistance);
                    addVertex(this.layoutVertexArray, p0.x, p0.y, nxRatio, nySign, 0, 1, encodedEdgeDistance);

                    edgeDistance += dist;
                    encodedEdgeDistance = encodeAOToEdgeDistance(edgeDistance, isConcaveCorner, false);
                    isPrevCornerConcave = isConcaveCorner;

                    addVertex(this.layoutVertexArray, p1.x, p1.y, nxRatio, nySign, 0, 0, encodedEdgeDistance);
                    addVertex(this.layoutVertexArray, p1.x, p1.y, nxRatio, nySign, 0, 1, encodedEdgeDistance);

                    segment.vertexLength += 4;

                    // ┌──────┐
                    // │ 1  3 │ clockwise winding order.
                    // │      │ Triangle 1: 0 => 1 => 2
                    // │ 0  2 │ Triangle 2: 1 => 3 => 2
                    // └──────┘
                    this.indexArray.emplaceBack(k + 0, k + 1, k + 2);
                    this.indexArray.emplaceBack(k + 1, k + 3, k + 2);
                    segment.primitiveLength += 2;

                    if (edgeRadius) {
                        // Note that in the previous for-loop we start from index 1 to add the top vertices which explains the next line.
                        const t0 = topIndex + (i === 1 ? ring.length - 2 : i - 2);
                        const t1 = i === 1 ? topIndex : t0 + 1;

                        // top chamfer along the side (i.e. the space between the wall and the roof).
                        this.indexArray.emplaceBack(k + 1, t0, k + 3);
                        this.indexArray.emplaceBack(t0, t1, k + 3);
                        segment.primitiveLength += 2;

                        if (kFirst === undefined) {
                            kFirst = k;
                        }

                        // Make sure to fill in the gap in the corner only when both corresponding edges are in tile bounds.
                        if (!isEdgeOutsideBounds(p2, ring[i], bounds)) {
                            const l = i === ring.length - 1 ? kFirst : segment.vertexLength;

                            // vertical side chamfer i.e. the space between consecutive walls.
                            this.indexArray.emplaceBack(k + 2, k + 3, l);
                            this.indexArray.emplaceBack(k + 3, l + 1, l);

                            // top corner where the top(roof) and two sides(walls) meet.
                            this.indexArray.emplaceBack(k + 3, t1, l + 1);

                            segment.primitiveLength += 3;
                        }
                    }

                    if (isGlobe) {
                        const array: any = this.layoutVertexExtArray;

                        const projectedP0 = projection.projectTilePoint(p0.x, p0.y, canonical);
                        const projectedP1 = projection.projectTilePoint(p1.x, p1.y, canonical);

                        const n0 = projection.upVector(canonical, p0.x, p0.y);
                        const n1 = projection.upVector(canonical, p1.x, p1.y);

                        addGlobeExtVertex(array, projectedP0, n0);
                        addGlobeExtVertex(array, projectedP0, n0);
                        addGlobeExtVertex(array, projectedP1, n1);
                        addGlobeExtVertex(array, projectedP1, n1);
                    }
                }
                if (isPolygon) topIndex += (ring.length - 1);
            }
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
            for (let i = 0; i < polyInfo.top; i++) {
                this.centroidVertexArray.emplace(offset++, x, y);
            }
            for (let i = 0; i < polyInfo.edges * 2; i++) {
                this.centroidVertexArray.emplace(offset++, 0, y);
                this.centroidVertexArray.emplace(offset++, x, y);
            }
        }
    }
}

function getCosHalfAngle(na, nb) {
    const nm = na.add(nb)._unit();
    const cosHalfAngle = na.x * nm.x + na.y * nm.y;
    return cosHalfAngle;
}

function getRoundedEdgeOffset(p0, p1, p2, edgeRadius) {
    const na = p1.sub(p0)._perp()._unit();
    const nb = p2.sub(p1)._perp()._unit();
    const cosHalfAngle = getCosHalfAngle(na, nb);
    return _getRoundedEdgeOffset(p0, p1, p2, cosHalfAngle, edgeRadius);
}

function _getRoundedEdgeOffset(p0, p1, p2, cosHalfAngle, edgeRadius) {
    const sinHalfAngle = Math.sqrt(1 - cosHalfAngle * cosHalfAngle);
    return Math.min(p0.dist(p1) / 3, p1.dist(p2) / 3, edgeRadius * sinHalfAngle / cosHalfAngle);
}

register(FillExtrusionBucket, 'FillExtrusionBucket', {omit: ['layers', 'features']});
register(PartMetadata, 'PartMetadata');

export default FillExtrusionBucket;

// Edges that are outside tile bounds are defined in tile across the border.
// Rendering them twice often results with Z-fighting.
// In case of globe and axis aligned bounds, it is also useful to
// discard edges that have the both endpoints outside the same bound.
function isEdgeOutsideBounds(p1, p2, bounds) {
    return (p1.x < bounds[0].x && p2.x < bounds[0].x) ||
           (p1.x > bounds[1].x && p2.x > bounds[1].x) ||
           (p1.y < bounds[0].y && p2.y < bounds[0].y) ||
           (p1.y > bounds[1].y && p2.y > bounds[1].y);
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

function isAOConcaveAngle(p2, p1, p3) {
    if (p2.x < 0 || p2.x >= EXTENT || p1.x < 0 || p1.x >= EXTENT || p3.x < 0 || p3.x >= EXTENT) {
        return false; // angles are not processed for edges that extend over tile borders
    }
    const a = p3.sub(p1);
    const an = a.perp();
    const b = p2.sub(p1);
    const ab = a.x * b.x + a.y * b.y;
    const cosAB = ab / Math.sqrt(((a.x * a.x + a.y * a.y) * (b.x * b.x + b.y * b.y)));
    const dotProductWithNormal = an.x * b.x + an.y * b.y;

    // Heuristics: don't shade concave angles above 150° (arccos(-0.866)).
    return cosAB > -0.866 && dotProductWithNormal < 0;
}

function encodeAOToEdgeDistance(edgeDistance, isConcaveCorner, edgeStart) {
    // Encode concavity and edge start/end using the least significant bits.
    // Second least significant bit 1 encodes concavity.
    // The least significant bit 1 marks the edge start, 0 for edge end.
    const encodedEdgeDistance = isConcaveCorner ? (edgeDistance | 2) : (edgeDistance & ~2);
    return edgeStart ? (encodedEdgeDistance | 1) : (encodedEdgeDistance & ~1);
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
