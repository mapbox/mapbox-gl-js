import {test} from '../../util/test';
import tileCover from '../../../src/util/tile_cover';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate';
import {OverscaledTileID} from '../../../src/source/tile_id';

test('tileCover', (t) => {

    t.test('.cover', (t) => {
        t.test('calculates tile coverage at w = 0', (t) => {
            const z = 2,
                coords = [
                    new MercatorCoordinate(0, 0.25),
                    new MercatorCoordinate(0.25, 0.25),
                    new MercatorCoordinate(0.25, 0.5),
                    new MercatorCoordinate(0, 0.5)
                ],
                res = tileCover(z, coords, z);
            t.deepEqual(res, [new OverscaledTileID(2, 0, 2, 0, 1)]);
            t.end();
        });

        t.test('calculates tile coverage at w > 0', (t) => {
            const z = 2,
                coords = [
                    new MercatorCoordinate(3, 0.25),
                    new MercatorCoordinate(3.25, 0.25),
                    new MercatorCoordinate(3.25, 0.5),
                    new MercatorCoordinate(3, 0.5)
                ],
                res = tileCover(z, coords, z);
            t.deepEqual(res, [new OverscaledTileID(2, 3, 2, 0, 1)]);
            t.end();
        });

        t.test('calculates tile coverage at w = -1', (t) => {
            const z = 2,
                coords = [
                    new MercatorCoordinate(-0.25, 0.25),
                    new MercatorCoordinate(0, 0.25),
                    new MercatorCoordinate(0, 0.5),
                    new MercatorCoordinate(-0.25, 0.5)
                ],
                res = tileCover(z, coords, z);
            t.deepEqual(res, [new OverscaledTileID(2, -1, 2, 3, 1)]);
            t.end();
        });

        t.test('calculates tile coverage at w < -1', (t) => {
            const z = 2,
                coords = [
                    new MercatorCoordinate(-3.25, 0.25),
                    new MercatorCoordinate(-3, 0.25),
                    new MercatorCoordinate(-3, 0.5),
                    new MercatorCoordinate(-3.25, 0.5)
                ],
                res = tileCover(z, coords, z);
            t.deepEqual(res, [new OverscaledTileID(2, -4, 2, 3, 1)]);
            t.end();
        });

        t.test('calculates tile coverage across meridian', (t) => {
            const z = 2,
                coords = [
                    new MercatorCoordinate(-0.125, 0.25),
                    new MercatorCoordinate(0.125, 0.25),
                    new MercatorCoordinate(0.125, 0.5),
                    new MercatorCoordinate(-0.125, 0.5)
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
                    new MercatorCoordinate(-0.125, 0.25),
                    new MercatorCoordinate(0.125, 0.25),
                    new MercatorCoordinate(0.125, 0.5),
                    new MercatorCoordinate(-0.125, 0.5)
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
