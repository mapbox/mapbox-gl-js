import {vec2} from "gl-matrix";
import {ElevatedStructures} from "../../../3d-style/elevation/elevated_structures";

import type Point from "@mapbox/point-geometry";
import type {ElevationPortalConnection, ElevationPortalEdge, ElevationPortalType} from "../../../3d-style/elevation/elevation_graph";

export type Edge = [Point, Point];

export function toUnevaluatedEdge(connection: ElevationPortalConnection, a: Point, b: Point, isTunnel: boolean, type: ElevationPortalType): ElevationPortalEdge {
    const vab = vec2.fromValues(b.x - a.x, b.y - a.y);
    const hash = ElevatedStructures.computeEdgeHash(a, b);

    return {connection, va: a, vb: b, vab, length: vec2.len(vab), hash, isTunnel, type};
}

export function polygonToUnevaluatedEdges(id: number, isTunnel: boolean, polygon: Point[][], entrances: Edge[]) {
    const result: ElevationPortalEdge[] = [];

    const entranceHashes = new Set<bigint>();
    for (const entrance of entrances) {
        entranceHashes.add(ElevatedStructures.computeEdgeHash(entrance[0], entrance[1]));
    }

    for (const ring of polygon) {
        for (let i = 0; i < ring.length - 1; i++) {
            const a = ring[i + 0];
            const b = ring[i + 1];
            const hash = ElevatedStructures.computeEdgeHash(a, b);
            const type: ElevationPortalType = entranceHashes.has(hash) ? 'entrance' : 'unevaluated';
            result.push(toUnevaluatedEdge({a: id, b: undefined}, a, b, isTunnel, type));
        }
    }

    return result;
}
