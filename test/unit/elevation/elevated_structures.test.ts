import {describe, test, expect} from '../../util/vitest';
import {ElevationPortalGraph} from '../../../3d-style/elevation/elevation_graph';
import Point from '@mapbox/point-geometry';
import {ElevatedStructures} from '../../../3d-style/elevation/elevated_structures';
import {CanonicalTileID} from '../../../src/source/tile_id';
import {vec2} from 'gl-matrix';
import {ElevationFeature, type Vertex, type Edge} from '../../../3d-style/elevation/elevation_feature';

import type {Bounds} from '../../../src/style-spec/util/geometry_util';

describe('ElevatedStructures', () => {
    test('#getUnevaluatedPortals', () => {
        // Entry & exit ramps and a tunnel section
        const leftRamp: Point[][][] = [[
            [new Point(1, 1), new Point(3, 1), new Point(3, 4), new Point(1, 4), new Point(1, 1)]
        ]];

        const middleRamp: Point[][][] = [[
            [new Point(3, 1), new Point(6, 1), new Point(6, 4), new Point(3, 4), new Point(3, 1)],
            [new Point(4, 2), new Point(4, 3), new Point(5, 3), new Point(5, 2), new Point(4, 2)]
        ]];

        const rightRamp: Point[][][] = [[
            [new Point(6, 1), new Point(8, 1), new Point(8, 4), new Point(6, 4), new Point(6, 1)]
        ]];

        // Mock elevation feature
        const vertices: Vertex[] = [
            {position: vec2.fromValues(1, 2), height: 0, extent: 1},
            {position: vec2.fromValues(3, 2), height: -1, extent: 1},
            {position: vec2.fromValues(6, 2), height: -1, extent: 1},
            {position: vec2.fromValues(8, 2), height: 0, extent: 1},
        ];

        const edges: Edge[] = [
            {a: 0, b: 1}, {a: 1, b: 2}, {a: 2, b: 3}
        ];

        const bounds: Bounds = {min: new Point(1, 1), max: new Point(8, 4)};

        const feature = new ElevationFeature(0, bounds, undefined, vertices, edges, 1.0);

        // Compute portals
        const structures = new ElevatedStructures(new CanonicalTileID(0, 0, 0), [], 0, null);

        structures.addPortalCandidates(0, leftRamp, false, feature, 0);
        structures.addPortalCandidates(1, middleRamp, true, feature, 0);
        structures.addPortalCandidates(2, rightRamp, false, feature, 0);

        const uneval = structures.unevaluatedPortals;
        const portals = uneval.portals;

        // Each edge of exterior rings are expected be portal candidates
        expect(portals.length).toBe(12);

        let entrances = portals.filter(p => p.type === 'entrance');
        let unevaluated = portals.filter(p => p.type === 'unevaluated');

        expect(entrances.length).toBe(2);
        expect(unevaluated.length).toBe(10);

        // Evaluate portals
        const evaluated = ElevationPortalGraph.evaluate([uneval]).portals;

        expect(evaluated.length).toBe(4);

        entrances = evaluated.filter(p => p.type === 'entrance');
        unevaluated = evaluated.filter(p => p.type === 'unevaluated');
        const tunnels = evaluated.filter(p => p.type === 'tunnel');

        expect(entrances.length).toBe(2);
        expect(unevaluated.length).toBe(0);
        expect(tunnels.length).toBe(2);
    });

    test('#computeEdgeHash', () => {
        const hashes = [
            ElevatedStructures.computeEdgeHash(new Point(0, 0), new Point(0, 0)),
            ElevatedStructures.computeEdgeHash(new Point(8193, 8193), new Point(-1, -1)),
            ElevatedStructures.computeEdgeHash(new Point(0, 0), new Point(4096, 8193)),
            ElevatedStructures.computeEdgeHash(new Point(4096, 8193), new Point(0, 0)),
            ElevatedStructures.computeEdgeHash(new Point(8000, 7654), new Point(-1, 1024)),
            ElevatedStructures.computeEdgeHash(new Point(1456.7, -0.5), new Point(2048, 1024)),
        ];

        const expected = [
            550427181096,
            67158024,
            550460756009,
            550460756009,
            68902551475,
            801874558465455,
        ];

        expect(hashes).toMatchObject(expected);
    });
});
