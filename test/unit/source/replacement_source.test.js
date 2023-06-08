import {test} from '../../util/test.js';
import {ReplacementSource} from '../../../3d-style/source/replacement_source.js';
import {CanonicalTileID, UnwrappedTileID} from '../../../src/source/tile_id.js';
import Point from '@mapbox/point-geometry';
import TriangleGridIndex from '../../../src/util/triangle_grid_index.js';

test('ReplacementSource', (t) => {
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

    t.test('single source', (t) => {
        const replacementSource = new ReplacementSource();

        const preUpdateTime = replacementSource.updateTime;
        replacementSource._setSources([createMockSource("source", createId(0, 0, 0), footprintSetA)]);
        const postUpdateTime = replacementSource.updateTime;

        // Update time should have changed
        t.ok(postUpdateTime > preUpdateTime);

        // Expect to find all footprints from a single source
        const regions = replacementSource.getReplacementRegionsForTile(createId(0, 0, 0));

        t.equal(regions.length, 5);
        t.strictSame(regions[0].min, new Point(1000, 1000));
        t.strictSame(regions[0].max, new Point(3000, 3000));
        t.equal(regions[0].sourceId, "source");
        t.strictSame(regions[0].footprintTileId, createId(0, 0, 0));

        t.strictSame(regions[1].min, new Point(2500.0, 5000.0));
        t.strictSame(regions[1].max, new Point(5000.0, 6000.0));
        t.equal(regions[1].sourceId, "source");
        t.strictSame(regions[1].footprintTileId, createId(0, 0, 0));

        t.strictSame(regions[2].min, new Point(3500.0, 3000.0));
        t.strictSame(regions[2].max, new Point(4000.0, 5500.0));
        t.equal(regions[2].sourceId, "source");
        t.strictSame(regions[2].footprintTileId, createId(0, 0, 0));

        t.strictSame(regions[3].min, new Point(4000.0, 1500.0));
        t.strictSame(regions[3].max, new Point(6000.0, 2000.0));
        t.equal(regions[3].sourceId, "source");
        t.strictSame(regions[3].footprintTileId, createId(0, 0, 0));

        t.strictSame(regions[4].min, new Point(5500.0, 2500.0));
        t.strictSame(regions[4].max, new Point(6500.0, 6500.0));
        t.equal(regions[4].sourceId, "source");
        t.strictSame(regions[4].footprintTileId, createId(0, 0, 0));

        t.end();
    });

    t.test('Tile and region overlap', (t) => {
        t.test('single source', (t) => {
            const replacementSource = new ReplacementSource();

            // Expect to find footprints from every overlapping tile
            const preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([createMockSource("source", createId(2, 2, 3), footprintSetC)]);
            const postUpdateTime = replacementSource.updateTime;

            t.ok(postUpdateTime > preUpdateTime);

            const regionsA = replacementSource.getReplacementRegionsForTile(createId(2, 2, 3));
            const regionsB = replacementSource.getReplacementRegionsForTile(createId(2, 1, 3));

            t.strictSame(regionsA.length, 1);
            t.strictSame(regionsB.length, 1);

            t.strictSame(regionsA[0].min, new Point(-2000.0, 2000.0));
            t.strictSame(regionsA[0].max, new Point(2345.0, 4567.0));
            t.equal(regionsA[0].sourceId, "source");
            t.strictSame(regionsA[0].footprintTileId, createId(2, 2, 3));

            t.strictSame(regionsB[0].min, new Point(6192.0, 2000.0));
            t.strictSame(regionsB[0].max, new Point(10537.0, 4567.0));
            t.equal(regionsB[0].sourceId, "source");
            t.strictSame(regionsB[0].footprintTileId, createId(2, 2, 3));

            t.end();
        });

        t.test('multiple sources', (t) => {
            const replacementSource = new ReplacementSource();

            const preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([
                createMockSource("sourceA", createId(2, 1, 1), footprintSetA),
                createMockSource("sourceB", createId(2, 1, 1), footprintSetB),
            ]);
            const postUpdateTime = replacementSource.updateTime;

            t.ok(postUpdateTime > preUpdateTime);

            // Expect some of the regions from the source A to be replaced by regions from the source B
            const regions = replacementSource.getReplacementRegionsForTile(createId(2, 1, 1));

            t.equal(regions.length, 7);
            t.equal(regions[0].sourceId, "sourceB");
            t.equal(regions[1].sourceId, "sourceB");
            t.equal(regions[2].sourceId, "sourceB");
            t.equal(regions[3].sourceId, "sourceB");
            t.equal(regions[4].sourceId, "sourceA");
            t.equal(regions[5].sourceId, "sourceA");
            t.equal(regions[6].sourceId, "sourceA");

            t.strictSame(regions[0].min, new Point(1000.0, 3500.0));
            t.strictSame(regions[0].max, new Point(2000.0, 7000.0));
            t.strictSame(regions[1].min, new Point(2500.0, 6500.0));
            t.strictSame(regions[1].max, new Point(5000.0, 8000.0));
            t.strictSame(regions[2].min, new Point(4500.0, 7000.0));
            t.strictSame(regions[2].max, new Point(7000.0, 7500.0));
            t.strictSame(regions[3].min, new Point(5000.0, 1000.0));
            t.strictSame(regions[3].max, new Point(6000.0, 4000.0));
            t.strictSame(regions[4].min, new Point(1000.0, 1000.0));
            t.strictSame(regions[4].max, new Point(3000.0, 3000.0));
            t.strictSame(regions[5].min, new Point(2500.0, 5000.0));
            t.strictSame(regions[5].max, new Point(5000.0, 6000.0));
            t.strictSame(regions[6].min, new Point(3500.0, 3000.0));
            t.strictSame(regions[6].max, new Point(4000.0, 5500.0));
            t.end();
        });

        t.end();
    });

    t.test('single source added twice', (t) => {
        const replacementSource = new ReplacementSource();

        // Expect to find footprints from every overlapping tiles
        const preUpdateTime = replacementSource.updateTime;
        replacementSource._setSources([createMockSource("source", createId(1, 0, 0), footprintSetB)]);
        const postUpdateTime = replacementSource.updateTime;

        t.ok(postUpdateTime > preUpdateTime);

        // Expect to find footprints from the source only once
        const regions = replacementSource.getReplacementRegionsForTile(createId(1, 0, 0));

        t.equal(regions.length, 4);
        t.equal(regions[0].sourceId, "source");
        t.equal(regions[1].sourceId, "source");
        t.equal(regions[2].sourceId, "source");
        t.equal(regions[3].sourceId, "source");

        t.strictSame(regions[0].min, new Point(1000.0, 3500.0));
        t.strictSame(regions[0].max, new Point(2000.0, 7000.0));
        t.strictSame(regions[1].min, new Point(2500.0, 6500.0));
        t.strictSame(regions[1].max, new Point(5000.0, 8000.0));
        t.strictSame(regions[2].min, new Point(4500.0, 7000.0));
        t.strictSame(regions[2].max, new Point(7000.0, 7500.0));
        t.strictSame(regions[3].min, new Point(5000.0, 1000.0));
        t.strictSame(regions[3].max, new Point(6000.0, 4000.0));
        t.end();
    });

    t.test('remove source', (t) => {
        const replacementSource = new ReplacementSource();

        const preUpdateTime = replacementSource.updateTime;
        replacementSource._setSources([createMockSource("sourceB", createId(1, 0, 0), footprintSetB)]);
        replacementSource._setSources([createMockSource("sourceC", createId(1, 0, 0), footprintSetC)]);
        const postUpdateTime = replacementSource.updateTime;

        t.ok(postUpdateTime > preUpdateTime);

        // Change sources and expect to find regions from the existing one only
        const regions = replacementSource.getReplacementRegionsForTile(createId(1, 0, 0));

        t.equal(regions.length, 1);
        t.strictSame(regions[0].min, new Point(-2000.0, 2000.0));
        t.strictSame(regions[0].max, new Point(2345.0, 4567.0));
        t.equal(regions[0].sourceId, "sourceC");
        t.strictSame(regions[0].footprintTileId, createId(1, 0, 0));
        t.end();
    });

    t.test('no unnecessary updates', (t) => {
        t.test('Retain a source between frames', (t) => {
            // Retaining a source between frames should not trigger an update
            const replacementSource = new ReplacementSource();

            let preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([createMockSource("source", createId(9, 32, 9), footprintSetB)]);
            let postUpdateTime = replacementSource.updateTime;

            t.ok(postUpdateTime > preUpdateTime);

            preUpdateTime = postUpdateTime;
            replacementSource._setSources([createMockSource("source", createId(9, 32, 9), footprintSetB)]);
            postUpdateTime = replacementSource.updateTime;

            t.ok(preUpdateTime === postUpdateTime);
            t.end();
        });

        t.test('Add empty source without loaded tiles', (t) => {
            // Adding a higher priority source without any loaded tiles should not trigger an update
            const replacementSource = new ReplacementSource();

            let preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([createMockSource("source", createId(9, 32, 9), footprintSetB)]);
            let postUpdateTime = replacementSource.updateTime;

            t.ok(postUpdateTime > preUpdateTime);

            preUpdateTime = postUpdateTime;
            replacementSource._setSources([
                createMockSource("source", createId(9, 32, 9), footprintSetB),
                createMockSource("source", createId(0, 0, 0), [])
            ]);
            postUpdateTime = replacementSource.updateTime;

            t.ok(preUpdateTime === postUpdateTime);
            t.end();
        });

        t.test('New source, no changes on coverage of adjacent tiles', (t) => {
            // Adding a new source should trigger an update but should not change coverage on adjacent tiles
            const replacementSource = new ReplacementSource();

            replacementSource._setSources([createMockSource("sourceA", createId(9, 32, 9), footprintSetA)]);
            const coverageTileA = replacementSource.getReplacementRegionsForTile(createId(9, 32, 9));
            const coverageTileB = replacementSource.getReplacementRegionsForTile(createId(9, 33, 9));

            t.equal(coverageTileA.length, 5);
            t.equal(coverageTileB.length, 0);

            const preUpdateTime = replacementSource.updateTime;
            replacementSource._setSources([
                createMockSource("sourceA", createId(9, 32, 9), footprintSetA),
                createMockSource("sourceB", createId(9, 33, 9), footprintSetA)
            ]);
            const postUpdateTime = replacementSource.updateTime;

            t.ok(postUpdateTime > preUpdateTime);
            t.strictSame(replacementSource.getReplacementRegionsForTile(createId(9, 32, 9)), coverageTileA);
            t.strictNotSame(replacementSource.getReplacementRegionsForTile(createId(9, 33, 9)), coverageTileB);
            t.end();
        });

        t.end();
    });

    t.end();
});
