import {expect, describe, test, vi} from '../../util/vitest';
import {ImageProvider} from '../../../src/render/image_provider';
import {ImageId} from '../../../src/style-spec/expression/types/image_id';
import {OverscaledTileID} from '../../../src/source/tile_id';
import RasterArrayTile from '../../../src/source/raster_array_tile';
import RasterArrayTileSource from '../../../src/source/raster_array_tile_source';

import type SourceCache from '../../../src/source/source_cache';
import type {MapboxRasterTile, MapboxRasterLayer} from '../../../src/data/mrt/mrt.esm.js';

describe('ImageProvider', () => {
    test('Supports RasterArrayTileSource', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const tile = new RasterArrayTile(tileID, 512, 0);

        tile._mrt = true as unknown as MapboxRasterTile;

        const mrtLayer = {
            hasBand: (bandId) => bandId === 'icon',
            hasDataForBand: (bandId) => bandId === 'icon',
            getBandView: () => ({bytes: new Uint8Array(512 * 512 * 4), tileSize: 512, buffer: 0}),
        } as unknown as MapboxRasterLayer;

        tile.getLayer = (layerId) => (layerId === 'landmarks' ? mrtLayer : null);

        const source = new RasterArrayTileSource('landmarks', {type: 'raster-array'}, null, null);

        const sourceCache = {
            loaded: vi.fn(),
            getTile: () => tile,
            getSource: () => source,
            getVisibleCoordinates: () => [tileID],
        };

        const imageProvider = new ImageProvider('landmarks', 'basemap', sourceCache as unknown as SourceCache);

        imageProvider.addPendingRequest(new ImageId('landmarks/icon'));
        imageProvider.addPendingRequest(new ImageId('landmarks/missing-icon'));

        sourceCache.loaded.mockReturnValueOnce(false);
        let images = imageProvider.resolvePendingRequests();
        expect(images.size).toBe(0);
        expect(imageProvider.hasPendingRequests()).toBe(true);

        sourceCache.loaded.mockReturnValueOnce(true);
        images = imageProvider.resolvePendingRequests();
        expect(images.size).toBe(1);
        expect(imageProvider.hasPendingRequests()).toBe(false);
        expect(imageProvider.missingRequests).toEqual(new Set(['landmarks/missing-icon']));
    });
});
