import {describe, test, expect} from "../../util/vitest.js";
import DEMData from '../../../src/data/dem_data.js';
import DemMinMaxQuadTree, {buildDemMipmap, sampleElevation} from '../../../src/data/dem_tree.js';
import {fixedNum} from '../../util/fixed.js';

const unpackVector = [65536, 256, 1];

function encodeElevation(elevation) {
    const result = [];
    elevation = (elevation + 10000) * 10;
    for (let i = 0; i < 3; i++) {
        result[i] = Math.floor(elevation / unpackVector[i]);
        elevation -= result[i] * unpackVector[i];
    }
    return result;
}

function fillElevation(size, padding, value) {
    const paddedSize = size + padding * 2;
    const result = [];
    for (let i = 0; i < paddedSize * paddedSize; i++)
        result[i] = value;
    return result;
}

function mockDEMfromElevation(size, padding, elevation) {
    const paddedSize = size + padding * 2;
    const pixels = new Uint8Array(paddedSize * paddedSize * 4);
    for (let i = 0; i < elevation.length; i++) {
        const bytes = encodeElevation(elevation[i]);
        pixels[i * 4 + 0] = bytes[0];
        pixels[i * 4 + 1] = bytes[1];
        pixels[i * 4 + 2] = bytes[2];
        pixels[i * 4 + 3] = 0;
    }

    return new DEMData(0, {width: paddedSize, height: paddedSize, data: pixels});
}

function idx(x, y, size, padding) {
    return (y + 1) * (size + 2 * padding) + (x + 1);
}

describe('DEM mip map generation', () => {
    const leafCount = (mip) => {
        let count = 0;
        for (let i = 0; i < mip.leaves.length; i++)
            count += mip.leaves[i];
        return count;
    };

    test('Flat DEM', () => {
        const size = 256;
        const elevation = fillElevation(size, 1, 0);
        const dem = mockDEMfromElevation(size, 1, elevation);

        // No elevation differences. 6 levels expected and all marked as leaves
        const demMips = buildDemMipmap(dem);
        const expectedSizes = [32, 16, 8, 4, 2, 1];
        const expectedLeaves = [1024, 256, 64, 16, 4, 1];

        expect(demMips.length).toEqual(6);
        for (let i = 0; i < 6; i++) {
            expect(demMips[i].size).toEqual(expectedSizes[i]);
            expect(leafCount(demMips[i])).toEqual(expectedLeaves[i]);
        }
    });

    test('Small DEM', () => {
        const size = 4;
        const elevation = fillElevation(size, 1, 100);
        const dem = mockDEMfromElevation(size, 1, elevation);
        const demMips = buildDemMipmap(dem);

        expect(demMips.length).toEqual(1);
        expect(demMips[0].size).toEqual(1);
        expect(demMips[0].maximums.length).toEqual(1);
        expect(demMips[0].minimums.length).toEqual(1);
        expect(demMips[0].maximums[0]).toEqual(100);
        expect(demMips[0].minimums[0]).toEqual(100);
        expect(demMips[0].leaves[0]).toEqual(1);
    });

    test('Elevation sampling', () => {
        const size = 16;
        const padding = 1;
        const elevation = fillElevation(size, padding, 0);

        // Fill the elevation data with 4 blocks (8x8) texels with elevations 0, 100, and 200
        for (let y = 0; y < size; y++) {
            const yBlock = Math.floor(y / 8);
            for (let x = 0; x < size; x++) {
                const xBlock = Math.floor(x / 8);
                elevation[idx(x, y, size, padding)] = (xBlock + yBlock) * 100;
            }
        }

        const dem = mockDEMfromElevation(size, 1, elevation);

        // Check each 9 corners and expect to find interpolated values (except on borders)
        expect(sampleElevation(0, 0, dem)).toEqual(0);
        expect(sampleElevation(0.5, 0, dem)).toEqual(50);
        expect(sampleElevation(1.0, 0, dem)).toEqual(100);

        expect(sampleElevation(0, 0.5, dem)).toEqual(50);
        expect(sampleElevation(0.5, 0.5, dem)).toEqual(100);
        expect(sampleElevation(1.0, 0.5, dem)).toEqual(150);

        expect(sampleElevation(0, 1.0, dem)).toEqual(100);
        expect(sampleElevation(0.5, 1.0, dem)).toEqual(150);
        expect(sampleElevation(1.0, 1.0, dem)).toEqual(200);
    });

    test('Merge nodes with little elevation difference', () => {
        const size = 32;
        const padding = 1;
        const elevation = fillElevation(size, padding, 0);
        /*
            Construct elevation data with following expected mips
            mip 0 (max, leaves):
            5   0 0 1000 | 1 1 1 1
            0   0 0 0    | 1 1 1 1
            0   0 0 0    | 1 1 1 1
            101 0 0 97    | 1 1 1 1

            mip 1 (max, leaves):
            5   1000    | 1 0
            102 97      | 0 0

            mip 2 (max, leaves):
            1000        | 0
        */

        const idx = (x, y) => (y + 1) * (size + 2 * padding) + (x + 1);

        // Set elevation values of sampled corner points. (One block is 8x8 texels)
        elevation[idx(0, 0)] = 5;
        elevation[idx(size - 1, 0)] = 1000;
        elevation[idx(0, size - 1)] = 101;
        elevation[idx(size - 1, size - 1)] = 97;

        const dem = mockDEMfromElevation(size, 1, elevation);
        const demMips = buildDemMipmap(dem);

        // mip 0
        let expectedMaximums = [
            5, 0, 0, 1000,
            0, 0, 0, 0,
            0, 0, 0, 0,
            101, 0, 0, 97
        ];

        let expectedLeaves = [
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 1, 1
        ];

        expect(demMips.length).toEqual(3);
        expect(demMips[0].size).toEqual(4);
        expect(demMips[0].maximums).toEqual(expectedMaximums);
        expect(demMips[0].leaves).toEqual(expectedLeaves);

        // mip 1
        expectedMaximums = [
            5, 1000,
            101, 97
        ];

        expectedLeaves = [
            1, 0,
            0, 0
        ];

        expect(demMips[1].size).toEqual(2);
        expect(demMips[1].maximums).toEqual(expectedMaximums);
        expect(demMips[1].leaves).toEqual(expectedLeaves);

        // mip 2
        expect(demMips[2].size).toEqual(1);
        expect(demMips[2].minimums).toEqual([0]);
        expect(demMips[2].maximums).toEqual([1000]);
        expect(demMips[2].leaves).toEqual([0]);
    });
});

describe('DemMinMaxQuadTree', () => {
    describe('Construct', () => {
        test('Flat DEM', () => {
            const size = 256;
            const elevation = fillElevation(size, 1, 12345);
            const dem = mockDEMfromElevation(size, 1, elevation);

            // No elevation differences. 6 levels expected and all marked as leaves
            const tree = new DemMinMaxQuadTree(dem);
            expect(tree.nodeCount).toEqual(1);
            expect(tree.maximums[0]).toEqual(12345);
            expect(tree.minimums[0]).toEqual(12345);
        });

        test('Sparse tree', () => {
            const size = 32;
            const padding = 1;
            const elevation = fillElevation(size, padding, 0);
            /*
                5   0 0 1000
                0   0 0 0
                0   0 0 0
                101 0 0 97
            */

            const idx = (x, y) => (y + 1) * (size + 2 * padding) + (x + 1);

            // Set elevation values of sampled corner points. (One block is 8x8 texels)
            elevation[idx(0, 0)] = 5;
            elevation[idx(size - 1, 0)] = 1000;
            elevation[idx(0, size - 1)] = 101;
            elevation[idx(size - 1, size - 1)] = 97;

            const dem = mockDEMfromElevation(size, 1, elevation);
            const tree = new DemMinMaxQuadTree(dem);

            expect(tree.nodeCount).toEqual(17);

            const expectedMaximums = [
                // Root
                1000,

                // Mip 1
                5, 1000,
                101, 97,

                // Mip 2
                0, 1000, 0, 0,
                0, 0, 101, 0,
                0, 0, 0, 97
            ];

            const expectedMinimums = [
                // Root
                0,

                // Mip 1
                0, 0,
                0, 0,

                // Mip 2
                0, 0, 0, 0,
                0, 0, 0, 0,
                0, 0, 0, 0,
            ];

            const expectedLeaves = [
                // Root
                0,

                // Mip 1
                1, 0,
                0, 0,

                // Mip 2
                1, 1, 1, 1,
                1, 1, 1, 1,
                1, 1, 1, 1
            ];

            expect(tree.maximums).toEqual(expectedMaximums);
            expect(tree.minimums).toEqual(expectedMinimums);
            expect(tree.leaves).toEqual(expectedLeaves);
        });
    });

    describe('Raycasting', () => {
        test('Flat plane', () => {
            const size = 32;
            const padding = 1;
            const elevation = fillElevation(size, padding, 10);
            const dem = mockDEMfromElevation(size, padding, elevation);
            const tree = new DemMinMaxQuadTree(dem);

            const minx = -1;
            const maxx = 1;
            const miny = -1;
            const maxy = 1;

            let dist = tree.raycast(minx, miny, maxx, maxy, [0, 0, 11], [0, 0, -1]);
            expect(dist).toBeTruthy();
            expect(dist).toEqual(1.0);

            dist = tree.raycast(minx, miny, maxx, maxy, [1.001, 0, 5], [0, 0, -1]);
            expect(dist).toBeFalsy();

            dist = tree.raycast(minx, miny, maxx, maxy, [-1, 0, 11], [1, 0, 0]);
            expect(dist).toBeFalsy();

            // Ray should not be allowed to pass the dem chunk below the surface
            dist = tree.raycast(minx, miny, maxx, maxy, [-2.5, 0, 1], [1, 0, 0]);
            expect(dist).toBeTruthy();
            expect(dist).toEqual(1.5);
        });

        test('Gradient', () => {
            const size = 32;
            const padding = 1;
            const elevation = fillElevation(size, padding, 0);

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    elevation[idx(x, y, size, padding)] = x;
                }
            }

            const dem = mockDEMfromElevation(size, padding, elevation);
            const tree = new DemMinMaxQuadTree(dem);
            const minx = -16;
            const maxx = 16;
            const miny = -16;
            const maxy = 16;

            let dist = tree.raycast(minx, miny, maxx, maxy, [0, 0, 50], [0, 0, -1]);
            expect(dist).toBeTruthy();
            expect(dist).toEqual(34.5);

            dist = tree.raycast(minx, miny, maxx, maxy, [-32, 0, 32], [0.707, 0, -0.707]);
            expect(dist).toBeTruthy();
            expect(fixedNum(dist, 3)).toEqual(34.3);

            dist = tree.raycast(minx, miny, maxx, maxy, [16, 0, 32.01], [-0.707, 0, -0.707]);
            expect(dist).toBeFalsy();

            dist = tree.raycast(minx, miny, maxx, maxy, [16, 0, 31], [-0.707, 0, -0.707]);
            expect(dist).toEqual(0);
        });

        test('Flat plane with exaggeration', () => {
            const size = 32;
            const padding = 1;
            const elevation = fillElevation(size, padding, 10);
            const dem = mockDEMfromElevation(size, padding, elevation);
            const tree = new DemMinMaxQuadTree(dem);

            const minx = -1;
            const maxx = 1;
            const miny = -1;
            const maxy = 1;

            let dist = tree.raycast(minx, miny, maxx, maxy, [0, 0, 11], [0, 0, -1], 0.5);
            expect(dist).toBeTruthy();
            expect(dist).toEqual(6.0);

            dist = tree.raycast(minx, miny, maxx, maxy, [0, 0, 11], [0, 0, -1], 0.1);
            expect(dist).toBeTruthy();
            expect(dist).toEqual(10.0);
        });

        test('Gradient with 0.5 exaggeration', () => {
            const size = 32;
            const padding = 1;
            const elevation = fillElevation(size, padding, 0);

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    elevation[idx(x, y, size, padding)] = x;
                }
            }

            const dem = mockDEMfromElevation(size, padding, elevation);
            const tree = new DemMinMaxQuadTree(dem);
            const minx = -16;
            const maxx = 16;
            const miny = -16;
            const maxy = 16;

            let dist = tree.raycast(minx, miny, maxx, maxy, [0, 0, 50], [0, 0, -1], 0.5);
            expect(dist).toBeTruthy();
            expect(dist).toEqual(42.25);
            expect(dist > tree.raycast(minx, miny, maxx, maxy,  [0, 0, 50], [0, 0, -1])).toBeTruthy();

            dist = tree.raycast(minx, miny, maxx, maxy, [-32, 0, 32], [0.707, 0, -0.707], 0.5);
            expect(dist).toBeTruthy();
            expect(fixedNum(dist, 3)).toEqual(37.954);
            expect(
                dist > tree.raycast(minx, miny, maxx, maxy, [-32, 0, 32], [0.707, 0, -0.707])
            ).toBeTruthy();

            dist = tree.raycast(minx, miny, maxx, maxy, [16, 0, 32.01], [-0.707, 0, -0.707], 0.5);
            expect(dist).toBeFalsy();
        });
    });
});
