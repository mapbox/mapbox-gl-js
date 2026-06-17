import {vec2, vec3} from "gl-matrix";
import {register} from '../../src/util/web_worker_transfer';
import assert from '../../src/style-spec/util/assert';
import {ElevationFeatureParser} from "./elevation_feature_parser";
import {tileToMeter} from "../../src/geo/mercator_coordinate";
import {Ray2D} from "../../src/util/primitives";
import {clamp, smoothstep} from "../../src/util/util";
import {MARKUP_ELEVATION_BIAS} from "./elevation_constants";
import EXTENT from "../../src/style-spec/data/extent";
import Point from "@mapbox/point-geometry";
import {number as interpolate} from '../../src/style-spec/util/interpolate';
import {mulberry32} from '../../src/style-spec/util/random';

// Module-level scratch: instance fields would be dropped by Object.create across the worker boundary.
const scratchVec2 = [vec2.create(), vec2.create(), vec2.create(), vec2.create(), vec2.create(), vec2.create(), vec2.create()];
// Separate scratch pair — getClosestEdge may run during the merge.
const _mergeSafeMin = vec2.create();
const _mergeSafeMax = vec2.create();

import type {VectorTileLayer} from "@mapbox/vector-tile";
import type {CanonicalTileID} from "../../src/source/tile_id";
import type {Bounds} from "../../src/style-spec/util/geometry_util";
import type {Transferable} from '../../src/types/transferable';

type SerializedPoint = {x: number; y: number};
type SerializedSafeArea = {min: SerializedPoint; max: SerializedPoint};
type SerializedVec2Pair = [number, number];

type SerializedElevationFeature = {
    id: number;
    constantHeight?: number;
    heightRange: Range;
    safeArea: SerializedSafeArea;
    vertices?: Array<{position: SerializedVec2Pair; height: number; extent: number; index?: number}>;
    vertexProps?: Array<{dir: SerializedVec2Pair}>;
    edges?: Array<Edge>;
    edgeProps?: Array<{vec: SerializedVec2Pair; dir: SerializedVec2Pair; len: number}>;
};

function vec2ToPair(v: vec2): SerializedVec2Pair {
    return [v[0], v[1]];
}

function pairToVec2(p: SerializedVec2Pair): vec2 {
    return vec2.fromValues(p[0], p[1]);
}

function safeAreaToPayload(safeArea: Bounds): SerializedSafeArea {
    return {
        min: {x: safeArea.min.x, y: safeArea.min.y},
        max: {x: safeArea.max.x, y: safeArea.max.y},
    };
}

function safeAreaFromPayload(safeArea: SerializedSafeArea): Bounds {
    return {
        min: new Point(safeArea.min.x, safeArea.min.y),
        max: new Point(safeArea.max.x, safeArea.max.y),
    };
}

export interface Vertex {
    position: vec2;
    height: number;
    extent: number;
    index?: number;
}

export interface Edge {
    a: number;
    b: number;
}

interface VertexProps {
    dir: vec2;
}

interface EdgeProps {
    vec: vec2;      // a -> b
    dir: vec2;      // norm(vec)
    len: number;    // magnitude(vec)
}

export interface Range {
    min: number;
    max: number;
}

// Hard-coded depth after which roads are rendered as tunnels
const TUNNEL_THRESHOLD_METERS = 5.0;

export class EdgeIterator {

    feature: ElevationFeature;
    metersToTile: number;
    sampler: ElevationFeatureSampler | null;
    index: number;

    constructor(feature: ElevationFeature, metersToTile: number, sampler: ElevationFeatureSampler | null = null) {
        this.feature = feature;
        this.metersToTile = metersToTile;
        this.sampler = sampler;
        this.index = 0;
    }

    get(): [Point, Point] {
        assert(this.index < this.feature.vertices.length);

        const vertex = this.feature.vertices[this.index];
        const dir = this.feature.vertexProps[this.index].dir;

        // Compute perpendicular split line
        const perpX = dir[1];
        const perpY = -dir[0];
        const dist = (vertex.extent + 1) * this.metersToTile;
        const position = this.sampler ? this.sampler.pointTransform(vertex.position) : vertex.position;

        const a = new Point(Math.trunc(position[0] + perpX * dist), Math.trunc(position[1] + perpY * dist));
        const b = new Point(Math.trunc(position[0] - perpX * dist), Math.trunc(position[1] - perpY * dist));

        return [a, b];
    }

    next(): void {
        this.index++;
    }

    valid(): boolean {
        return this.index < this.feature.vertices.length;
    }
}

// ElevationFeature describes a three dimensional linestring that acts as a "skeleton"
// for guiding elevation other features such as lines an polygons attached to it. Its
// extended api supports elevation and slope normal queries at close proximity to it.
export class ElevationFeature {
    id: number;
    constantHeight: number | undefined;
    heightRange: Range;
    safeArea: Bounds;
    vertices = new Array<Vertex>();
    vertexProps = new Array<VertexProps>();
    edges = new Array<Edge>();
    edgeProps = new Array<EdgeProps>();

    constructor(id: number, safeArea: Bounds, constantHeight?: number, vertices?: Vertex[], edges?: Edge[], metersToTile?: number) {
        // Ensure that if constantHeight is not provided then vertices, edges, and metersToTile must be provided
        assert(constantHeight == null ? vertices != null && edges != null && metersToTile != null : true);
        this.id = id;
        this.heightRange = {min: constantHeight, max: constantHeight};
        this.safeArea = safeArea;
        this.constantHeight = constantHeight;

        if (this.constantHeight != null || (this.constantHeight == null && vertices.length === 0)) return;

        this.vertices = vertices;
        this.edges = edges;
        for (let i = 0; i < this.vertices.length; i++) {
            this.vertices[i].index = this.vertices[i].index !== undefined ? this.vertices[i].index : i;
        }

        // Check that edges are valid
        this.edges = this.edges.filter(edge => edge.a < this.vertices.length &&
            edge.b < this.vertices.length &&
            !vec2.exactEquals(this.vertices[edge.a].position, this.vertices[edge.b].position)
        );

        this.heightRange = {min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY};
        for (const vertex of this.vertices) {
            this.vertexProps.push({dir: vec2.fromValues(0, 0)});

            this.heightRange.min = Math.min(this.heightRange.min, vertex.height);
            this.heightRange.max = Math.max(this.heightRange.max, vertex.height);
        }

        for (const edge of this.edges) {
            const a = this.vertices[edge.a].position;
            const b = this.vertices[edge.b].position;

            const vec = vec2.subtract(vec2.create(), b, a);
            const len = vec2.length(vec);
            const dir = vec2.scale(vec2.create(), vec, 1.0 / len);

            this.edgeProps.push({vec, dir, len});

            const dirA = this.vertexProps[edge.a].dir;
            const dirB = this.vertexProps[edge.b].dir;

            // Accumulate direction vectors for vertices
            vec2.add(dirA, dirA, dir);
            vec2.add(dirB, dirB, dir);
        }

        for (const props of this.vertexProps) {
            if (props.dir[0] !== 0.0 || props.dir[1] !== 0.0) {
                vec2.normalize(props.dir, props.dir);
            }
        }

        // Perform additional tessellation step where edges are split into two
        // if they would generate geometry that deviates too much from a planar surface.
        // This is done to reduce z-clipping with between stackable polygons.
        this.tessellate(metersToTile);
    }

    // Sample point at the provided location
    pointElevation(point: Point): number {
        if (this.constantHeight != null) {
            return this.constantHeight;
        }

        const closestEdge = this.getClosestEdge(point);

        if (closestEdge == null) {
            return 0.0;
        }

        const [idx, t] = closestEdge;
        const aIdx = this.edges[idx].a;
        const bIdx = this.edges[idx].b;

        return interpolate(this.vertices[aIdx].height, this.vertices[bIdx].height, t);
    }

    computeSlopeNormal(point: Point, metersToTile: number): vec3 {
        const closestEdge = this.getClosestEdge(point);

        if (!closestEdge) return vec3.fromValues(0, 0, 1);

        const edgeIdx = closestEdge[0];
        const edge = this.edges[edgeIdx];
        const a = this.vertices[edge.a];
        const b = this.vertices[edge.b];

        const vec = this.edgeProps[edgeIdx].vec;
        const edgeVec = vec3.fromValues(vec[0], vec[1], (b.height - a.height) * metersToTile);
        const norm = vec3.fromValues(edgeVec[1], -edgeVec[0], 0.0);
        vec3.cross(norm, norm, edgeVec);
        const len = vec3.length(norm);

        return len > 0.0 ? vec3.scale(norm, norm, 1.0 / len) : vec3.set(norm, 0, 0, 1);
    }

    // Safe area describes original tile boundaries of the elevation curve scaled to the current zoom level.
    // This is useful in cases where e.g. a continuous bridge that's been initially split into adjacent tiles,
    // and hence into two different elevation features, is cojoined into one on a lower zoom level tile.
    getSafeArea() {
        return this.safeArea;
    }

    // Returns true whether this elevation feature describes a tunnel
    isTunnel() {
        return this.heightRange.max <= -TUNNEL_THRESHOLD_METERS;
    }

    private getClosestEdge(point: Point): [number, number] | undefined {
        if (this.edges.length === 0) {
            return undefined;
        }

        let closestIdx = 0;
        let closestDist = Number.POSITIVE_INFINITY;
        let closestT = 0.0;

        const [pa, pb, papb, paPoint, aPoint, perpDir, pointVec] = scratchVec2;

        vec2.set(pointVec, point.x, point.y);
        // The ray direction will be updated for each iteration of the loop.
        const ray = new Ray2D(pointVec, null);

        for (let i = 0; i < this.edges.length; i++) {
            const edge = this.edges[i];
            const edgeDir = this.edgeProps[i].dir;
            ray.dir = edgeDir;

            // Both end points of the edge have "direction" property which is the average direction
            // of the connected edges. For this reason a simplified quadrilateral interpolation is required.
            const a = this.vertices[edge.a].position;
            const b = this.vertices[edge.b].position;

            const paResult = ray.intersectsPlane(a, this.vertexProps[edge.a].dir, pa);
            const pbResult = ray.intersectsPlane(b, this.vertexProps[edge.b].dir, pb);

            if (!paResult || !pbResult) {
                continue;
            }

            vec2.subtract(papb, pb, pa);
            vec2.subtract(paPoint, pointVec, pa);
            const papbLen = vec2.dot(papb, papb);
            const t = papbLen > 0 ? vec2.dot(paPoint, papb) / papbLen : 0.0;
            const clampedT = clamp(t, 0.0, 1.0);

            // Use manhattan distance instead of euclidean one in order to distinguish the correct line.
            const distAlongLine = Math.abs((t - clampedT) * this.edgeProps[i].len);
            vec2.subtract(aPoint, pointVec, a);
            vec2.set(perpDir, edgeDir[1], -edgeDir[0]);
            const perpDist = Math.abs(vec2.dot(aPoint, perpDir));
            const dist = distAlongLine + perpDist;

            if (dist < closestDist) {
                closestIdx = i;
                closestDist = dist;
                closestT = clampedT;
            }
        }

        return [closestIdx, closestT];
    }

    private tessellate(metersToTile: number): void {
        // Treshold value in meters after which an edge is split into two.
        const splitDistanceThreshold = MARKUP_ELEVATION_BIAS;

        const aPos = vec3.create();
        const bPos = vec3.create();
        const aPerp = vec3.create();
        const bPerp = vec3.create();

        for (let i = this.edges.length - 1; i >= 0; --i) {
            const a = this.edges[i].a;
            const b = this.edges[i].b;

            // Try to approximate how much the surface generated by perpendicular vectors at both edge end points
            // deviates from a planar surface. This is done by computing the closest distance between the two
            // diagonal (i.e. shared) edges of a quad.
            //
            // This step is required to reduce z-fighting/z-clipping when using the elevation feature to compute
            // elevation for multiple geometries (with different topology) stacked on top of each other
            const {position: aTilePos, height: aHeight, extent: aExtent} = this.vertices[a];
            const {position: bTilePos, height: bHeight, extent: bExtent} = this.vertices[b];
            const aDir = this.vertexProps[a].dir;
            const bDir = this.vertexProps[b].dir;

            vec3.set(aPos, aTilePos[0] / metersToTile, aTilePos[1] / metersToTile, aHeight);
            vec3.set(bPos, bTilePos[0] / metersToTile, bTilePos[1] / metersToTile, bHeight);
            vec3.set(aPerp, aDir[1], -aDir[0], 0.0);
            vec3.scale(aPerp, aPerp, aExtent);
            vec3.set(bPerp, bDir[1], -bDir[0], 0.0);
            vec3.scale(bPerp, bPerp, bExtent);

            const lineDistSq = this.distSqLines(
                vec3.fromValues(aPos[0] + 0.5 * aPerp[0], aPos[1] + 0.5 * aPerp[1], aPos[2] + 0.5 * aPerp[2]),
                vec3.fromValues(bPos[0] - 0.5 * bPerp[0], bPos[1] - 0.5 * bPerp[1], bPos[2] - 0.5 * bPerp[2]),
                vec3.fromValues(aPos[0] - 0.5 * aPerp[0], aPos[1] - 0.5 * aPerp[1], aPos[2] - 0.5 * aPerp[2]),
                vec3.fromValues(bPos[0] + 0.5 * bPerp[0], bPos[1] + 0.5 * bPerp[1], bPos[2] + 0.5 * bPerp[2])
            );

            if (lineDistSq <= splitDistanceThreshold * splitDistanceThreshold) {
                continue;
            }

            const mid = this.vertices.length;

            const pos = vec2.add(vec2.create(), aTilePos, bTilePos);
            this.vertices.push({
                position: vec2.scale(pos, pos, 0.5),
                height: 0.5 * (aHeight + bHeight),
                extent: 0.5 * (aExtent + bExtent),
                index: 0.5 * ((this.vertices[a].index !== undefined ? this.vertices[a].index : a) + (this.vertices[b].index !== undefined ? this.vertices[b].index : b)),
            });

            const dir = vec2.add(vec2.create(), aDir, bDir);
            this.vertexProps.push({dir: vec2.normalize(dir, dir)});

            this.edges.splice(i, 1);
            this.edgeProps.splice(i, 1);

            this.edges.push({a, b: mid});
            this.edges.push({a: mid, b});

            const edgeVec = vec2.subtract(vec2.create(), this.vertices[mid].position, aTilePos);
            const edgeLen = vec2.length(edgeVec);
            const edgeDir = vec2.scale(vec2.create(), edgeVec, 1.0 / edgeLen);
            const props: EdgeProps = {
                vec: edgeVec,
                dir: edgeDir,
                len: edgeLen
            };

            this.edgeProps.push(props);
            this.edgeProps.push(props);

            assert(this.edgeProps.length === this.edges.length);
            assert(this.vertexProps.length === this.vertices.length);
            assert(this.edges.every(e => e.a < this.vertices.length && e.b < this.vertices.length));
        }
    }

    private distSqLines(aStart: vec3, aEnd: vec3, bStart: vec3, bEnd: vec3): number {
        const aVec = vec3.subtract(vec3.create(), aEnd, aStart);
        const bVec = vec3.subtract(vec3.create(), bEnd, bStart);
        const abVec = vec3.subtract(vec3.create(), aStart, bStart);

        const a = vec3.dot(aVec, aVec);
        const b = vec3.dot(aVec, bVec);
        const c = vec3.dot(aVec, abVec);
        const d = vec3.dot(bVec, bVec);
        const e = vec3.dot(bVec, abVec);

        const det = a * d - b * b;
        if (det === 0.0) {
            // parallel lines
            const t = vec3.dot(abVec, bVec) / vec3.dot(bVec, bVec);
            const vec = vec3.lerp(aVec, bStart, bEnd, t);
            return vec3.squaredDistance(vec, aStart);
        }

        const s = (b * e - c * d) / det;
        const t = (a * e - b * c) / det;

        const vecA = vec3.lerp(aVec, aStart, aEnd, s);
        const vecB = vec3.lerp(bVec, bStart, bEnd, t);
        return vec3.squaredDistance(vecA, vecB);
    }

    /// Encode as plain number pairs — structured-clone would detach the Float32Array backing buffers.
    static serialize(feature: ElevationFeature, _transferables?: Set<Transferable>): SerializedElevationFeature {
        const payload: SerializedElevationFeature = {
            id: feature.id,
            heightRange: {min: feature.heightRange.min, max: feature.heightRange.max},
            safeArea: safeAreaToPayload(feature.safeArea),
        };

        if (feature.constantHeight != null) {
            payload.constantHeight = feature.constantHeight;
            return payload;
        }

        if (feature.vertices.length === 0) {
            payload.vertices = [];
            payload.vertexProps = [];
            payload.edges = [];
            payload.edgeProps = [];
            return payload;
        }

        payload.vertices = feature.vertices.map((vertex) => ({
            position: vec2ToPair(vertex.position),
            height: vertex.height,
            extent: vertex.extent,
            index: vertex.index,
        }));
        payload.vertexProps = feature.vertexProps.map((props) => ({dir: vec2ToPair(props.dir)}));
        payload.edges = feature.edges.map((edge) => ({a: edge.a, b: edge.b}));
        payload.edgeProps = feature.edgeProps.map((props) => ({
            vec: vec2ToPair(props.vec),
            dir: vec2ToPair(props.dir),
            len: props.len,
        }));
        return payload;
    }

    static deserialize(input: SerializedElevationFeature): ElevationFeature {
        const safeArea = safeAreaFromPayload(input.safeArea);

        if (input.constantHeight != null) {
            return new ElevationFeature(input.id, safeArea, input.constantHeight);
        }

        if (!input.vertices || input.vertices.length === 0) {
            const empty = Object.create(ElevationFeature.prototype) as ElevationFeature;
            empty.id = input.id;
            empty.constantHeight = undefined;
            empty.heightRange = {min: input.heightRange.min, max: input.heightRange.max};
            empty.safeArea = safeArea;
            empty.vertices = [];
            empty.vertexProps = [];
            empty.edges = [];
            empty.edgeProps = [];
            return empty;
        }

        const copy = Object.create(ElevationFeature.prototype) as ElevationFeature;
        copy.id = input.id;
        copy.constantHeight = undefined;
        copy.heightRange = {min: input.heightRange.min, max: input.heightRange.max};
        copy.safeArea = safeArea;
        copy.vertices = input.vertices.map((vertex) => ({
            position: pairToVec2(vertex.position),
            height: vertex.height,
            extent: vertex.extent,
            index: vertex.index,
        }));
        // Optional arrays: degrade to [] when absent (same as edges / edgeProps below).
        copy.vertexProps = (input.vertexProps || []).map((props) => ({dir: pairToVec2(props.dir)}));
        copy.edges = (input.edges || []).map((edge) => ({a: edge.a, b: edge.b}));
        copy.edgeProps = (input.edgeProps || []).map((props) => ({
            vec: pairToVec2(props.vec),
            dir: pairToVec2(props.dir),
            len: props.len,
        }));
        return copy;
    }
}

export abstract class ElevationFeatures {

    static parseFrom(data: VectorTileLayer, tileID: CanonicalTileID): ElevationFeature[] {
        const parsedFeatures = ElevationFeatureParser.parse(data);

        if (!parsedFeatures) {
            return [];
        }

        let {vertices, features} = parsedFeatures;

        const metersToTile = 1.0 / tileToMeter(tileID);

        features.sort((a, b) => a.id - b.id);

        vertices.sort((a, b) => a.id - b.id || a.idx - b.idx);

        vertices = vertices.filter((value, index, self) => index === self.findIndex((t) => (
            t.id === value.id && t.idx === value.idx
        ))
        );

        const elevationFeatures = new Array<ElevationFeature>();

        let vCurrent = 0;
        const vEnd = vertices.length;

        for (const feature of features) {
            if (feature.constantHeight) {
                elevationFeatures.push(new ElevationFeature(feature.id, feature.bounds, feature.constantHeight));
                continue;
            }

            // Match vertex range [vCurrent, vEnd) for this feature
            while (vCurrent !== vEnd && vertices[vCurrent].id < feature.id) {
                vCurrent++;
            }

            if (vCurrent === vEnd || vertices[vCurrent].id !== feature.id) {
                continue;
            }

            const outVertices = new Array<Vertex>();
            const outEdges = new Array<Edge>();

            // Extract edges with adjacent index values
            const vFirst = vCurrent;

            while (vCurrent !== vEnd && vertices[vCurrent].id === feature.id) {
                const vertex = vertices[vCurrent];
                outVertices.push({position: vertex.position, height: vertex.height, extent: vertex.extent, index: vertex.idx});

                if (vCurrent !== vFirst && vertices[vCurrent - 1].idx === vertex.idx - 1) {
                    const idx = vCurrent - vFirst;
                    outEdges.push({a: idx - 1, b: idx});
                }

                vCurrent++;
            }

            elevationFeatures.push(new ElevationFeature(
                feature.id, feature.bounds, undefined, outVertices, outEdges, metersToTile
            ));
        }

        // Ensure that features are sorted by id
        assert(elevationFeatures.every((feature, index, array) => index === 0 || array[index - 1].id <= feature.id));

        return elevationFeatures;
    }

}

export class ElevationFeatureSampler {
    zScale: number;
    xOffset: number;
    yOffset: number;

    constructor(sampleTileId: CanonicalTileID, elevationTileId: CanonicalTileID) {
        this.zScale = 1.0;
        this.xOffset = 0.0;
        this.yOffset = 0.0;

        if (sampleTileId.equals(elevationTileId)) return;

        this.zScale = Math.pow(2.0, elevationTileId.z - sampleTileId.z);
        this.xOffset = (sampleTileId.x * this.zScale - elevationTileId.x) * EXTENT;
        this.yOffset = (sampleTileId.y * this.zScale - elevationTileId.y) * EXTENT;
    }

    pointTransform(point: vec2): vec2 {
        return vec2.fromValues(point[0] * this.zScale + this.xOffset, point[1] * this.zScale + this.yOffset);
    }

    pointTransformInPlace(v: vec2): void {
        v[0] = v[0] * this.zScale + this.xOffset;
        v[1] = v[1] * this.zScale + this.yOffset;
    }

    constantElevation(elevation: ElevationFeature, bias: number): number | undefined {
        if (elevation.constantHeight == null) return undefined;

        return this.computeBiasedHeight(elevation.constantHeight, bias);
    }

    pointElevation(point: Point, elevation: ElevationFeature, bias: number): number {
        const constantHeight = this.constantElevation(elevation, bias);
        if (constantHeight != null) {
            return constantHeight;
        }

        point.x = point.x * this.zScale + this.xOffset;
        point.y = point.y * this.zScale + this.yOffset;

        return this.computeBiasedHeight(elevation.pointElevation(point), bias);
    }

    private computeBiasedHeight(height: number, bias: number): number {
        if (bias <= 0.0) return height;

        const stepHeight = height >= 0.0 ? height : Math.abs(0.5 * height);
        return height + bias * smoothstep(0.0, bias, stepHeight);
    }
}

/// Merge elevation parts from multiple provider tiles into one curve in
/// `consumerTileId` space. Each part only covers its own tile's slice —
/// without merging, points outside that slice sample as ground (z=0).
///
/// `parts` must all share the same feature id and be non-empty. Higher-zoom parts take
/// priority when deduplicating vertices by curve index.
export function mergeElevationFeatures(consumerTileId: CanonicalTileID, parts: {tileId: CanonicalTileID, feature: ElevationFeature}[]): ElevationFeature {
    assert(parts.length > 0);

    // Higher zoom level first so that duplicate curve indices keep the finer vertex.
    const sorted = parts.slice().sort((a, b) => b.tileId.z - a.tileId.z);

    const min = new Point(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    const max = new Point(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
    const mergedVertices: Vertex[] = [];

    for (const part of sorted) {
        const sampler = new ElevationFeatureSampler(part.tileId, consumerTileId);
        for (const vertex of part.feature.vertices) {
            mergedVertices.push({
                position: sampler.pointTransform(vertex.position),
                height: vertex.height,
                extent: vertex.extent,
                index: vertex.index,
            });
        }

        const safeArea = part.feature.safeArea;
        _mergeSafeMin[0] = safeArea.min.x; _mergeSafeMin[1] = safeArea.min.y;
        _mergeSafeMax[0] = safeArea.max.x; _mergeSafeMax[1] = safeArea.max.y;
        sampler.pointTransformInPlace(_mergeSafeMin);
        sampler.pointTransformInPlace(_mergeSafeMax);
        min.x = Math.min(min.x, _mergeSafeMin[0], _mergeSafeMax[0]);
        min.y = Math.min(min.y, _mergeSafeMin[1], _mergeSafeMax[1]);
        max.x = Math.max(max.x, _mergeSafeMin[0], _mergeSafeMax[0]);
        max.y = Math.max(max.y, _mergeSafeMin[1], _mergeSafeMax[1]);
    }

    const bounds: Bounds = {min, max};

    if (sorted[0].feature.constantHeight != null) {
        return new ElevationFeature(sorted[0].feature.id, bounds, sorted[0].feature.constantHeight);
    }

    // Sort by curve index, drop duplicates (first = highest zoom from the sort above).
    mergedVertices.sort((a, b) => a.index - b.index);
    const deduped: Vertex[] = [];
    for (const vertex of mergedVertices) {
        if (deduped.length === 0 || deduped.at(-1).index !== vertex.index) {
            deduped.push(vertex);
        }
    }

    // Connect consecutive vertices whose curve indices are adjacent (gaps mark separate spans).
    const edges: Edge[] = [];
    for (let i = 1; i < deduped.length; i++) {
        if (deduped[i].index - deduped[i - 1].index <= 1.0) {
            edges.push({a: i - 1, b: i});
        }
    }

    const metersToTile = 1.0 / tileToMeter(consumerTileId);
    return new ElevationFeature(sorted[0].feature.id, bounds, undefined, deduped, edges, metersToTile);
}

register(ElevationFeature, 'ElevationFeature');

export function elevationIdDebugColor(id: number): [number, number, number] {
    if (id === 0) return [0, 0, 0];
    const rng = mulberry32(id);
    return [rng(), rng(), rng()];
}
