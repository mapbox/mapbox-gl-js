import {describe, test, expect} from '../../util/vitest';
import Tile from '../../../src/source/tile';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {getDebugTileLabel} from '../../../src/render/draw_debug';

function createTile(): Tile {
    return new Tile(new OverscaledTileID(3, 0, 2, 1, 2), 512, 3);
}

describe('getDebugTileLabel', () => {
    test('returns null when no label option is on', () => {
        const tile = createTile();
        expect(getDebugTileLabel(tile, tile.tileID, false, false, null)).toEqual(null);
    });

    test('shows n/a timestamps for a tile without headers', () => {
        const tile = createTile();
        expect(getDebugTileLabel(tile, tile.tileID, false, true, null)).toEqual([
            '2/1/2 => 3',
            'modified: n/a',
            'expires: n/a'
        ]);
    });

    test('shows the Last-Modified and expiration times', () => {
        const tile = createTile();
        tile.setExpiryData({lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT', expires: 'Thu, 22 Oct 2015 07:28:00 GMT'});
        expect(getDebugTileLabel(tile, tile.tileID, false, true, null)).toEqual([
            '2/1/2 => 3',
            'modified: 2015-10-21T07:28:00Z',
            'expires: 2015-10-22T07:28:00Z'
        ]);
    });

    test('shows the light brightness', () => {
        const tile = createTile();
        expect(getDebugTileLabel(tile, tile.tileID, false, false, 0.456)).toEqual([
            '2/1/2 => 3',
            'brightness: 0.46'
        ]);
    });

    test('adds the parse status to the first line', () => {
        const tile = createTile();
        expect(getDebugTileLabel(tile, tile.tileID, true, false, 0)).toEqual([
            '2/1/2 => 3 loading 0kb',
            'brightness: 0.00'
        ]);
    });
});
