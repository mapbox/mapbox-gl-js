import {test} from '../../util/test.js';
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

test('DEM mip map generation', (t) => {
    const leafCount = (mip) => {
        let count = 0;
        for (let i = 0; i < mip.leaves.length; i++)
            count += mip.leaves[i];
        return count;
    };

    t.test('Flat DEM', (t) => {
        const size = 256;
        const elevation = fillElevation(size, 1, 0);
        const dem = mockDEMfromElevation(size, 1, elevation);

        // No elevation differences. 6 levels expected and all marked as leaves
        const demMips = buildDemMipmap(dem);
        const expectedSizes = [32, 16, 8, 4, 2, 1];
        const expectedLeaves = [1024, 256, 64, 16, 4, 1];

        t.equal(demMips.length, 6);
        for (let i = 0; i < 6; i++) {
            t.equal(demMips[i].size, expectedSizes[i]);
            t.equal(leafCount(demMips[i]), expectedLeaves[i]);
        }

        t.end();
    });

    t.test('Small DEM', (t) => {
        const size = 4;
        const elevation = fillElevation(size, 1, 100);
        const dem = mockDEMfromElevation(size, 1, elevation);
        const demMips = buildDemMipmap(dem);

        t.equal(demMips.length, 1);
        t.equal(demMips[0].size, 1);
        t.equal(demMips[0].maximums.length, 1);
        t.equal(demMips[0].minimums.length, 1);
        t.equal(demMips[0].maximums[0], 100);
        t.equal(demMips[0].minimums[0], 100);
        t.equal(demMips[0].leaves[0], 1);

        t.end();
    });

    t.test('Elevation sampling', (t) => {
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
        t.equal(sampleElevation(0, 0, dem), 0);
        t.equal(sampleElevation(0.5, 0, dem), 50);
        t.equal(sampleElevation(1.0, 0, dem), 100);

        t.equal(sampleElevation(0, 0.5, dem), 50);
        t.equal(sampleElevation(0.5, 0.5, dem), 100);
        t.equal(sampleElevation(1.0, 0.5, dem), 150);

        t.equal(sampleElevation(0, 1.0, dem), 100);
        t.equal(sampleElevation(0.5, 1.0, dem), 150);
        t.equal(sampleElevation(1.0, 1.0, dem), 200);

        t.end();
    });

    t.test('Merge nodes with little elevation difference', (t) => {
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

        t.equal(demMips.length, 3);
        t.equal(demMips[0].size, 4);
        t.deepEqual(demMips[0].maximums, expectedMaximums);
        t.deepEqual(demMips[0].leaves, expectedLeaves);

        // mip 1
        expectedMaximums = [
            5, 1000,
            101, 97
        ];

        expectedLeaves = [
            1, 0,
            0, 0
        ];

        t.equal(demMips[1].size, 2);
        t.deepEqual(demMips[1].maximums, expectedMaximums);
        t.deepEqual(demMips[1].leaves, expectedLeaves);

        // mip 2
        t.equal(demMips[2].size, 1);
        t.deepEqual(demMips[2].minimums, [0]);
        t.deepEqual(demMips[2].maximums, [1000]);
        t.deepEqual(demMips[2].leaves, [0]);

        t.end();
    });

    t.end();
});

test('DemMinMaxQuadTree', (t) => {
    t.test('Construct', (t) => {
        t.test('Flat DEM', (t) => {
            const size = 256;
            const elevation = fillElevation(size, 1, 12345);
            const dem = mockDEMfromElevation(size, 1, elevation);

            // No elevation differences. 6 levels expected and all marked as leaves
            const tree = new DemMinMaxQuadTree(dem);
            t.equal(tree.nodeCount, 1);
            t.equal(tree.maximums[0], 12345);
            t.equal(tree.minimums[0], 12345);
            t.equal(tree.leaves[1]);

            t.end();
        });

        t.test('Sparse tree', (t) => {
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

            t.equal(tree.nodeCount, 17);

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

            t.deepEqual(tree.maximums, expectedMaximums);
            t.deepEqual(tree.minimums, expectedMinimums);
            t.deepEqual(tree.leaves, expectedLeaves);

            t.end();
        });

        t.end();
    });

    t.test('Raycasting', (t) => {
        t.test('Flat plane', (t) => {
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
            t.ok(dist);
            t.equal(dist, 1.0);

            dist = tree.raycast(minx, miny, maxx, maxy, [1.001, 0, 5], [0, 0, -1]);
            t.notOk(dist);

            dist = tree.raycast(minx, miny, maxx, maxy, [-1, 0, 11], [1, 0, 0]);
            t.notOk(dist);

            // Ray should not be allowed to pass the dem chunk below the surface
            dist = tree.raycast(minx, miny, maxx, maxy, [-2.5, 0, 1], [1, 0, 0]);
            t.ok(dist);
            t.equal(dist, 1.5);

            t.end();
        });

        t.test('Gradient', (t) => {
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
            t.ok(dist);
            t.equal(dist, 34.5);

            dist = tree.raycast(minx, miny, maxx, maxy, [-32, 0, 32], [0.707, 0, -0.707]);
            t.ok(dist);
            t.equal(fixedNum(dist, 3), 34.3);

            dist = tree.raycast(minx, miny, maxx, maxy, [16, 0, 32.01], [-0.707, 0, -0.707]);
            t.notOk(dist);

            dist = tree.raycast(minx, miny, maxx, maxy, [16, 0, 31], [-0.707, 0, -0.707]);
            t.equal(dist, 0);

            t.end();
        });

        t.test('Flat plane with exaggeration', (t) => {
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
            t.ok(dist);
            t.equal(dist, 6.0);

            dist = tree.raycast(minx, miny, maxx, maxy, [0, 0, 11], [0, 0, -1], 0.1);
            t.ok(dist);
            t.equal(dist, 10.0);

            t.end();
        });

        t.test('Gradient with 0.5 exaggeration', (t) => {
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
            t.ok(dist);
            t.equal(dist, 42.25);
            t.true(dist > tree.raycast(minx, miny, maxx, maxy,  [0, 0, 50], [0, 0, -1]), 1);

            dist = tree.raycast(minx, miny, maxx, maxy, [-32, 0, 32], [0.707, 0, -0.707], 0.5);
            t.ok(dist);
            t.equal(fixedNum(dist, 3), 37.954);
            t.true(dist > tree.raycast(minx, miny, maxx, maxy, [-32, 0, 32], [0.707, 0, -0.707]), 1);

            dist = tree.raycast(minx, miny, maxx, maxy, [16, 0, 32.01], [-0.707, 0, -0.707], 0.5);
            t.notOk(dist);

            t.end();
        });

        t.end();
    });

    t.end();
});
