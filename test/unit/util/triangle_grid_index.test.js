import {describe, test, expect} from "../../util/vitest.js";
import TriangleGridIndex from '../../../src/util/triangle_grid_index.js';
import Point  from "@mapbox/point-geometry";

function createMesh(triangles) {
    const vertices = [];
    const indices = [];

    for (let i = 0; i < triangles.length; i += 3) {
        const vOffset = vertices.length;
        const v0 = triangles[i + 0];
        const v1 = triangles[i + 1];
        const v2 = triangles[i + 2];

        vertices.push(v0, v1, v2);
        indices.push(vOffset, vOffset + 1, vOffset + 2);
    }

    return {vertices, indices};
}

describe('TriangleGridIndex', () => {
    test('Empty input', () => {
        const grid = new TriangleGridIndex([], [], 0);
        const result = [];
        grid.query(new Point(0, 0), new Point(16, 16), result);
        expect(result).toStrictEqual([]);
    });

    test('Zero cell count', () => {
        const mesh = createMesh([new Point(0, 0), new Point(1, 0), new Point(1, 1)]);
        const grid = new TriangleGridIndex(mesh.vertices, mesh.indices, 0);

        const result = [];
        grid.query(new Point(0, 0), new Point(1, 1), result);

        expect(result).toStrictEqual([]);
    });

    test('Optimal cell count', () => {
        const mesh = createMesh([new Point(0, 0), new Point(1, 0), new Point(1, 1)]);
        const grid = new TriangleGridIndex(mesh.vertices, mesh.indices, 0, 1);

        const result = [];
        grid.query(new Point(0, 0), new Point(1, 1), result);

        expect(result).toStrictEqual([0]);
    });

    describe('Query', () => {
        const mesh = createMesh([
            new Point(0, 0), new Point(2, 0), new Point(0, 2),
            new Point(0, 4), new Point(4, 0), new Point(4, 4),
            new Point(0.5, 2.5), new Point(2, 3.5), new Point(0.5, 3.5),
            new Point(1, 2.5), new Point(3.5, 1.5), new Point(2.5, 4.5)
        ]);

        test('Out of bounds', () => {
            const grid = new TriangleGridIndex(mesh.vertices, mesh.indices, 1);
            const result = [];
            grid.query(new Point(-2, -1), new Point(-0.1, 2.0), result);
            expect(result).toStrictEqual([]);
        });

        test('All triangles fit a single cell', () => {
            const grid = new TriangleGridIndex(mesh.vertices, mesh.indices, 1);
            const result = [];

            grid.query(new Point(3, 3), new Point(3, 3), result);
            expect(result).toStrictEqual([0, 1, 2, 3]);

            result.length = 0;
            grid.query(new Point(0, 0), new Point(1, 3), result);
            expect(result).toStrictEqual([0, 1, 2, 3]);

            result.length = 0;
            grid.query(new Point(1.5, 1.0), new Point(2.5, 1.5), result);
            expect(result).toStrictEqual([0, 1, 2, 3]);
        });

        test('2x2 grid', () => {
            const grid = new TriangleGridIndex(mesh.vertices, mesh.indices, 2);
            const result = [];

            grid.query(new Point(3, 3), new Point(3, 3), result);
            expect(result).toStrictEqual([1, 3]);

            result.length = 0;
            grid.query(new Point(0, 0), new Point(1, 3), result);
            expect(result).toStrictEqual([0, 1, 3, 2]);

            result.length = 0;
            grid.query(new Point(1.5, 1.0), new Point(2.5, 1.5), result);
            expect(result).toStrictEqual([0, 1, 3]);
        });

        test('4x4 grid', () => {
            const grid = new TriangleGridIndex(mesh.vertices, mesh.indices, 4);
            const result = [];

            grid.query(new Point(3, 3), new Point(3, 3), result);
            expect(result).toStrictEqual([1, 3]);

            result.length = 0;
            grid.query(new Point(0, 0), new Point(1, 3), result);
            expect(result).toStrictEqual([0, 1, 2, 3]);

            result.length = 0;
            grid.query(new Point(1.5, 1.0), new Point(2.5, 1.5), result);
            expect(result).toStrictEqual([0, 1, 3]);
        });

        test('8x8 grid', () => {
            const grid = new TriangleGridIndex(mesh.vertices, mesh.indices, 8);
            const result = [];

            grid.query(new Point(3, 3), new Point(3, 3), result);
            expect(result).toStrictEqual([1, 3]);

            result.length = 0;
            grid.query(new Point(0, 0), new Point(1, 3), result);
            expect(result).toStrictEqual([0, 2, 3, 1]);

            result.length = 0;
            grid.query(new Point(1.5, 1.0), new Point(2.5, 1.5), result);
            expect(result).toStrictEqual([0, 1]);
        });
    });
});
