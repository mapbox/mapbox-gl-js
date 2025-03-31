import {describe, test, expect} from '../../util/vitest';
import {ElevationPortalGraph} from '../../../3d-style/elevation/elevation_graph';
import Point from '@mapbox/point-geometry';
import {ElevatedStructures} from '../../../3d-style/elevation/elevated_structures';
import {CanonicalTileID} from '../../../src/source/tile_id';
import {vec2} from 'gl-matrix';
import {ElevationFeature, type Vertex, type Edge} from '../../../3d-style/elevation/elevation_feature';

import type {Bounds} from '../../../3d-style/elevation/elevation_feature_parser';

describe('ElevatedStructures', () => {
    test('#getUnevaluatedPortals', () => {
        // Entry & exit ramps and a tunnel section
        const leftRamp: Point[][] = [
            [new Point(1, 1), new Point(3, 1), new Point(3, 4), new Point(1, 4), new Point(1, 1)]
        ];

        const middleRamp: Point[][] = [
            [new Point(3, 1), new Point(6, 1), new Point(6, 4), new Point(3, 4), new Point(3, 1)],
            [new Point(4, 2), new Point(4, 3), new Point(5, 3), new Point(5, 2), new Point(4, 2)]
        ];

        const rightRamp: Point[][] = [
            [new Point(6, 1), new Point(8, 1), new Point(8, 4), new Point(6, 4), new Point(6, 1)]
        ];

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
        const structures = new ElevatedStructures(new CanonicalTileID(0, 0, 0));

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
            ElevatedStructures.computeEdgeHash(new Point(20000, 20000), new Point(0, 0)),
            ElevatedStructures.computeEdgeHash(new Point(0, 0), new Point(12345, -1000)),
            ElevatedStructures.computeEdgeHash(new Point(8000, 7654), new Point(-500, 1024)),
            ElevatedStructures.computeEdgeHash(new Point(1456, -435), new Point(2048, 1024)),
        ];

        const expected = [
            0n,
            1310740000n,
            3475085767502462976n,
            18306010983925030374n,
            410107172890870784n,
        ];

        expect(hashes).toMatchObject(expected);
    });
});
