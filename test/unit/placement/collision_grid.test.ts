import {describe, test, expect} from '../../util/vitest';
import {CollisionGrid} from '../../../src/placement/collision_grid';

import type {IntersectionResult} from '../../../src/placement/collision_grid';
import type {GeometryElement, Geometry} from '../../../src/placement/geometry';

function box(left: number, top: number, right: number, bottom: number): GeometryElement {
    return {kind: 'box', left, top, right, bottom};
}

function circle(x: number, y: number, radius: number): GeometryElement {
    return {kind: 'circle', x, y, radius};
}

describe('CollisionGrid', () => {
    const width = 150;
    const height = 100;
    const padding = 5;
    const cellSize = 4;

    function createGrid(): CollisionGrid<number> {
        return new CollisionGrid<number>(width, height, padding, cellSize);
    }

    function insertOne(grid: CollisionGrid<number>, element: GeometryElement, data?: number): boolean {
        return grid.insert([element], data);
    }

    function intersectsOne(grid: CollisionGrid<number>, element: GeometryElement, paddingOrIgnore: number | ((data: number) => boolean) = 0): IntersectionResult {
        if (typeof paddingOrIgnore === 'function') return grid.intersects([element], 0, paddingOrIgnore, () => {});
        return grid.intersects([element], paddingOrIgnore, () => false, () => {});
    }

    function intersectsMany(grid: CollisionGrid<number>, geometry: Geometry, padding_ = 0): IntersectionResult {
        return grid.intersects(geometry, padding_, () => false, () => {});
    }

    const fullGridArea = box(-1e6, -1e6, 1e6, 1e6);

    test('insert should return true if box was inserted', () => {
        const grid = createGrid();
        const boxes = [
            box(5, 5, 10, 10), // inner box
            // fully within buffer area
            box(-4, 5, -2, 10),
            box(-4, -4, -2, -2),
            box(5, -4, 10, -2),
            box(151, -4, 154, -2),
            box(151, 5, 154, 10),
            box(151, 101, 154, 104),
            box(5, 101, 10, 104),
            box(-4, 101, -2, 104),
            // partially outside of buffer area
            box(-10, 5, -4, 10),
            box(-10, -10, -4, -4),
            box(5, -10, 10, -4),
            box(154, -10, 160, -4),
            box(154, 5, 160, 10),
            box(154, 106, 160, 110),
            box(5, 106, 10, 110),
            box(-10, 106, -4, 110),
            box(-4, -4, 160, 110),
            box(-1000, -1000, 1000, 1000),
        ];
        for (const b of boxes) expect(insertOne(grid, b)).toBe(true);
    });

    test('insert should return true if circle was inserted', () => {
        const grid = createGrid();
        const circles = [
            circle(50, 50, 10), // inner circle
            // fully within buffer area
            circle(-2.5, 50, 2),
            circle(-2.5, -2.5, 2),
            circle(50, -2.5, 2),
            circle(152.5, -2.5, 2),
            circle(152.5, 50, 2),
            circle(152.5, 103, 2),
            circle(50, 103, 2),
            circle(-2.5, 103, 2),
            // partially outside of buffer area
            circle(-6, 50, 2),
            circle(-6, -6, 2),
            circle(50, -6, 2),
            circle(156, -6, 2),
            circle(156, 50, 2),
            circle(156, 108, 2),
            circle(50, 108, 2),
            circle(-6, 108, 2),
            circle(75, 50, 91),
            circle(75, 50, 1000),
        ];
        for (const c of circles) expect(insertOne(grid, c)).toBe(true);
    });

    test('insert should return false if box is fully outside', () => {
        const grid = createGrid();
        const boxes = [
            box(-10, 5, -6, 10),
            box(-10, -10, -6, -6),
            box(5, -10, 10, -6),
            box(156, -10, 160, -6),
            box(156, 5, 160, 10),
            box(156, 108, 160, 110),
            box(5, 108, 10, 110),
            box(-10, 108, -6, 110),
            box(-10, -10, -6, 10),
            box(-10, -10, -6, 160),
            box(-10, 10, -6, 160),
            box(-10, -10, 10, -6),
            box(-10, -10, 160, -6),
            box(10, -10, 160, -6),
            box(156, -10, 160, 10),
            box(156, -10, 160, 160),
            box(156, 10, 160, 160),
            box(-10, 108, 10, 110),
            box(-10, 108, 160, 110),
            box(10, 108, 160, 110),
        ];
        for (const b of boxes) expect(insertOne(grid, b)).toBe(false);
    });

    test('insert should return false if box is touching the area border', () => {
        const grid = createGrid();
        const boxes = [
            box(-10, 5, -5, 10),
            box(-10, -10, -5, -5),
            box(5, -10, 10, -5),
            box(155, -10, 160, -5),
            box(155, 5, 160, 10),
            box(155, 107, 160, 110),
            box(5, 107, 10, 110),
            box(-10, 107, -5, 110),
            box(-10, -10, -5, 10),
            box(-10, -10, -5, 160),
            box(-10, 10, -5, 160),
            box(-10, -10, 10, -5),
            box(-10, -10, 160, -5),
            box(10, -10, 160, -5),
            box(155, -10, 160, 10),
            box(155, -10, 160, 160),
            box(155, 10, 160, 160),
            box(-10, 107, 10, 110),
            box(-10, 107, 160, 110),
            box(10, 107, 160, 110),
        ];
        for (const b of boxes) expect(insertOne(grid, b)).toBe(false);
    });

    test('insert should return false if circle is fully outside', () => {
        const grid = createGrid();
        const circles = [
            circle(-8, 50, 2),
            circle(-8, -8, 2),
            circle(50, -8, 2),
            circle(158, -8, 2),
            circle(158, 50, 2),
            circle(158, 110, 2),
            circle(50, 110, 2),
            circle(-8, 110, 2),
        ];
        for (const c of circles) expect(insertOne(grid, c)).toBe(false);
    });

    test('insert should return false if circle is touching the area border', () => {
        const grid = createGrid();
        const circles = [
            circle(-7, 50, 2),
            circle(50, -7, 2),
            circle(157, 50, 2),
            circle(50, 109, 2),
        ];
        for (const c of circles) expect(insertOne(grid, c)).toBe(false);
    });

    test('insert should insert all geometry parts', () => {
        const grid = createGrid();
        const geometry = [box(5, 5, 10, 10), box(25, 25, 30, 30), circle(5, 25, 5)];
        expect(grid.insert(geometry, undefined)).toBe(true);

        expect(intersectsOne(grid, box(6, 6, 9, 9))).toBe('intersects');
        expect(intersectsOne(grid, box(26, 26, 29, 29))).toBe('intersects');
        expect(intersectsOne(grid, box(4, 24, 6, 26))).toBe('intersects');
    });

    test('intersects should return intersects for intersecting boxes', () => {
        const grid = createGrid();
        insertOne(grid, box(10, 30, 20, 40));
        expect(intersectsOne(grid, box(5, 25, 15, 35))).toBe('intersects');
    });

    test('intersects should return intersects for intersecting padded box and box', () => {
        const grid = createGrid();
        insertOne(grid, box(10, 30, 20, 40));
        expect(intersectsOne(grid, box(0, 20, 5, 25), 10)).toBe('intersects');
    });

    test('intersects should return intersects for intersecting circles', () => {
        const grid = createGrid();
        insertOne(grid, circle(20, 30, 10));
        expect(intersectsOne(grid, circle(30, 40, 10))).toBe('intersects');
        expect(intersectsOne(grid, circle(20, 30, 1000))).toBe('intersects');
    });

    test('intersects should return intersects for intersecting padded circle and circle', () => {
        const grid = createGrid();
        insertOne(grid, circle(20, 30, 10));
        expect(intersectsOne(grid, circle(40, 50, 10), 10)).toBe('intersects');
    });

    test('intersects should return intersects for intersecting circle and box', () => {
        const grid = createGrid();
        insertOne(grid, box(10, 60, 50, 90));
        expect(intersectsOne(grid, circle(30, 75, 30))).toBe('intersects');
        expect(intersectsOne(grid, circle(-10, -10, 150))).toBe('intersects');
    });

    test('intersects should return intersects for intersecting padded circle and box', () => {
        const grid = createGrid();
        insertOne(grid, box(10, 60, 50, 90));
        expect(intersectsOne(grid, circle(0, 50, 5), 10)).toBe('intersects');
    });

    test('intersects should return intersects for intersecting box and circle', () => {
        const grid = createGrid();
        insertOne(grid, circle(30, 70, 5));
        expect(intersectsOne(grid, box(20, 60, 30, 70))).toBe('intersects');
    });

    test('intersects should return intersects for intersecting padded box and circle', () => {
        const grid = createGrid();
        insertOne(grid, circle(30, 70, 5));
        expect(intersectsOne(grid, box(10, 50, 20, 60), 10)).toBe('intersects');
    });

    test('intersects should return intersects if only one geometry element intersects', () => {
        const grid = createGrid();
        insertOne(grid, box(10, 30, 20, 40));

        expect(intersectsMany(grid, [box(5, 5, 25, 35), box(50, 50, 60, 60)])).toBe('intersects');
        expect(intersectsMany(grid, [box(50, 50, 60, 60), box(5, 5, 25, 35)])).toBe('intersects');
        expect(intersectsMany(grid, [box(0, 0, 5, 25), box(50, 50, 60, 60)], 10)).toBe('intersects');
        expect(intersectsMany(grid, [box(50, 50, 60, 60), box(0, 0, 5, 25)], 10)).toBe('intersects');
    });

    test('intersects should test each stored geometry against every query element', () => {
        const grid = createGrid();
        // The stored box and the first query element share a cell but do not intersect.
        // The second query element coincides with the stored box, so the query must
        // report a collision: a stored geometry checked against one element has to be
        // re-checked against the others.
        insertOne(grid, box(12, 12, 13, 13));

        expect(intersectsMany(grid, [box(14, 14, 14.5, 14.5), box(12, 12, 13, 13)])).toBe('intersects');
        // Same, but with the intersecting element first, to guard against order dependency.
        expect(intersectsMany(grid, [box(12, 12, 13, 13), box(14, 14, 14.5, 14.5)])).toBe('intersects');
    });

    test('intersects should return outside-of-grid if all geometry elements are outside of grid', () => {
        const grid = createGrid();
        expect(intersectsMany(grid, [box(-20, -20, -10, -10), box(160, 110, 170, 120)])).toBe('outside-of-grid');
    });

    test('intersects should return does-not-intersect if all but one geometry elements are outside of grid', () => {
        const grid = createGrid();
        expect(intersectsMany(grid, [box(-20, -20, -10, -10), box(160, 110, 170, 120), box(10, 10, 20, 20)])).toBe('does-not-intersect');
        expect(intersectsMany(grid, [box(-20, -20, -10, -10), box(10, 10, 20, 20), box(160, 110, 170, 120)])).toBe('does-not-intersect');
        expect(intersectsMany(grid, [box(10, 10, 20, 20), box(-20, -20, -10, -10), box(160, 110, 170, 120)])).toBe('does-not-intersect');
    });

    test('intersects should return does-not-intersect for empty buffer', () => {
        const grid = createGrid();
        expect(intersectsOne(grid, fullGridArea)).toBe('does-not-intersect');
    });

    test('intersects should return does-not-intersect for non-intersecting geometries', () => {
        const grid = createGrid();
        insertOne(grid, box(12, 12, 13, 13));
        insertOne(grid, circle(12, 12, 1));

        expect(intersectsOne(grid, box(14, 14, 20, 20))).toBe('does-not-intersect');
        expect(intersectsOne(grid, circle(14, 14, 0.5))).toBe('does-not-intersect');
        expect(intersectsOne(grid, box(24, 24, 30, 30), 10)).toBe('does-not-intersect');
        expect(intersectsOne(grid, circle(13, 24, 0.5), 10)).toBe('does-not-intersect');
    });

    test('intersects should return does-not-intersect for touching geometries', () => {
        const grid = createGrid();
        insertOne(grid, box(12, 12, 13, 13));
        insertOne(grid, circle(12, 12, 1));

        expect(intersectsOne(grid, box(13, 11, 15, 15))).toBe('does-not-intersect');
        expect(intersectsOne(grid, circle(14, 12, 1))).toBe('does-not-intersect');
        expect(intersectsOne(grid, box(23, 11, 25, 15), 10)).toBe('does-not-intersect');
        expect(intersectsOne(grid, circle(24, 12, 1), 10)).toBe('does-not-intersect');
    });

    test('intersects should return outside-of-grid for geometry outside the grid', () => {
        const grid = createGrid();
        insertOne(grid, box(-100, -100, 200, 200));

        expect(intersectsOne(grid, box(-100, -100, -5, -5))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(10, -100, 20, -5))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(155, -100, 200, -5))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(155, 10, 200, 20))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(155, 107, 200, 200))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(10, 107, 20, 200))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(-100, 107, -5, 200))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(-100, 10, -5, 20))).toBe('outside-of-grid');

        expect(intersectsOne(grid, box(-100, -100, -15, -15), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(10, -100, 20, -15), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(165, -100, 200, -15), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(165, 10, 200, 20), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(165, 117, 200, 200), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(10, 117, 20, 200), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(-100, 117, -15, 200), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(-100, 10, -15, 20), 10)).toBe('outside-of-grid');

        expect(intersectsOne(grid, box(-100, -100, -10, -10))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(10, -100, 20, -10))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(160, -100, 200, -10))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(160, 10, 200, 20))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(160, 110, 200, 200))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(10, 110, 20, 200))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(-100, 110, -10, 200))).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(-100, 10, -10, 20))).toBe('outside-of-grid');

        expect(intersectsOne(grid, box(-100, -100, -20, -20), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(10, -100, 20, -20), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(170, -100, 200, -20), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(170, 10, 200, 20), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(170, 120, 200, 200), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(10, 120, 20, 200), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(-100, 120, -20, 200), 10)).toBe('outside-of-grid');
        expect(intersectsOne(grid, box(-100, 10, -20, 20), 10)).toBe('outside-of-grid');
    });

    test('intersects should ignore operator and return intersects for intersected geometry without stored data', () => {
        const grid = createGrid();
        insertOne(grid, box(-100, -100, 200, 200));

        let called = false;
        expect(intersectsOne(grid, box(0, 0, 100, 100), () => {
            called = true;
            return true;
        })).toBe('intersects');
        expect(called).toBe(false);
    });

    test('intersects should ignore collision if operator returned true', () => {
        const grid = createGrid();
        insertOne(grid, box(-100, -100, 200, 200), 0);

        expect(intersectsOne(grid, box(0, 0, 100, 100), () => true)).toBe('does-not-intersect');
    });

    test('intersects should not test the same geometry twice', () => {
        const grid = createGrid();
        insertOne(grid, box(-100, -100, 200, 200), 0);

        let checkCount = 0;
        intersectsOne(grid, fullGridArea, () => {
            checkCount++;
            return true;
        });

        expect(checkCount).toBe(1);
    });

    test('intersects should test geometries with the same data', () => {
        const grid = createGrid();
        // One cell
        insertOne(grid, box(0, 0, 1, 1), 0);
        insertOne(grid, box(1, 1, 2, 2), 0);

        let checkCount = 0;
        intersectsOne(grid, fullGridArea, () => {
            checkCount++;
            return true;
        });

        expect(checkCount).toBe(2);
    });

    test('intersects should return does-not-intersect if all collisions were ignored', () => {
        const grid = createGrid();
        insertOne(grid, box(-100, -100, 200, 200), 0);
        insertOne(grid, box(0, 0, 100, 100), 1);

        expect(intersectsOne(grid, box(0, 0, 100, 100), () => true)).toBe('does-not-intersect');
    });

    test('intersects should return intersects right after operator returned false', () => {
        const grid = createGrid();
        // One cell
        insertOne(grid, box(0, 0, 1, 1), 0);
        insertOne(grid, box(0, 1, 1, 2), 1);
        insertOne(grid, box(1, 0, 2, 1), 2);
        insertOne(grid, box(1, 1, 2, 2), 3);

        expect(intersectsOne(grid, box(0, 0, 100, 100), (data) => {
            expect(data).toBeLessThanOrEqual(2);
            return data < 2;
        })).toBe('intersects');
    });

    test('intersects should call onBlocked with the stored data of the blocking geometry', () => {
        const grid = createGrid();
        insertOne(grid, box(10, 30, 20, 40), 42);

        let blockedWith: number | undefined;
        expect(grid.intersects([box(5, 25, 15, 35)], 0, () => false, (data) => { blockedWith = data; })).toBe('intersects');
        expect(blockedWith).toBe(42);
    });

    test('intersects should not call onBlocked when the collision was ignored', () => {
        const grid = createGrid();
        insertOne(grid, box(10, 30, 20, 40), 42);

        let called = false;
        expect(grid.intersects([box(5, 25, 15, 35)], 0, () => true, () => { called = true; })).toBe('does-not-intersect');
        expect(called).toBe(false);
    });

    test('intersects should not call onBlocked when nothing intersects', () => {
        const grid = createGrid();
        insertOne(grid, box(10, 30, 20, 40), 42);

        let called = false;
        expect(grid.intersects([box(60, 60, 70, 70)], 0, () => false, () => { called = true; })).toBe('does-not-intersect');
        expect(called).toBe(false);
    });

    test('intersects should return outside-of-grid even if extended geometry intersects with a grid', () => {
        const grid = createGrid();
        expect(intersectsOne(grid, box(-10, -10, -7, -7), 5)).toBe('outside-of-grid');
    });

    test('clear should remove geometries', () => {
        const grid = createGrid();
        insertOne(grid, box(5, 5, 10, 10));
        insertOne(grid, circle(50, 50, 15));

        grid.clearAndResize(width, height);

        expect(intersectsOne(grid, fullGridArea)).toBe('does-not-intersect');
    });

    test('clearAndResize should increase grid', () => {
        const grid = createGrid();
        const outsideBox = box(206, 154, 208, 156);
        expect(insertOne(grid, outsideBox)).toBe(false);

        grid.clearAndResize(200, 150);

        expect(insertOne(grid, outsideBox)).toBe(true);
    });

    test('clearAndResize should reduce grid', () => {
        const grid = createGrid();
        const nowOutsideBox = box(154, 106, 156, 108);
        expect(insertOne(grid, nowOutsideBox)).toBe(true);

        grid.clearAndResize(100, 50);

        expect(insertOne(grid, nowOutsideBox)).toBe(false);
    });
});
