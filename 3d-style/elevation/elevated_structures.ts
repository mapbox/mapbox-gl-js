import assert from 'assert';
import Point from "@mapbox/point-geometry";
import {ElevationPolygons, ElevationPortalGraph, type ElevationPortalEdge, type ElevationPortalType, type LeveledPolygon} from "./elevation_graph";
import {vec2, vec3} from "gl-matrix";
import {tileToMeter} from '../../src/geo/mercator_coordinate';
import EXTENT from '../../src/style-spec/data/extent';
import {edgeIntersectsBox} from '../../src/util/intersection_tests';
import {FillIntersectionsLayoutArray, FillIntersectionsNormalLayoutArray, TriangleIndexArray} from '../../src/data/array_types';
import {intersectionNormalAttributes, intersectionsAttributes} from '../../src/data/bucket/fill_attributes';
import SegmentVector from '../../src/data/segment';
import {number as lerp} from '../../src/style-spec/util/interpolate';
import {ProgramConfigurationSet} from '../../src/data/program_configuration';

import type VertexBuffer from '../../src/gl/vertex_buffer';
import type IndexBuffer from '../../src/gl/index_buffer';
import type {CanonicalTileID} from '../../src/source/tile_id';
import type {ElevationFeature, Range} from './elevation_feature';
import type {Segment} from '../../src/data/segment';
import type Context from '../../src/gl/context';
import type FillStyleLayer from '../../src/style/style_layer/fill_style_layer';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {ImageId} from '../../src/style-spec/expression/types/image_id';
import type {LUT} from '../../src/util/lut';
import type {FeatureStates} from '../../src/source/source_state';
import type {SpritePositions} from '../../src/util/image';
import type {TypedStyleLayer} from '../../src/style/style_layer/typed_style_layer';
import type {Bounds} from '../../src/style-spec/util/geometry_util';

const TUNNEL_ENTERANCE_HEIGHT = 4.0; // meters

interface ElevatedPoint {
    coord: Point;
    height: number;
}

interface VertexConnection {
    from?: number;
    to?: number;
}

export interface FeatureInfo {
    guardRailEnabled: boolean;
    featureIndex: number;
}
interface Edge {
    polygonIdx: number;
    a: number;
    b: number;
    hash: bigint;
    portalHash: bigint;
    isTunnel: boolean;
    type: ElevationPortalType;
    // Track the information of the geometryfeature that the edge is originated from,
    // used for later populate the vertex vectors of the paint property binders
    featureInfo: FeatureInfo;
}

interface VertexEdgeHashes {
    prev: bigint;
    next: bigint;
}

export interface FeatureSection {
    featureIndex: number;
    vertexStart: number;
}

class MeshBuilder {
    private outPositions: FillIntersectionsLayoutArray;
    private outNormals: FillIntersectionsNormalLayoutArray;
    private outIndices: TriangleIndexArray;
    private vertexLookup: Map<bigint, number>;
    private buffer: ArrayBuffer;
    private view: DataView;

    constructor(vertices: FillIntersectionsLayoutArray, normals: FillIntersectionsNormalLayoutArray, indices: TriangleIndexArray) {
        this.outPositions = vertices;
        this.outNormals = normals;
        this.outIndices = indices;
        this.vertexLookup = new Map();
        this.buffer = new ArrayBuffer(4);
        this.view = new DataView(this.buffer);
    }

    addVertex(vertex: vec3, normal: vec3, tileToMeter?: number): number {
        let height = vertex[2];
        if (tileToMeter != null) {
            height *= tileToMeter;
        }

        const lookup = (this.getVec3Bits(vertex) << 96n) | this.getVec3Bits(normal);
        const result = this.vertexLookup.get(lookup);
        if (result != null) {
            return result;
        }

        const offset = this.outPositions.length;
        this.vertexLookup.set(lookup, offset);

        const normX = Math.trunc(normal[0] * (1 << 14));
        const normY = Math.trunc(normal[1] * (1 << 14));
        const normZ = Math.trunc(normal[2] * (1 << 14));

        this.outPositions.emplaceBack(vertex[0], vertex[1], height);
        this.outNormals.emplaceBack(normX, normY, normZ);

        return offset;
    }

    addVertices(normal: vec3, tileToMeters?: number, ...positions: vec3[]): number[] {
        const offsets: number[] = [];
        for (const v of positions) {
            const offset = this.addVertex(v, normal, tileToMeters);
            offsets.push(offset);
        }
        assert(offsets.length === positions.length);
        return offsets;
    }

    addTriangles(indices: number[], vertices?: Point[], heights?: number[]) {
        assert(indices.length % 3 === 0);
        if (vertices && heights) {
            // For constant height, heights array length is 1
            assert(vertices.length === heights.length || heights.length === 1);
            const constantHeight = heights.length === 1;

            const normal = vec3.fromValues(0, 0, 0);
            for (let i = 0; i < indices.length; i += 3) {
                const v0 = vertices[indices[i + 0]];
                const v1 = vertices[indices[i + 1]];
                const v2 = vertices[indices[i + 2]];
                const h0 = constantHeight ? heights[0] : heights[indices[i + 0]];
                const h1 = constantHeight ? heights[0] : heights[indices[i + 1]];
                const h2 = constantHeight ? heights[0] : heights[indices[i + 2]];
                const i0 = this.addVertex(vec3.fromValues(v0.x, v0.y, h0), normal);
                const i1 = this.addVertex(vec3.fromValues(v1.x, v1.y, h1), normal);
                const i2 = this.addVertex(vec3.fromValues(v2.x, v2.y, h2), normal);
                this.outIndices.emplaceBack(i0, i1, i2);
            }
        } else {
            assert(indices.every(i => i < this.outPositions.length));
            for (let i = 0; i < indices.length; i += 3) {
                this.outIndices.emplaceBack(
                    indices[i + 0],
                    indices[i + 1],
                    indices[i + 2]
                );
            }
        }
    }

    addQuad(vertices: ElevatedPoint[], normal: vec3) {
        assert(vertices.length === 4);
        const indices = this.addVertices(normal, undefined, ...vertices.map(v => vec3.fromValues(v.coord.x, v.coord.y, v.height)));
        const [a, b, c, d] = indices;
        this.addTriangles([a, b, c, c, d, a]);
    }

    getVertexCount(): number {
        return this.outPositions.length;
    }

    clearVertexLookup(): void {
        this.vertexLookup.clear();
    }

    private getBits(val: number): bigint {
        this.view.setFloat32(0, val);
        return BigInt(this.view.getUint32(0));
    }

    private getVec3Bits(vec: vec3): bigint {
        const b0 = this.getBits(vec[0]);
        const b1 = this.getBits(vec[1]);
        const b2 = this.getBits(vec[2]);

        return (b0 << 64n) | (b1 << 32n) | b2;
    }
}

export class ElevatedStructures {
    vertexBuffer: VertexBuffer | undefined;
    vertexBufferNormal: VertexBuffer | undefined;
    indexBuffer: IndexBuffer | undefined;

    maskSegments: SegmentVector | undefined;
    depthSegments: SegmentVector | undefined;
    renderableBridgeSegments: SegmentVector | undefined;
    renderableTunnelSegments: SegmentVector | undefined;
    shadowCasterSegments: SegmentVector | undefined;

    unevaluatedPortals = new ElevationPortalGraph();
    portalPolygons = new ElevationPolygons();

    // Tracks the rail/tunnel mesh same-feature vertex sections
    // (within ElevatedStructure::vertexPositions).
    // To be used for later populating the PaintPropertyBinder vertex vector
    bridgeFeatureSections: FeatureSection[] = [];
    tunnelFeatureSections: FeatureSection[] = [];

    bridgeProgramConfigurations: ProgramConfigurationSet<FillStyleLayer>;
    tunnelProgramConfigurations: ProgramConfigurationSet<FillStyleLayer>;

    private vertexHashLookup: Map<number, VertexEdgeHashes> = new Map();

    private unevalVertices: Point[] = [];
    private unevalHeights: number[] = [];
    private unevalTriangles: number[] = [];
    private unevalTunnelTriangles: number[] = [];
    private unevalEdges: Edge[] = [];

    private tileToMeters: number;

    private vertexPositions = new FillIntersectionsLayoutArray();
    private vertexNormals = new FillIntersectionsNormalLayoutArray();
    private indexArray = new TriangleIndexArray();

    constructor(tileID: CanonicalTileID, layers: FillStyleLayer[], zoom: number, lut: LUT | null) {
        this.tileToMeters = tileToMeter(tileID);
        this.bridgeProgramConfigurations = new ProgramConfigurationSet(layers, {zoom, lut}, (name: string) => name !== 'fill-tunnel-structure-color');
        this.tunnelProgramConfigurations = new ProgramConfigurationSet(layers, {zoom, lut}, (name: string) => name !== 'fill-bridge-guard-rail-color');
    }

    addVertices(vertices: Point[], heights: number[]): number {
        assert(this.unevalVertices.length === this.unevalHeights.length);
        assert(vertices.length > 0 && vertices.length === heights.length);

        const offset = this.unevalVertices.length;

        for (let i = 0; i < vertices.length; i++) {
            this.unevalVertices.push(vertices[i]);
            this.unevalHeights.push(heights[i]);
        }

        return offset;
    }

    addTriangles(indices: number[], offset: number, isTunnel: boolean) {
        assert(indices.length > 0);
        assert(offset >= 0);

        // Separate triangles into tunnels and non-tunnels
        const outTriangles = isTunnel ? this.unevalTunnelTriangles : this.unevalTriangles;

        for (const i of indices) {
            const idx = i + offset;
            assert(idx < this.unevalVertices.length);

            outTriangles.push(idx);
        }
    }

    addRenderableRing(polygonIdx: number, vertexOffset: number, count: number, isTunnel: boolean, area: Bounds, featureInfo: FeatureInfo) {
        assert(vertexOffset + count <= this.unevalVertices.length);

        const corners = [
            new Point(area.min.x, area.min.y),
            new Point(area.max.x, area.min.y),
            new Point(area.max.x, area.max.y),
            new Point(area.min.x, area.max.y)
        ];

        for (let i = 0; i < count - 1; i++) {
            const ai = vertexOffset + i;
            const bi = ai + 1;

            // Both vertices must be inside the provided area bounds
            const va = this.unevalVertices[ai];
            const vb = this.unevalVertices[bi];

            // Check if either of the points is inside
            const insideBounds =
                (va.x >= area.min.x && va.x <= area.max.x && va.y >= area.min.y && va.y <= area.max.y) ||
                (vb.x >= area.min.x && vb.x <= area.max.x && vb.y >= area.min.y && vb.y <= area.max.y);

            if (!insideBounds && !edgeIntersectsBox(va, vb, corners)) {
                continue;
            }

            if (this.isOnBorder(va.x, vb.x) || this.isOnBorder(va.y, vb.y)) {
                continue;
            }

            // Compute two unique hashes for the edge: "edgeHash" to represent the renderable geometry and
            // "portalHash" which represents the original edge this one originated from. The latter is required
            // as the feature geometry might be split into smaller segments before being used for rendering.
            const edgeHash = ElevatedStructures.computeEdgeHash(this.unevalVertices[ai], this.unevalVertices[bi]);
            let portalHash: bigint;

            let lookup = this.vertexHashLookup.get(ElevatedStructures.computePosHash(va));
            if (lookup != null) {
                portalHash = lookup.next;
            } else {
                lookup = this.vertexHashLookup.get(ElevatedStructures.computePosHash(vb));
                portalHash = lookup != null ? lookup.prev : edgeHash;
            }

            this.unevalEdges.push({polygonIdx, a: ai, b: bi, hash: edgeHash, portalHash, isTunnel, type: 'unevaluated', featureInfo});
        }
    }

    addPortalCandidates(id: number, polygon: Point[][], isTunnel: boolean, elevation: ElevationFeature, zLevel: number) {
        if (polygon.length === 0) return;

        const leveledPoly: LeveledPolygon = {geometry: polygon, zLevel};
        this.portalPolygons.add(id, leveledPoly);

        const pointsEqual = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

        // Each edge of the exterior ring is a potential portal
        const exterior = polygon[0];
        assert(exterior.length > 1 && pointsEqual(exterior[0], exterior[exterior.length - 1]));

        this.vertexHashLookup.clear();

        let prevEdgeHash = ElevatedStructures.computeEdgeHash(exterior[exterior.length - 2], exterior[exterior.length - 1]);

        for (let i = 0; i < exterior.length - 1; i++) {
            const a = exterior[i + 0];
            const b = exterior[i + 1];

            const vavb = vec2.fromValues(b.x - a.x, b.y - a.y);
            const length = vec2.length(vavb);

            if (length === 0) continue;

            let type: ElevationPortalType = 'unevaluated';

            // "Entrance" portals are entry & exit points for the polygons
            // from ground level
            const ha = elevation.pointElevation(a);
            const hb = elevation.pointElevation(b);
            const onGround = Math.abs(ha) < 0.01 && Math.abs(hb) < 0.01;

            if (onGround) {
                type = 'entrance';
            } else {
                // Portals on tile borders describes connectivity between tiles
                if (this.isOnBorder(a.x, b.x) || this.isOnBorder(a.y, b.y)) {
                    type = 'border';
                }
            }

            const edgeHash = ElevatedStructures.computeEdgeHash(a, b);
            this.unevaluatedPortals.portals.push({
                connection: {a: id, b: undefined}, va: a, vb: b, vab: vavb, length, hash: edgeHash, isTunnel, type
            });

            // Construct a lookup table where vertex position maps to hashes of edges it's connected to
            const posHash = ElevatedStructures.computePosHash(a);

            assert(!this.vertexHashLookup.has(posHash));
            this.vertexHashLookup.set(posHash, {prev: prevEdgeHash, next: edgeHash});

            prevEdgeHash = edgeHash;
        }
    }

    construct(evaluatedPortals: ElevationPortalGraph) {
        if (this.unevalVertices.length === 0) return;

        // Construct multi-purpose geometry for elevated rendering. This includes:
        //  1. Renderable geometry of 3D structures such as road banks and bridge guard rails
        //  2. All elevated triangles (including roads as well) for rebuilding depth buffer.
        //  3. "mask" triangles used to carve holes to the depth buffer in order to render underground roads.
        //
        // The main idea is to store everything (3D structures and road polygons) as a single mesh and sort
        // triangles into adjacent segments in memory that are renderable separately.
        //
        //                    memory: [---bridge_structures---|---tunnel_structures---|---non_tunnel_roads---|---tunnel_roads---|---tunnel_roofs---]
        //              mask segment:                         [----------------------------------------------]
        // bridge renderable segment: [----------------------]
        // tunnel renderable segment:                         [----------------------]
        //             depth segment: [-----------------------------------------------------------------------------------------]
        //     shadow caster segment: [------------------------------------------------------------------------------------------------------------]
        assert(this.vertexPositions.length === 0 && this.vertexNormals.length === 0 && this.indexArray.length === 0);

        const beginSegment = () => ({vertexOffset: 0, primitiveOffset: this.indexArray.length} as Segment);
        const endSegment = (segment: Segment) => { segment.primitiveLength = this.indexArray.length - segment.primitiveOffset; };

        const builder = new MeshBuilder(this.vertexPositions, this.vertexNormals, this.indexArray);

        // Prune and cleanup edges that should not receive additional geometry.
        this.prepareEdges(evaluatedPortals.portals, this.unevalEdges);

        const shadowCasterSegment = beginSegment();
        const depthSegment = beginSegment();
        const renderableBridgeSegment = beginSegment();

        const partition = (edges: Edge[], type: ElevationPortalType): number => {
            edges.sort((a, b) => {
                if (a.type === type && b.type !== type) return -1;
                else if (a.type !== type && b.type === type) return 1;
                return 0;
            });
            const idx = edges.findIndex(e => e.type !== type);
            return idx >= 0 ? idx : edges.length;
        };

        let wallEndIdx = 0;
        if (this.unevalEdges.length > 0) {
            wallEndIdx = partition(this.unevalEdges, 'none');
            assert(wallEndIdx >= 0);

            this.constructBridgeStructures(
                builder, this.unevalVertices, this.unevalHeights, this.unevalEdges, {min: 0, max: wallEndIdx}, this.tileToMeters);
        }

        endSegment(renderableBridgeSegment);
        const renderableTunnelSegment = beginSegment();
        const maskSegment = beginSegment();

        if (this.unevalEdges.length > 0) {
            const afterWallEnd = this.unevalEdges.splice(wallEndIdx);
            const tunnelEndIdx = partition(afterWallEnd, 'tunnel') + wallEndIdx;
            this.unevalEdges.push(...afterWallEnd);
            assert(wallEndIdx <= tunnelEndIdx && tunnelEndIdx >= 0 && tunnelEndIdx <= this.unevalEdges.length);

            this.constructTunnelStructures(
                builder, this.unevalVertices, this.unevalHeights, this.unevalEdges, {min: 0, max: wallEndIdx}, {min: wallEndIdx, max: tunnelEndIdx});
        }

        endSegment(renderableTunnelSegment);

        // Generate triangles for non-tunnel roads
        builder.addTriangles(this.unevalTriangles, this.unevalVertices, this.unevalHeights);
        endSegment(maskSegment);

        // Generate triangles for tunnel roads
        builder.addTriangles(this.unevalTunnelTriangles, this.unevalVertices, this.unevalHeights);
        endSegment(depthSegment);

        // Include tunnel roofs as shadow casters
        builder.addTriangles(this.unevalTunnelTriangles, this.unevalVertices, [-0.1]);
        endSegment(shadowCasterSegment);

        this.maskSegments = SegmentVector.simpleSegment(0, maskSegment.primitiveOffset, 0, maskSegment.primitiveLength);
        this.depthSegments = SegmentVector.simpleSegment(0, depthSegment.primitiveOffset, 0, depthSegment.primitiveLength);
        this.renderableBridgeSegments = SegmentVector.simpleSegment(0, renderableBridgeSegment.primitiveOffset, 0, renderableBridgeSegment.primitiveLength);
        this.renderableTunnelSegments = SegmentVector.simpleSegment(0, renderableTunnelSegment.primitiveOffset, 0, renderableTunnelSegment.primitiveLength);
        this.shadowCasterSegments = SegmentVector.simpleSegment(0, shadowCasterSegment.primitiveOffset, 0, shadowCasterSegment.primitiveLength);

        assert(this.vertexPositions.length === this.vertexNormals.length);
    }

    update(states: FeatureStates, vtLayer: VectorTileLayer, availableImages: ImageId[], imagePositions: SpritePositions, layers: ReadonlyArray<TypedStyleLayer>, isBrightnessChanged: boolean, brightness?: number | null, worldview?: string) {
        this.bridgeProgramConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness, worldview);
        this.tunnelProgramConfigurations.updatePaintArrays(states, vtLayer, layers, availableImages, imagePositions, isBrightnessChanged, brightness, worldview);
    }

    upload(context: Context) {
        if (this.vertexBuffer || this.vertexPositions.length === 0 || this.vertexNormals.length === 0 || this.indexArray.length === 0) {
            return;
        }

        this.vertexBuffer = context.createVertexBuffer(this.vertexPositions, intersectionsAttributes.members);
        this.vertexBufferNormal = context.createVertexBuffer(this.vertexNormals, intersectionNormalAttributes.members);
        this.indexBuffer = context.createIndexBuffer(this.indexArray);

        this.bridgeProgramConfigurations.upload(context);
        this.tunnelProgramConfigurations.upload(context);
    }

    destroy() {
        if (this.vertexBuffer) {
            this.vertexBuffer.destroy();
            this.vertexBufferNormal.destroy();
            this.indexBuffer.destroy();
        }

        if (this.maskSegments) {
            this.maskSegments.destroy();
            this.depthSegments.destroy();
            this.renderableBridgeSegments.destroy();
            this.renderableTunnelSegments.destroy();
            this.shadowCasterSegments.destroy();
        }

        this.bridgeProgramConfigurations.destroy();
        this.tunnelProgramConfigurations.destroy();
    }

    populatePaintArrays(vtLayer: VectorTileLayer, canonical: CanonicalTileID, availableImages: ImageId[], brightness: number, worldview: string | undefined) {
        const populate = (programConfigurations: ProgramConfigurationSet<FillStyleLayer>, sections: FeatureSection[]) => {
            for (let i = 0; i < sections.length - 1; i++) {
                const featureIndex = sections[i].featureIndex;
                const length = sections[i + 1].vertexStart;
                assert(Number.isFinite(featureIndex));

                const feature = vtLayer.feature(featureIndex);
                assert(feature);

                programConfigurations.populatePaintArrays(length, feature, featureIndex, {}, availableImages, canonical, brightness, undefined, worldview);
            }
        };

        populate(this.bridgeProgramConfigurations, this.bridgeFeatureSections);
        populate(this.tunnelProgramConfigurations, this.tunnelFeatureSections);
    }

    private computeVertexConnections(vertices: Point[], heights: number[], edges: Edge[], startEdge: number, endEdge: number): Map<number, VertexConnection> {
        assert(endEdge <= edges.length);
        const map = new Map<number, VertexConnection>();

        for (let i = startEdge; i < endEdge; i++) {
            const edge = edges[i];
            // a = from, b = to
            const a = edge.a;
            const b = edge.b;

            const aHash = ElevatedStructures.computePosHash(vertices[a]);
            const bHash = ElevatedStructures.computePosHash(vertices[b]);

            // Ensure the vertex connections exist in the map
            if (!map.has(aHash)) {
                map.set(aHash, {});
            }
            if (!map.has(bHash)) {
                map.set(bHash, {});
            }

            const pA = map.get(aHash);
            const pB = map.get(bHash);

            // Do not create connectivity to edges that are not supposed
            // to have guard rail geometry
            if (heights[a] <= 0.0 && heights[b] <= 0.0) {
                continue;
            }

            pA.to = b;
            pB.from = a;
        }

        return map;
    }

    private constructBridgeStructures(builder: MeshBuilder, vertices: Point[], heights: number[], edges: Edge[], edgeRange: Range, tileToMeters: number) {
        builder.clearVertexLookup();
        // Compute connectivity graph for vertices in order to find
        // forward and normal vectors for the geometry
        const vertexConnectivity = this.computeVertexConnections(vertices, heights, edges, edgeRange.min, edgeRange.max);

        const metersToTile = 1.0 / tileToMeters;
        const scale = 0.5 * metersToTile;

        const toTileVec = (vIdx: number) => vec3.fromValues(vertices[vIdx].x, vertices[vIdx].y, heights[vIdx] * metersToTile);

        const computeFwd = (vIdx: number): vec3 | undefined => {
            // Use connectivity information to compute the vertex normal vector
            const connectivity = vertexConnectivity.get(ElevatedStructures.computePosHash(vertices[vIdx]));
            assert(connectivity);

            const from = connectivity.from;
            const to = connectivity.to;

            if (!from || !to) return undefined;

            const fromVec = toTileVec(from);
            const midVec = toTileVec(vIdx);
            const toVec = toTileVec(to);

            const fwd = vec3.fromValues(0, 0, 0);

            if (!vec3.exactEquals(fromVec, midVec)) {
                const sub = vec3.sub(vec3.create(), midVec, fromVec);
                vec3.add(fwd, fwd, vec3.normalize(sub, sub));
            }

            if (!vec3.exactEquals(toVec, midVec)) {
                const sub = vec3.sub(vec3.create(), toVec, midVec);
                vec3.add(fwd, fwd, vec3.normalize(sub, sub));
            }

            const len = vec3.len(fwd);

            return len > 0.0 ? vec3.scale(fwd, fwd, 1.0 / len) : undefined;
        };

        let lastFeatureIndex = Number.POSITIVE_INFINITY;

        // Sort the edges according to the feature index, since this makes less fragmentation of vertex binder
        // and facilitates more reusing of vertices during mesh construction.
        this.sortSubarray<Edge>(edges, edgeRange.min, edgeRange.max, (a: Edge, b: Edge) => a.featureInfo.featureIndex - b.featureInfo.featureIndex);

        // Generate bridge "guard rails"
        for (let i = edgeRange.min; i < edgeRange.max; i++) {
            const edge = edges[i];
            if (!edge.featureInfo.guardRailEnabled) continue;

            const bridgeEdge = this.prepareEdgePoints(vertices, heights, edge, (a, b) => a > b);

            if (bridgeEdge == null) continue;

            const pa = bridgeEdge[0];
            const pb = bridgeEdge[1];

            const va = vec3.fromValues(pa.coord.x, pa.coord.y, metersToTile * pa.height);
            const vb = vec3.fromValues(pb.coord.x, pb.coord.y, metersToTile * pb.height);

            if (vec3.exactEquals(va, vb)) continue;

            const dir = vec3.sub(vec3.create(), vb, va);
            vec3.normalize(dir, dir);

            // Compute "coordinate frame", i.e. cross section of the bridge mesh at both points.
            // These sections are the connected with triangles.
            const normalize = (v: vec3) => vec3.normalize(v, v);
            const aFwd = computeFwd(edge.a) || dir;
            const bFwd = computeFwd(edge.b) || dir;
            const aLeft = normalize(vec3.fromValues(aFwd[1], -aFwd[0], 0.0));
            const bLeft = normalize(vec3.fromValues(bFwd[1], -bFwd[0], 0.0));
            const aUp = normalize(vec3.cross(vec3.create(), aLeft, aFwd));
            const bUp = normalize(vec3.cross(vec3.create(), bLeft, bFwd));

            // Use metric units for the size in order to have zoom independent sizes.
            // Construct "outer", "top" and "inner" sides of the guard rails
            const tmpVec = vec3.create();
            const aVertices: vec3[] = [
                vec3.add(vec3.create(), va, vec3.scale(tmpVec, vec3.sub(tmpVec, aLeft, aUp), scale)),
                vec3.add(vec3.create(), va, vec3.scale(tmpVec, vec3.add(tmpVec, aLeft, aUp), scale)),
                vec3.add(vec3.create(), va, vec3.scale(tmpVec, aUp, scale)),
                va
            ];
            const bVertices: vec3[] = [
                vec3.add(vec3.create(), vb, vec3.scale(tmpVec, vec3.sub(tmpVec, bLeft, bUp), scale)),
                vec3.add(vec3.create(), vb, vec3.scale(tmpVec, vec3.add(tmpVec, bLeft, bUp), scale)),
                vec3.add(vec3.create(), vb, vec3.scale(tmpVec, bUp, scale)),
                vb
            ];

            lastFeatureIndex = this.addFeatureSection(edge.featureInfo.featureIndex, lastFeatureIndex, this.bridgeFeatureSections, builder);

            // Outer side
            const [ao0, ao1] = builder.addVertices(aLeft, tileToMeters, aVertices[0], aVertices[1]);
            const [bo0, bo1] = builder.addVertices(bLeft, tileToMeters, bVertices[0], bVertices[1]);

            builder.addTriangles([ao0, ao1, bo0, ao1, bo1, bo0]);

            // Top side
            const [at0, at1] = builder.addVertices(aUp, tileToMeters, aVertices[1], aVertices[2]);
            const [bt0, bt1] = builder.addVertices(bUp, tileToMeters, bVertices[1], bVertices[2]);

            builder.addTriangles([at0, at1, bt0, at1, bt1, bt0]);

            // Inner side
            const [ai0, ai1] = builder.addVertices(vec3.negate(aLeft, aLeft), tileToMeters, aVertices[2], aVertices[3]);
            const [bi0, bi1] = builder.addVertices(vec3.negate(bLeft, bLeft), tileToMeters, bVertices[2], bVertices[3]);

            builder.addTriangles([ai0, ai1, bi0, ai1, bi1, bi0]);
        }

        this.bridgeFeatureSections.push({featureIndex: Number.POSITIVE_INFINITY, vertexStart: builder.getVertexCount()});

        assert(this.bridgeFeatureSections.every((sec, i) => {
            return i === 0 || this.bridgeFeatureSections[i - 1].vertexStart <= sec.vertexStart;
        }));
    }

    private constructTunnelStructures(builder: MeshBuilder, vertices: Point[], heights: number[], edges: Edge[], wallRange: Range, entranceRange: Range) {
        builder.clearVertexLookup();
        const tunnelEntranceHeight = TUNNEL_ENTERANCE_HEIGHT;
        let lastFeatureIndex = Number.POSITIVE_INFINITY;

        // Sort the edges according to the feature index, since this makes less fragmentation of vertex binder
        // and facilitates more reusing of vertices during mesh construction.
        const sortFn = (a: Edge, b: Edge) => a.featureInfo.featureIndex - b.featureInfo.featureIndex;
        this.sortSubarray<Edge>(edges, wallRange.min, wallRange.max, sortFn);
        this.sortSubarray<Edge>(edges, entranceRange.min, entranceRange.max, sortFn);

        const normalize = (v: vec3) => vec3.normalize(v, v);
        // Generate underground walls
        for (let i = wallRange.min; i < wallRange.max; i++) {
            const tunnelEdge = this.prepareEdgePoints(vertices, heights, edges[i], (a, b) => a < b);

            if (tunnelEdge == null) continue;

            const [a, b] = tunnelEdge;
            // For tunnel walls, the normal dir points to the inside of the road polygon (left dir points to outside of the
            // road polygon)
            const norm = normalize(vec3.fromValues(-(b.coord.y - a.coord.y), b.coord.x - a.coord.x, 0.0));

            lastFeatureIndex = this.addFeatureSection(edges[i].featureInfo.featureIndex, lastFeatureIndex, this.tunnelFeatureSections, builder);

            builder.addQuad([
                a,
                b,
                {coord: b.coord, height: edges[i].isTunnel ? -0.1 : 0.0},
                {coord: a.coord, height: edges[i].isTunnel ? -0.1 : 0.0}
            ], norm);
        }

        // Generate tunnel enterances
        for (let i = entranceRange.min; i < entranceRange.max; i++) {
            const edge = edges[i];

            // If the edge is tunnel, it is an edge of tunnel polygon, invert to get the overlapped edge of non-tunnel
            // polygon
            if (edge.isTunnel) {
                [edge.a, edge.b] = [edge.b, edge.a];
            }

            const a = vertices[edge.a];
            const b = vertices[edge.b];
            // For tunnel walls, the normal dir points to the inside of the road polygon (left dir points to outside of the
            // road polygon)
            const norm = normalize(vec3.fromValues(-(b.y - a.y), b.x - a.x, 0.0));

            lastFeatureIndex = this.addFeatureSection(edge.featureInfo.featureIndex, lastFeatureIndex, this.tunnelFeatureSections, builder);

            // 2 quads == double sided
            builder.addQuad([
                {coord: b, height: 0.0},
                {coord: a, height: 0.0},
                {coord: a, height: heights[edge.a] + tunnelEntranceHeight},
                {coord: b, height: heights[edge.b] + tunnelEntranceHeight}
            ], norm);

            builder.addQuad([
                {coord: a, height: 0.0},
                {coord: b, height: 0.0},
                {coord: b, height: heights[edge.b] + tunnelEntranceHeight},
                {coord: a, height: heights[edge.a] + tunnelEntranceHeight}
            ], norm);
        }

        this.tunnelFeatureSections.push({featureIndex: Number.POSITIVE_INFINITY, vertexStart: builder.getVertexCount()});

        assert(this.tunnelFeatureSections.every((sec, i) => {
            return i === 0 || this.tunnelFeatureSections[i - 1].vertexStart <= sec.vertexStart;
        }));
    }

    private prepareEdgePoints(vertices: Point[], heights: number[], edge: Edge, comp: (a: number, b: number) => boolean): [ElevatedPoint, ElevatedPoint] | undefined {
        // Prepare the edge by accepting only the segment that
        // passes the comparison function. In practice either the part above or below ground.
        let ha = heights[edge.a];
        let hb = heights[edge.b];
        const aPass = comp(ha, 0.0);
        const bPass = comp(hb, 0.0);

        if (aPass && bPass) {
            return [{coord: vertices[edge.a], height: ha}, {coord: vertices[edge.b], height: hb}];
        } else if (!aPass && !bPass) {
            return undefined;
        }

        const va = vertices[edge.a].clone();
        const vb = vertices[edge.b].clone();

        // Interpolate the line so that both points passes the comparison function
        if (!aPass) {
            const t = ha / (ha - hb);
            va.x = lerp(va.x, vb.x, t);
            va.y = lerp(va.y, vb.y, t);
            ha = lerp(ha, hb, t);
        } else if (!bPass) {
            const t = hb / (hb - ha);
            vb.x = lerp(vb.x, va.x, t);
            vb.y = lerp(vb.y, va.y, t);
            hb = lerp(hb, ha, t);
        }

        return [{coord: va, height: ha}, {coord: vb, height: hb}];
    }

    private prepareEdges(portals: ElevationPortalEdge[], edges: Edge[]) {
        // Preserve edges that meet one of the following criteria:
        //  1. Non-shared road edges that should receive additional geometry such as guard rails.
        //  2. Shared edges presenting portals between adjacent polygons.
        if (edges.length === 0) return;

        edges.sort((a: Edge, b: Edge) => a.hash === b.hash ? b.polygonIdx - a.polygonIdx : b.hash > a.hash ? 1 : -1);

        let begin = 0;
        let end = 0;
        let out = 0;
        let polygonIdx = edges[begin].polygonIdx;

        // Prune edges that do not meet any of the aforementioned criteria.
        do {
            end++;

            if (end === edges.length  || edges[begin].hash !== edges[end].hash) {
                const occurrences = end - begin;
                const differentOwner = edges[end - 1].polygonIdx !== polygonIdx;

                if (occurrences === 1 || differentOwner) {
                    if (out < begin) {
                        edges[out] = edges[begin];
                        edges[begin] = null;
                    }

                    edges[out].type = 'none';
                    out++;
                }

                begin = end;

                if (begin !== edges.length) {
                    polygonIdx = edges[begin].polygonIdx;
                }
            }
        } while (begin !== edges.length);

        edges.splice(out);
        assert(edges.every(e => e != null));

        // Determine which surviving edges are portals and which are just regular road edges.
        // This is done by comparing them against portals in the globally built portal graph that contains
        // polygon connectivity information across different layers.
        if (edges.length !== 0 && portals.length !== 0) {
            assert(portals.every((portal, index) => {
                return index === 0 || portals[index - 1].hash >= portal.hash;
            }));

            edges.sort((a, b) => a.portalHash < b.portalHash ? 1 : -1);

            let eIndex = 0;
            let pIndex = 0;

            while (eIndex !== edges.length && pIndex !== portals.length) {
                const edge = edges[eIndex];
                const portal = portals[pIndex];
                if (edge.portalHash > portal.hash) {
                    eIndex++;
                } else if (portal.hash > edge.portalHash) {
                    pIndex++;
                } else {
                    edge.type = portal.type;
                    eIndex++;
                }
            }
        }
    }

    private isOnBorder(a: number, b: number): boolean {
        return (a <= 0 && b <= 0) || (a >= EXTENT && b >= EXTENT);
    }

    private addFeatureSection(featureIndex: number, lastFeatureIndex: number, sections: FeatureSection[], builder: MeshBuilder): number {
        if (featureIndex !== lastFeatureIndex) {
            lastFeatureIndex = featureIndex;
            sections.push({featureIndex, vertexStart: builder.getVertexCount()});
            builder.clearVertexLookup();
        }

        return lastFeatureIndex;
    }

    private sortSubarray<T>(array: Array<T>, start: number, end: number, fn: (a: T, b: T) => number) {
        const sub = array.slice(start, end);
        sub.sort(fn);
        array.splice(start, sub.length, ...sub);
    }

    static computeEdgeHash(pa: Point, pb: Point): bigint {
        if ((pa.y === pb.y && pa.x > pb.x) || pa.y > pb.y) {
            [pa, pb] = [pb, pa];
        }

        const aHash = BigInt(ElevatedStructures.computePosHash(pa));
        const bHash = BigInt(ElevatedStructures.computePosHash(pb));

        return (aHash << 32n) | bHash;
    }

    private static computePosHash(p: Point): number {
        const x = p.x & 0xFFFF;
        const y = p.y & 0xFFFF;
        return ((x << 16) | y) >>> 0;
    }
}
