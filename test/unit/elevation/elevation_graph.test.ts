import {describe, test, expect} from '../../util/vitest';
import {ElevationPortalGraph, type ElevationPortalEdge} from '../../../3d-style/elevation/elevation_graph';
import {polygonToUnevaluatedEdges, toUnevaluatedEdge, type Edge} from './elevation_util';
import Point from '@mapbox/point-geometry';

describe('ElevationGraph', () => {
    test('#evaluate', () => {
        const polygons: Point[][][] = [
            [
                [new Point(2, 2), new Point(5, 2), new Point(4, 4), new Point(2, 4), new Point(2, 2)]
            ],
            [
                [new Point(5, 2), new Point(7, 4), new Point(6, 6), new Point(4, 4), new Point(5, 2)]
            ],
            [
                [new Point(7, 4), new Point(8, 3), new Point(10, 3), new Point(11, 4), new Point(11, 6), new Point(10, 7), new Point(8, 7), new Point(7, 6), new Point(6, 6), new Point(7, 4)],
                [new Point(8, 4), new Point(8, 6), new Point(10, 6), new Point(10, 4), new Point(8, 4)]
            ],
            [
                [new Point(11, 4), new Point(13, 4), new Point(13, 6), new Point(11, 6), new Point(11, 4)]
            ],
            [
                [new Point(8, 7), new Point(10, 7), new Point(10, 9), new Point(8, 9), new Point(8, 7)]
            ],
            [
                [new Point(8, 4), new Point(9, 4), new Point(9, 6), new Point(8, 6), new Point(8, 4)]
            ]
        ];

        const entrances: Edge[] = [
            [new Point(2, 4), new Point(2, 2)],
            [new Point(13, 4), new Point(13, 6)],
            [new Point(8, 9), new Point(10, 9)],
            [new Point(9, 4), new Point(9, 6)]
        ];

        const unevaluatedPortals: ElevationPortalGraph[] = [
            {portals: polygonToUnevaluatedEdges(0, false, polygons[0], entrances)},
            {portals: polygonToUnevaluatedEdges(1, true, polygons[1], entrances)},
            {portals: polygonToUnevaluatedEdges(2, false, polygons[2], entrances)},
            {portals: polygonToUnevaluatedEdges(3, false, polygons[3], entrances)},
            {portals: polygonToUnevaluatedEdges(4, false, polygons[4], entrances)},
            {portals: polygonToUnevaluatedEdges(5, false, polygons[5], entrances)}
        ];

        const evaluated = ElevationPortalGraph.evaluate(unevaluatedPortals);

        evaluated.portals.sort((a, b) => a.type === b.type ? b.hash > a.hash ? 1 : -1 : a.type.localeCompare(b.type));

        for (let i = 4; i < 7; i++) {
            const it = evaluated.portals[i];

            if (it.va.y === it.vb.y ? it.va.x > it.vb.x : it.va.y > it.vb.y) {
                [it.va, it.vb] = [it.vb, it.va];
                // Turn negative zero to positive zero with +0
                it.vab[0] = -it.vab[0] + 0;
                it.vab[1] = -it.vab[1] + 0;
                [it.connection.a, it.connection.b] = [it.connection.b, it.connection.a];
            }
        }

        const expected: ElevationPortalEdge[] = [
            toUnevaluatedEdge({a: 3, b: undefined}, new Point(13, 4), new Point(13, 6), false, 'entrance'),
            toUnevaluatedEdge({a: 5, b: undefined}, new Point(9, 4), new Point(9, 6), false, 'entrance'),
            toUnevaluatedEdge({a: 4, b: undefined}, new Point(10, 9), new Point(8, 9), false, 'entrance'),
            toUnevaluatedEdge({a: 0, b: undefined}, new Point(2, 4), new Point(2, 2), false, 'entrance'),

            toUnevaluatedEdge({a: 2, b: 3}, new Point(11, 4), new Point(11, 6), false, 'polygon'),
            toUnevaluatedEdge({a: 4, b: 2}, new Point(8, 7), new Point(10, 7), false, 'polygon'),
            toUnevaluatedEdge({a: 2, b: 5}, new Point(8, 4), new Point(8, 6), false, 'polygon'),
            toUnevaluatedEdge({a: 1, b: 2}, new Point(7, 4), new Point(6, 6), true, 'tunnel'),
            toUnevaluatedEdge({a: 1, b: 0}, new Point(4, 4), new Point(5, 2), true, 'tunnel')
        ];

        expect(evaluated.portals).toMatchObject(expected);
    });
});
