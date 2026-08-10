// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import RasterArrayTile from '../../../src/source/raster_array_tile';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {MapboxRasterTile} from '../../../src/data/mrt/mrt.esm.js';

function createRasterArrayTile() {
    const tile = new RasterArrayTile(new OverscaledTileID(3, 0, 2, 1, 2));
    tile._isHeaderLoaded = true;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    test('returns early for overzoomed tiles without invoking the worker', () => {
        // Build a parent at z=4 and a tile at z=8 that's a child of it.
        const tile = new RasterArrayTile(new OverscaledTileID(8, 0, 8, 169, 162));
        tile._isHeaderLoaded = true;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tile.actor = {} as Actor;
        tile._mrt = new MapboxRasterTile(30);

        const parent = new RasterArrayTile(new OverscaledTileID(4, 0, 4, 10, 10));
        parent._isHeaderLoaded = true;
        parent._mrt = new MapboxRasterTile(30);
        parent._mrt.layers = {sample: {tileSize: 256, name: 'sample'}};

        const setup = tile.setupOverzoom(parent);
        expect(setup).toBe(true);

        const cb = (err, result) => {
            expect(err).toBeNull();
            expect(result).toBeNull();
        };
        tile.fetchBand('sample', null, 0, cb);
    });
});

describe('setupOverzoom', () => {
    function parentTileWithLayers(layers: Record<string, {tileSize: number; name: string}>): RasterArrayTile {
        const parent = new RasterArrayTile(new OverscaledTileID(4, 0, 4, 10, 10));
        parent._isHeaderLoaded = true;
        parent._mrt = new MapboxRasterTile(30);
        parent._mrt.layers = layers;
        return parent;
    }

    test('returns false when parent MRT has no layers', () => {
        const tile = new RasterArrayTile(new OverscaledTileID(8, 0, 8, 169, 162));
        const parent = parentTileWithLayers({});

        const result = tile.setupOverzoom(parent);

        expect(result).toBe(false);
        expect(tile.parentTile).toBeNull();
        expect(tile.overzoomCoordsPerLayer).toBeNull();
    });

    test('computes one entry per layer, keyed by layer name', () => {
        const tile = new RasterArrayTile(new OverscaledTileID(8, 0, 8, 169, 162));
        const parent = parentTileWithLayers({
            wind: {tileSize: 256, name: 'wind'},
            temp: {tileSize: 512, name: 'temp'},
        });

        const result = tile.setupOverzoom(parent);

        expect(result).toBe(true);
        expect(tile.overzoomCoordsPerLayer).not.toBeNull();
        expect(tile.overzoomCoordsPerLayer.size).toBe(2);
        expect(tile.overzoomCoordsPerLayer.has('wind')).toBe(true);
        expect(tile.overzoomCoordsPerLayer.has('temp')).toBe(true);
    });

    test('layers with different tileSizes get different offset/tileSize', () => {
        const tile = new RasterArrayTile(new OverscaledTileID(8, 0, 8, 169, 162));
        const parent = parentTileWithLayers({
            small: {tileSize: 256, name: 'small'},
            large: {tileSize: 512, name: 'large'},
        });

        tile.setupOverzoom(parent);

        const small = tile.overzoomCoordsPerLayer.get('small');
        const large = tile.overzoomCoordsPerLayer.get('large');

        // deltaZ = 4. For tileSize=256: outTileSize=16, offset=[9*16, 2*16]=[144, 32].
        // For tileSize=512: outTileSize=32, offset=[9*32, 2*32]=[288, 64].
        expect(small.tileSize).toBe(16);
        expect(small.offset).toEqual([144, 32]);
        expect(large.tileSize).toBe(32);
        expect(large.offset).toEqual([288, 64]);
    });

    test('shares MRT data with root tile and marks header loaded', () => {
        const tile = new RasterArrayTile(new OverscaledTileID(8, 0, 8, 169, 162));
        const parent = parentTileWithLayers({wind: {tileSize: 256, name: 'wind'}});

        expect(tile._isHeaderLoaded).toBe(false);
        tile.setupOverzoom(parent);

        expect(tile._isHeaderLoaded).toBe(true);
        expect(tile._mrt).toBe(parent._mrt);
        expect(tile.parentTile).toBe(parent);
    });

    test('walks parent chain to the root data tile', () => {
        // Build chain: tile -> intermediate (overzoomed) -> root
        const root = parentTileWithLayers({wind: {tileSize: 256, name: 'wind'}});
        const intermediate = new RasterArrayTile(new OverscaledTileID(6, 0, 6, 42, 40));
        intermediate.parentTile = root;
        intermediate._mrt = root._mrt;
        intermediate._isHeaderLoaded = true;

        const tile = new RasterArrayTile(new OverscaledTileID(8, 0, 8, 169, 162));
        tile.setupOverzoom(intermediate);

        // Should resolve to the root, not the intermediate.
        expect(tile.parentTile).toBe(root);
    });
});

describe('cropBandData', () => {
    test('extracts a 4x4 region from a 16x16 + buffer parent at offset [4, 4]', () => {
        const tile = new RasterArrayTile(new OverscaledTileID(8, 0, 8, 169, 162));

        // Build an 18x18 RGBA byte buffer (16 + 2*1 buffer), each pixel value = row * 18 + col.
        // We crop a 6x6 region (4 + 2*1 buffer) starting at offset [4, 4].
        const parentTileSize = 16;
        const buffer = 1;
        const childTileSize = 4;
        const parentDim = parentTileSize + 2 * buffer;
        const bytes = new Uint8Array(parentDim * parentDim * 4);
        for (let row = 0; row < parentDim; row++) {
            for (let col = 0; col < parentDim; col++) {
                const pixelId = row * parentDim + col;
                for (let c = 0; c < 4; c++) {
                    bytes[(row * parentDim + col) * 4 + c] = pixelId & 0xff;
                }
            }
        }

        const cropped = tile.cropBandData(bytes, parentTileSize, buffer, {
            offset: [4, 4],
            tileSize: childTileSize,
            deltaZ: 2,
        });

        // Output is 6x6 RGBA = 144 bytes
        expect(cropped.length).toBe((childTileSize + 2 * buffer) ** 2 * 4);
        // Top-left pixel of cropped region corresponds to (row=4, col=4) of parent.
        expect(cropped[0]).toBe((4 * parentDim + 4) & 0xff);
    });
});
