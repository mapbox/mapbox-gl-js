import {vec2, vec3} from "gl-matrix";
import {register} from '../../src/util/web_worker_transfer';
import assert from 'assert';
import {ElevationFeatureParser, type Bounds} from "./elevation_feature_parser";
import {tileToMeter} from "../../src/geo/mercator_coordinate";
import {Ray2D} from "../../src/util/primitives";
import {clamp, smoothstep} from "../../src/util/util";
import {MARKUP_ELEVATION_BIAS} from "./elevation_constants";
import EXTENT from "../../src/style-spec/data/extent";

import type {VectorTileLayer} from "@mapbox/vector-tile";
import type {CanonicalTileID} from "../../src/source/tile_id";
import type Point from "@mapbox/point-geometry";

export interface Vertex {
    position: vec2;
    height: number;
    extent: number;
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

        // Check that edges are valid
        this.edges = this.edges.filter(edge =>
            edge.a < this.vertices.length &&
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

        const lerp = (x: number, y: number, t: number) => { return (1 - t) * x + t * y; };
        return lerp(this.vertices[aIdx].height, this.vertices[bIdx].height, t);
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

        const pointVec = vec2.fromValues(point.x, point.y);

        for (let i = 0; i < this.edges.length; i++) {
            const edge = this.edges[i];
            const edgeDir = this.edgeProps[i].dir;
            const ray = new Ray2D(pointVec, this.edgeProps[i].dir);

            // Both end points of the edge have "direction" property which is the average direction
            // of the connected edges. For this reason a simplified quadrilateral interpolation is required.
            const a = this.vertices[edge.a].position;
            const b = this.vertices[edge.b].position;

            const pa = vec2.create();
            const pb = vec2.create();
            const paResult = ray.intersectsPlane(a, this.vertexProps[edge.a].dir, pa);
            const pbResult = ray.intersectsPlane(b, this.vertexProps[edge.b].dir, pb);

            if (!paResult || !pbResult) {
                continue;
            }

            const papb = vec2.subtract(vec2.create(), pb, pa);
            const paPoint = vec2.subtract(vec2.create(), pointVec, pa);
            const papbLen = vec2.dot(papb, papb);
            const t = papbLen > 0 ? vec2.dot(paPoint, papb) / papbLen : 0.0;
            const clampedT = clamp(t, 0.0, 1.0);

            // Use manhattan distance instead of euclidean one in order to distinguish the correct line.
            const distAlongLine = Math.abs((t - clampedT) * this.edgeProps[i].len);
            const aPoint = vec2.subtract(vec2.create(), pointVec, a);
            const perpDist = Math.abs(vec2.dot(aPoint, vec2.fromValues(edgeDir[1], -edgeDir[0])));
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

            const aPos = vec3.fromValues(aTilePos[0] / metersToTile, aTilePos[1] / metersToTile, aHeight);
            const bPos = vec3.fromValues(bTilePos[0] / metersToTile, bTilePos[1] / metersToTile, bHeight);
            const aPerp = vec3.fromValues(aDir[1], -aDir[0], 0.0);
            vec3.scale(aPerp, aPerp, aExtent);
            const bPerp = vec3.fromValues(bDir[1], -bDir[0], 0.0);
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
            const vec = vec3.lerp(vec3.create(), bStart, bEnd, t);
            return vec3.squaredDistance(vec, aStart);
        }

        const s = (b * e - c * d) / det;
        const t = (a * e - b * c) / det;

        const vecA = vec3.lerp(vec3.create(), aStart, aEnd, s);
        const vecB = vec3.lerp(vec3.create(), bStart, bEnd, t);
        return vec3.squaredDistance(vecA, vecB);
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

        vertices = vertices.filter((value, index, self) =>
            index === self.findIndex((t) => (
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
                outVertices.push({position: vertex.position, height: vertex.height, extent: vertex.extent});

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
        assert(elevationFeatures.every((feature, index, array) =>
            index === 0 || array[index - 1].id <= feature.id
        ));

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

register(ElevationFeature, 'ElevationFeature');
