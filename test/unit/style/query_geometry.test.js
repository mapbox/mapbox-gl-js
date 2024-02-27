import {describe, test, expect} from "../../util/vitest.js";
import {fixedNum} from '../../util/fixed.js';
import Point from '@mapbox/point-geometry';
import Transform from '../../../src/geo/transform.js';
import {projectPolygonCoveringPoles, unwrapQueryPolygon} from '../../../src/style/query_geometry.js';

describe('Query geometry', () => {
    test('projectPolygonCoveringPoles', () => {
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
        expect(projected).toBeTruthy();

        // No unwrapping involved => all coordinates inside the mercator range [0, 1]
        expect(projected.unwrapped).toBeFalsy();

        const expected = [
            // begin top edge
            {x: 0.3668, y: 0.24073},
            {x: 0.31562, y: 0.21521},
            {x: 0.28401, y: 0.20695},
            {x: 0.25, y: 0.20395},
            {x: 0.18438, y: 0.21521},
            {x: 0.1332, y: 0.24073},
            // end top edge

            // the right edge is crossing the antimeridian so it's split at the location of the intersection.
            // To wrap the position to the other side of the line we'll do a round trip by covering the whole
            // polar area
            {x: 0, y: 0.2213},
            {x: 0, y: 0},
            {x: 1, y: 0},
            {x: 1, y: 0.2213},

            // bottom and left edges
            {x: 0.98003, y: 0.21839},
            {x: 0.88765, y: 0.13929},
            {x: 0.82536, y: 0.10832},
            {x: 0.75, y: 0.09541},
            {x: 0.67464, y: 0.10832},
            {x: 0.61235, y: 0.13929},
            {x: 0.51997, y: 0.21839},
            {x: 0.46807, y: 0.22947},
            {x: 0.40528, y: 0.27109},
            {x: 0.3986, y: 0.26507},
            {x: 0.38656, y: 0.25503},
            {x: 0.3668, y: 0.24073}
        ];

        const actual = projected.polygon.map(p => { return {x: fixedNum(p.x, 5), y: fixedNum(p.y, 5)}; });

        expect(actual).toEqual(expected);
    });

    describe('unwrapQueryPolygon', () => {
        test('unwrap over right border', () => {
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
            expect(projected).toBeTruthy();
            expect(projected.unwrapped).toBeTruthy();

            const expected = [
                {x: 0.9, y: 0.4},
                {x: 1.1, y: 0.4},
                {x: 1.15, y: 0.6},
                {x: 0.88, y: 0.5},
                {x: 0.9, y: 0.4}
            ];

            const actual = projected.polygon.map(p => { return {x: fixedNum(p.x, 5), y: fixedNum(p.y, 5)}; });

            expect(actual).toEqual(expected);
        });

        test('unwrap over left border', () => {
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
            expect(projected).toBeTruthy();
            expect(projected.unwrapped).toBeTruthy();

            const expected = [
                {x: -0.1, y: 0.4},
                {x: 0.1, y: 0.4},
                {x: 0.15, y: 0.6},
                {x: -0.12, y: 0.5},
                {x: -0.1, y: 0.4}
            ];

            const actual = projected.polygon.map(p => { return {x: fixedNum(p.x, 5), y: fixedNum(p.y, 5)}; });

            expect(actual).toEqual(expected);
        });
    });
});
