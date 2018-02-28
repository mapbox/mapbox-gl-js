import { test } from 'mapbox-gl-js-test';
import tileCover from '../../../src/util/tile_cover';
import { OverscaledTileID } from '../../../src/source/tile_id';

test('tileCover', (t) => {

    t.test('.cover', (t) => {
        t.test('calculates tile coverage at w = 0', (t) => {
            const z = 2,
                coords = [
                    {column: 0, row: 1, zoom: 2},
                    {column: 1, row: 1, zoom: 2},
                    {column: 1, row: 2, zoom: 2},
                    {column: 0, row: 2, zoom: 2}
                ],
                res = tileCover(z, coords, z);
            t.deepEqual(res, [new OverscaledTileID(2, 0, 2, 0, 1)]);
            t.end();
        });

        t.test('calculates tile coverage at w > 0', (t) => {
            const z = 2,
                coords = [
                    {column: 12, row: 1, zoom: 2},
                    {column: 13, row: 1, zoom: 2},
                    {column: 13, row: 2, zoom: 2},
                    {column: 12, row: 2, zoom: 2}
                ],
                res = tileCover(z, coords, z);
            t.deepEqual(res, [new OverscaledTileID(2, 3, 2, 0, 1)]);
            t.end();
        });

        t.test('calculates tile coverage at w = -1', (t) => {
            const z = 2,
                coords = [
                    {column: -1, row: 1, zoom: 2},
                    {column:  0, row: 1, zoom: 2},
                    {column:  0, row: 2, zoom: 2},
                    {column: -1, row: 2, zoom: 2}
                ],
                res = tileCover(z, coords, z);
            t.deepEqual(res, [new OverscaledTileID(2, -1, 2, 3, 1)]);
            t.end();
        });

        t.test('calculates tile coverage at w < -1', (t) => {
            const z = 2,
                coords = [
                    {column: -13, row: 1, zoom: 2},
                    {column: -12, row: 1, zoom: 2},
                    {column: -12, row: 2, zoom: 2},
                    {column: -13, row: 2, zoom: 2}
                ],
                res = tileCover(z, coords, z);
            t.deepEqual(res, [new OverscaledTileID(2, -4, 2, 3, 1)]);
            t.end();
        });

        t.test('calculates tile coverage across meridian', (t) => {
            const z = 2,
                coords = [
                    {column: -0.5, row: 1, zoom: 2},
                    {column:  0.5, row: 1, zoom: 2},
                    {column:  0.5, row: 2, zoom: 2},
                    {column: -0.5, row: 2, zoom: 2}
                ],
                res = tileCover(z, coords, z);
            t.deepEqual(res, [
                new OverscaledTileID(2, 0, 2, 0, 1),
                new OverscaledTileID(2, -1, 2, 3, 1)]);
            t.end();
        });

        t.test('only includes tiles for a single world, if renderWorldCopies is set to false', (t) => {
            const z = 2,
                coords = [
                    {column: -0.5, row: 1, zoom: 2},
                    {column:  0.5, row: 1, zoom: 2},
                    {column:  0.5, row: 2, zoom: 2},
                    {column: -0.5, row: 2, zoom: 2}
                ],
                renderWorldCopies = false,
                res = tileCover(z, coords, z, renderWorldCopies);
            t.deepEqual(res, [
                new OverscaledTileID(2, 0, 2, 0, 1)]);
            t.end();
        });

        t.end();
    });

    t.end();
});
