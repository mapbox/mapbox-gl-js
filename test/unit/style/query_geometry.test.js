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
            {x: 0.35585, y: 0.14558},
            {x: 0.3077, y: 0.12534},
            {x: 0.27959, y: 0.11921},
            {x: 0.25, y: 0.11704},
            {x: 0.1923, y: 0.12534},
            {x: 0.14415, y: 0.14558},
            // end top edge

            // the right edge is crossing the antimeridian so it's split at the location of the intersection.
            // To wrap the position to the other side of the line we'll do a round trip by covering the whole
            // polar area
            {x: 0, y: 0.14664},
            {x: 0, y: 0},
            {x: 1, y: 0},
            {x: 1, y: 0.14664},

            // bottom and left edges
            {x: 0.81863, y: 0.14796},
            {x: 0.75, y: 0.1387},
            {x: 0.68137, y: 0.14796},
            {x: 0.62944, y: 0.08946},
            {x: 0.59996, y: 0.07039},
            {x: 0.55398, y: 0.05445},
            {x: 0.48415, y: 0.05713},
            {x: 0.44036, y: 0.07578},
            {x: 0.38644, y: 0.12323},
            {x: 0.36089, y: 0.14846},
            {x: 0.35585, y: 0.14558}
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
