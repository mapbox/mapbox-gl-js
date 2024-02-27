import {describe, test, expect} from "../../util/vitest.js";
import {ReplacementSource} from '../../../3d-style/source/replacement_source.js';
import {CanonicalTileID, UnwrappedTileID} from '../../../src/source/tile_id.js';
import Point from '@mapbox/point-geometry';
import TriangleGridIndex from '../../../src/util/triangle_grid_index.js';

describe('ReplacementSource', () => {
    const footprintSetA = [
        {min: [1000.0, 1000.0], max: [3000.0, 3000.0]},
        {min: [4000.0, 1500.0], max: [6000.0, 2000.0]},
        {min: [3500.0, 3000.0], max: [4000.0, 5500.0]},
        {min: [2500.0, 5000.0], max: [5000.0, 6000.0]},
        {min: [5500.0, 2500.0], max: [6500.0, 6500.0]}
    ];

    const footprintSetB = [
        {min: [5000.0, 1000.0], max: [6000.0, 4000.0]},
        {min: [1000.0, 3500.0], max: [2000.0, 7000.0]},
        {min: [2500.0, 6500.0], max: [5000.0, 8000.0]},
        {min: [4500.0, 7000.0], max: [7000.0, 7500.0]}
    ];

    const footprintSetC = [
        {min: [-2000.0, 2000.0], max: [2345.0, 4567.0]}
    ];

    const createFootprint = (min, max, id) => {
        const vertices = [
            [min.x, min.y],
            [max.x, min.y],
            [max.x, max.y],
            [min.x, max.y]
        ].map(p => new Point(p[0], p[1]));

        const indices = [0, 1, 2, 2, 3, 0];
        const grid = new TriangleGridIndex(vertices, indices, 6);

        return {
            footprint: {
                vertices,
                indices,
                grid,
                min,
                max
            },
            id
        };
    };

    const createMockSource = (id, tileId, footprints) => {
        footprints = footprints.map(fp => {
            return createFootprint(
                {x: fp.min[0], y: fp.min[1]},
                {x: fp.max[0], y: fp.max[1]},
                tileId);
        });

        return {
            id,
            tileId,
            footprints,

            getSourceId: () => {
                return id;
            },

            getFootprints: () => {
                return footprints;
            }
        };
    };

    const createId = (z, x, y) => {
        return new UnwrappedTileID(0, new CanonicalTileID(z, x, y));
    };

    test('single source', () => {
        const replacementSource = new ReplacementSource();

        const preUpdateTime = replacementSource.updateTime;
        replacementSource._setSources([createMockSource("source", createId(0, 0, 0), footprintSetA)]);
        const postUpdateTime = replacementSource.updateTime;

        // Update time should have changed
        expect(postUpdateTime > preUpdateTime).toBeTruthy();

        // Expect to find all footprints from a single source
        const regions = replacementSource.getReplacementRegionsForTile(createId(0, 0, 0));

        expect(regions.length).toEqual(5);
        expect(regions[0].min).toStrictEqual(new Point(1000, 1000));
        expect(regions[0].max).toStrictEqual(new Point(3000, 3000));
        expect(regions[0].sourceId).toEqual("source");
        expect(regions[0].footprintTileId).toStrictEqual(createId(0, 0, 0));

        expect(regions[1].min).toStrictEqual(new Point(2500.0, 5000.0));
        expect(regions[1].max).toStrictEqual(new Point(5000.0, 6000.0));
        expect(regions[1].sourceId).toEqual("source");
        expect(regions[1].footprintTileId).toStrictEqual(createId(0, 0, 0));

        expect(regions[2].min).toStrictEqual(new Point(3500.0, 3000.0));
        expect(regions[2].max).toStrictEqual(new Point(4000.0, 5500.0));
        expect(regions[2].sourceId).toEqual("source");
        expect(regions[2].footprintTileId).toStrictEqual(createId(0, 0, 0));

        expect(regions[3].min).toStrictEqual(new Point(4000.0, 1500.0));
        expect(regions[3].max).toStrictEqual(new Point(6000.0, 2000.0));
        expect(regions[3].sourceId).toEqual("source");
        expect(regions[3].footprintTileId).toStrictEqual(createId(0, 0, 0));

        expect(regions[4].min).toStrictEqual(new Point(5500.0, 2500.0));
        expect(regions[4].max).toStrictEqual(new Point(6500.0, 6500.0));
        expect(regions[4].sourceId).toEqual("source");
        expect(regions[4].footprintTileId).toStrictEqual(createId(0, 0, 0));
    });

    describe('Tile and region overlap', () => {
        test('single source', () => {
            const replacementSource = new ReplacementSource();

            // Expect to find footprints from every overlapping tile
            const preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([createMockSource("source", createId(2, 2, 3), footprintSetC)]);
            const postUpdateTime = replacementSource.updateTime;

            expect(postUpdateTime > preUpdateTime).toBeTruthy();

            const regionsA = replacementSource.getReplacementRegionsForTile(createId(2, 2, 3));
            const regionsB = replacementSource.getReplacementRegionsForTile(createId(2, 1, 3));

            expect(regionsA.length).toStrictEqual(1);
            expect(regionsB.length).toStrictEqual(1);

            expect(regionsA[0].min).toStrictEqual(new Point(-2000.0, 2000.0));
            expect(regionsA[0].max).toStrictEqual(new Point(2345.0, 4567.0));
            expect(regionsA[0].sourceId).toEqual("source");
            expect(regionsA[0].footprintTileId).toStrictEqual(createId(2, 2, 3));

            expect(regionsB[0].min).toStrictEqual(new Point(6192.0, 2000.0));
            expect(regionsB[0].max).toStrictEqual(new Point(10537.0, 4567.0));
            expect(regionsB[0].sourceId).toEqual("source");
            expect(regionsB[0].footprintTileId).toStrictEqual(createId(2, 2, 3));
        });

        test('multiple sources', () => {
            const replacementSource = new ReplacementSource();

            const preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([
                createMockSource("sourceA", createId(2, 1, 1), footprintSetA),
                createMockSource("sourceB", createId(2, 1, 1), footprintSetB),
            ]);
            const postUpdateTime = replacementSource.updateTime;

            expect(postUpdateTime > preUpdateTime).toBeTruthy();

            // Expect some of the regions from the source A to be replaced by regions from the source B
            const regions = replacementSource.getReplacementRegionsForTile(createId(2, 1, 1));

            expect(regions.length).toEqual(7);
            expect(regions[0].sourceId).toEqual("sourceB");
            expect(regions[1].sourceId).toEqual("sourceB");
            expect(regions[2].sourceId).toEqual("sourceB");
            expect(regions[3].sourceId).toEqual("sourceB");
            expect(regions[4].sourceId).toEqual("sourceA");
            expect(regions[5].sourceId).toEqual("sourceA");
            expect(regions[6].sourceId).toEqual("sourceA");

            expect(regions[0].min).toStrictEqual(new Point(1000.0, 3500.0));
            expect(regions[0].max).toStrictEqual(new Point(2000.0, 7000.0));
            expect(regions[1].min).toStrictEqual(new Point(2500.0, 6500.0));
            expect(regions[1].max).toStrictEqual(new Point(5000.0, 8000.0));
            expect(regions[2].min).toStrictEqual(new Point(4500.0, 7000.0));
            expect(regions[2].max).toStrictEqual(new Point(7000.0, 7500.0));
            expect(regions[3].min).toStrictEqual(new Point(5000.0, 1000.0));
            expect(regions[3].max).toStrictEqual(new Point(6000.0, 4000.0));
            expect(regions[4].min).toStrictEqual(new Point(1000.0, 1000.0));
            expect(regions[4].max).toStrictEqual(new Point(3000.0, 3000.0));
            expect(regions[5].min).toStrictEqual(new Point(2500.0, 5000.0));
            expect(regions[5].max).toStrictEqual(new Point(5000.0, 6000.0));
            expect(regions[6].min).toStrictEqual(new Point(3500.0, 3000.0));
            expect(regions[6].max).toStrictEqual(new Point(4000.0, 5500.0));
        });
    });

    test('single source added twice', () => {
        const replacementSource = new ReplacementSource();

        // Expect to find footprints from every overlapping tiles
        const preUpdateTime = replacementSource.updateTime;
        replacementSource._setSources([createMockSource("source", createId(1, 0, 0), footprintSetB)]);
        const postUpdateTime = replacementSource.updateTime;

        expect(postUpdateTime > preUpdateTime).toBeTruthy();

        // Expect to find footprints from the source only once
        const regions = replacementSource.getReplacementRegionsForTile(createId(1, 0, 0));

        expect(regions.length).toEqual(4);
        expect(regions[0].sourceId).toEqual("source");
        expect(regions[1].sourceId).toEqual("source");
        expect(regions[2].sourceId).toEqual("source");
        expect(regions[3].sourceId).toEqual("source");

        expect(regions[0].min).toStrictEqual(new Point(1000.0, 3500.0));
        expect(regions[0].max).toStrictEqual(new Point(2000.0, 7000.0));
        expect(regions[1].min).toStrictEqual(new Point(2500.0, 6500.0));
        expect(regions[1].max).toStrictEqual(new Point(5000.0, 8000.0));
        expect(regions[2].min).toStrictEqual(new Point(4500.0, 7000.0));
        expect(regions[2].max).toStrictEqual(new Point(7000.0, 7500.0));
        expect(regions[3].min).toStrictEqual(new Point(5000.0, 1000.0));
        expect(regions[3].max).toStrictEqual(new Point(6000.0, 4000.0));
    });

    test('remove source', () => {
        const replacementSource = new ReplacementSource();

        const preUpdateTime = replacementSource.updateTime;
        replacementSource._setSources([createMockSource("sourceB", createId(1, 0, 0), footprintSetB)]);
        replacementSource._setSources([createMockSource("sourceC", createId(1, 0, 0), footprintSetC)]);
        const postUpdateTime = replacementSource.updateTime;

        expect(postUpdateTime > preUpdateTime).toBeTruthy();

        // Change sources and expect to find regions from the existing one only
        const regions = replacementSource.getReplacementRegionsForTile(createId(1, 0, 0));

        expect(regions.length).toEqual(1);
        expect(regions[0].min).toStrictEqual(new Point(-2000.0, 2000.0));
        expect(regions[0].max).toStrictEqual(new Point(2345.0, 4567.0));
        expect(regions[0].sourceId).toEqual("sourceC");
        expect(regions[0].footprintTileId).toStrictEqual(createId(1, 0, 0));
    });

    describe('no unnecessary updates', () => {
        test('Retain a source between frames', () => {
            // Retaining a source between frames should not trigger an update
            const replacementSource = new ReplacementSource();

            let preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([createMockSource("source", createId(9, 32, 9), footprintSetB)]);
            let postUpdateTime = replacementSource.updateTime;

            expect(postUpdateTime > preUpdateTime).toBeTruthy();

            preUpdateTime = postUpdateTime;
            replacementSource._setSources([createMockSource("source", createId(9, 32, 9), footprintSetB)]);
            postUpdateTime = replacementSource.updateTime;

            expect(preUpdateTime === postUpdateTime).toBeTruthy();
        });

        test('Add empty source without loaded tiles', () => {
            // Adding a higher priority source without any loaded tiles should not trigger an update
            const replacementSource = new ReplacementSource();

            let preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([createMockSource("source", createId(9, 32, 9), footprintSetB)]);
            let postUpdateTime = replacementSource.updateTime;

            expect(postUpdateTime > preUpdateTime).toBeTruthy();

            preUpdateTime = postUpdateTime;
            replacementSource._setSources([
                createMockSource("source", createId(9, 32, 9), footprintSetB),
                createMockSource("source", createId(0, 0, 0), [])
            ]);
            postUpdateTime = replacementSource.updateTime;

            expect(preUpdateTime === postUpdateTime).toBeTruthy();
        });

        test('New source, no changes on coverage of adjacent tiles', () => {
            // Adding a new source should trigger an update but should not change coverage on adjacent tiles
            const replacementSource = new ReplacementSource();

            replacementSource._setSources([createMockSource("sourceA", createId(9, 32, 9), footprintSetA)]);
            const coverageTileA = replacementSource.getReplacementRegionsForTile(createId(9, 32, 9));
            const coverageTileB = replacementSource.getReplacementRegionsForTile(createId(9, 33, 9));

            expect(coverageTileA.length).toEqual(5);
            expect(coverageTileB.length).toEqual(0);

            const preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([
                createMockSource("sourceA", createId(9, 32, 9), footprintSetA),
                createMockSource("sourceB", createId(9, 33, 9), footprintSetA)
            ]);
            const postUpdateTime = replacementSource.updateTime;

            expect(postUpdateTime > preUpdateTime).toBeTruthy();
            expect(replacementSource.getReplacementRegionsForTile(createId(9, 32, 9))).toStrictEqual(coverageTileA);
            expect(replacementSource.getReplacementRegionsForTile(createId(9, 33, 9))).not.toStrictEqual(coverageTileB);
        });
    });
});
