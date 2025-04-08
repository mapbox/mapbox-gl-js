import {register} from '../../src/util/web_worker_transfer';
import assert from 'assert';
import EXTENT from '../../src/style-spec/data/extent';

import type Point from "@mapbox/point-geometry";
import type {vec2} from "gl-matrix";

export type ElevationPortalType = 'unevaluated' | 'none' | 'tunnel' | 'polygon' | 'entrance' | 'border';

export interface ElevationPortalConnection {
    a: number | undefined;
    b: number | undefined;
}

export interface ElevationPortalEdge {
    connection: ElevationPortalConnection;  // connected edge indices
    va: Point;                              // vertex a
    vb: Point;                              // vertex b
    vab: vec2;                              // b - a
    length: number;
    // the same as edge hash (order independent two endpoints coordinates hash)
    hash: bigint;
    isTunnel: boolean;
    type: ElevationPortalType;
}

export type LeveledPolygon = {
    geometry: Point[][];
    zLevel: number;
}

export class ElevationPolygons {
    polygons: Map<number, Array<LeveledPolygon>> = new Map();

    add(key: number, ...values: LeveledPolygon[]) {
        if (!this.polygons.has(key)) {
            this.polygons.set(key, values);
        } else {
            this.polygons.get(key).push(...values);
        }
    }

    merge(elevationPolygons: ElevationPolygons) {
        for (const [key, value] of elevationPolygons.polygons) {
            this.add(key, ...value);
        }
    }
}

export class ElevationPortalGraph {
    portals: ElevationPortalEdge[] = [];

    // Constructs a single graph by combining portals of multiple graphs
    static evaluate(unevaluatedPortals: ElevationPortalGraph[]): ElevationPortalGraph {
        if (unevaluatedPortals.length === 0) return new ElevationPortalGraph();

        let portals: ElevationPortalEdge[] = [];

        // Copy all unevaluted portals into a single vector and evaluate the final graph structure
        for (const unevalGraph of unevaluatedPortals) {
            portals.push(...unevalGraph.portals);
        }

        if (portals.length === 0) return new ElevationPortalGraph();

        // Find the final set of portals. An unevaluated portal is consider a final one if:
        //  a) it is result of the border clip operation
        //  b) it is on the ground acting as an "entrance" to the polygon
        //  c) it belongs to multiple polygons
        const isOnBorder = (a: number, b: number) => (a <= 0 && b <= 0) || (a >= EXTENT && b >= EXTENT);

        // Tag all border portals
        for (const portal of portals) {
            const a = portal.va;
            const b = portal.vb;

            if (isOnBorder(a.x, b.x) || isOnBorder(a.y, b.y)) {
                portal.type = 'border';
            }
        }

        const evaluatedGroup = portals.filter(p => p.type !== 'unevaluated');
        const unevaluatedGroup = portals.filter(p => p.type === 'unevaluated');

        if (unevaluatedGroup.length === 0) return new ElevationPortalGraph();

        unevaluatedGroup.sort((a, b) => a.hash === b.hash ? (a.isTunnel === b.isTunnel ? 0 : a.isTunnel ? -1 : 1) : a.hash < b.hash ? 1 : -1);
        portals = evaluatedGroup.concat(unevaluatedGroup);

        // Tag all portals between polygons
        let begin = evaluatedGroup.length;
        let end = begin;
        let out = begin;
        assert(begin < portals.length);

        do {
            end++;

            if (end === portals.length || portals[begin].hash !== portals[end].hash) {
                assert(end - begin <= 2);

                if (end - begin === 2) {
                    // This edge is shared by two polygons and a portal should be created.
                    // (More than two shared edges is undefined behavior.)
                    if (out < begin) {
                        portals[out] = portals[begin];
                        portals[begin] = null;
                    }

                    const outPortal = portals[out];
                    const endPortal = portals[end - 1];

                    outPortal.type = outPortal.isTunnel !== endPortal.isTunnel ? 'tunnel' : 'polygon';
                    outPortal.connection = {a: outPortal.connection.a, b: endPortal.connection.a};

                    out++;
                }

                begin = end;
            }
        } while (begin !== portals.length);

        portals.splice(out);

        // Partitions are no longer required and all surviving portals can be sorted by their spatial hash
        portals.sort((a, b) => a.hash < b.hash ? 1 : -1);

        assert(portals.every(p => p.type !== 'unevaluated'));

        return {portals};
    }
}

register(ElevationPortalGraph, 'ElevationPortalGraph');
register(ElevationPolygons, "ElevationPolygons");
