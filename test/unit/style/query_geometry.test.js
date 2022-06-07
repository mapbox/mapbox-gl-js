import {test} from '../../util/test.js';
import {fixedNum} from '../../util/fixed.js';
import Point from '@mapbox/point-geometry';
import Transform from '../../../src/geo/transform.js';
import {projectPolygonCoveringPoles, unwrapQueryPolygon} from '../../../src/style/query_geometry.js';

test('Query geometry', (t) => {
    t.test('projectPolygonCoveringPoles', (t) => {
        const tr = new Transform();
        tr.setProjection({name: 'globe'});
        tr.resize(512, 512);
        tr.zoom = 1.85;
        tr.center = {lng: 90, lat: 81};
        tr.pitch = 60;

        const rect = [
            new Point(128, 64),
            new Point(384, 64),
            new Point(384, 256),
            new Point(128, 256),
            new Point(128, 64)
        ];

        // Project a screen rectangle that should cover the north pole.
        // The rightmost edge is intersecting with the antimeridian
        const projected = projectPolygonCoveringPoles(rect, tr);
        t.ok(projected);

        // No unwrapping involved => all coordinates inside the mercator range [0, 1]
        t.false(projected.unwrapped);

        const expected = [
            // begin top edge
            {x:0.38086, y:0.22541},
            {x:0.3261, y:0.19212},
            {x:0.28999, y:0.18054},
            {x:0.25, y:0.17622},
            {x:0.21001, y:0.18054},
            {x:0.1739, y:0.19212},
            {x:0.11914, y:0.22541},
            // end top edge

            // the right edge is crossing the antimeridian so it's split at the location of the intersection.
            // To wrap the position to the other side of the line we'll do a round trip by covering the whole
            // polar area
            {x:0, y:0.22349},
            {x:0, y:0},
            {x:1, y:0},
            {x:1, y:0.22349},

            // bottom and left edges
            {x:0.95863, y:0.22283},
            {x:0.86343, y:0.16406},
            {x:0.80903, y:0.14555},
            {x:0.75, y:0.1387},
            {x:0.69097, y:0.14555},
            {x:0.63657, y:0.16406},
            {x:0.54137, y:0.22283},
            {x:0.48864, y:0.22646},
            {x:0.41885, y:0.26177},
            {x:0.41244, y:0.25477},
            {x:0.40068, y:0.24287},
            {x:0.38086, y:0.22541}
        ];

        const actual = projected.polygon.map(p => { return {x: fixedNum(p.x, 5), y: fixedNum(p.y, 5)}; });

        t.deepEqual(actual, expected);
        t.end();
    });

    t.test('unwrapQueryPolygon', (t) => {
        t.test('unwrap over right border', (t) => {
            const tr = new Transform();
            tr.setProjection({name: 'globe'});
            tr.resize(512, 512);
            tr.zoom = 1;
            tr.center = {lng: 175, lat: 0};
            tr.pitch = 0;

            const polygon = [
                new Point(0.9, 0.4),
                new Point(0.1, 0.4),     // wrapped
                new Point(0.15, 0.6),    // wrapped
                new Point(0.88, 0.5),
                new Point(0.9, 0.4)
            ];

            const projected = unwrapQueryPolygon(polygon, tr);
            t.ok(projected);
            t.true(projected.unwrapped);

            const expected = [
                {x: 0.9, y: 0.4},
                {x: 1.1, y: 0.4},
                {x: 1.15, y: 0.6},
                {x: 0.88, y: 0.5},
                {x: 0.9, y: 0.4}
            ];

            const actual = projected.polygon.map(p => { return {x: fixedNum(p.x, 5), y: fixedNum(p.y, 5)}; });

            t.deepEqual(actual, expected);
            t.end();
        });

        t.test('unwrap over left border', (t) => {
            const tr = new Transform();
            tr.setProjection({name: 'globe'});
            tr.resize(512, 512);
            tr.zoom = 1;
            tr.center = {lng: -175, lat: 0};
            tr.pitch = 0;

            const polygon = [
                new Point(0.9, 0.4),    // wrapped
                new Point(0.1, 0.4),
                new Point(0.15, 0.6),
                new Point(0.88, 0.5),   // wrapped
                new Point(0.9, 0.4)     // wrapped
            ];

            const projected = unwrapQueryPolygon(polygon, tr);
            t.ok(projected);
            t.true(projected.unwrapped);

            const expected = [
                {x: -0.1, y: 0.4},
                {x: 0.1, y: 0.4},
                {x: 0.15, y: 0.6},
                {x: -0.12, y: 0.5},
                {x: -0.1, y: 0.4}
            ];

            const actual = projected.polygon.map(p => { return {x: fixedNum(p.x, 5), y: fixedNum(p.y, 5)}; });

            t.deepEqual(actual, expected);
            t.end();
        });

        t.end();
    });

    t.end();
});
