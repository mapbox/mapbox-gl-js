// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import RasterArrayTile from '../../../src/source/raster_array_tile';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {MapboxRasterTile} from '../../../src/data/mrt/mrt.esm.js';

function createRasterArrayTile() {
    const tile = new RasterArrayTile(new OverscaledTileID(3, 0, 2, 1, 2));
    tile._isHeaderLoaded = true;
    tile.actor = {} as Actor;
    tile._mrt = new MapboxRasterTile(30);

    return tile;
}

describe('fetchBand', () => {
    test('Unknown source layer throws error if tile is not reloading', () => {
        const tile = createRasterArrayTile();
        expect(() => tile.fetchBand('unknown-source-layer', null, 'band', () => {})).toThrowError();
    });

    test('Unknown source layer does not throw error if tile is reloading', () => {
        const tile = createRasterArrayTile();
        tile.state = 'reloading';
        expect(() => tile.fetchBand('unknown-source-layer', null, 'band', () => {})).not.toThrowError();

    });
});
