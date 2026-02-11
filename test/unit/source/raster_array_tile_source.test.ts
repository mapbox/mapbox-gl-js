import {describe, test, expect, vi} from '../../util/vitest';
import RasterArrayTileSource from '../../../src/source/raster_array_tile_source';
import RasterArrayTile from '../../../src/source/raster_array_tile';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {MapboxRasterTile} from '../../../src/data/mrt/mrt.esm.js';
import {Evented} from '../../../src/util/evented';
import {RGBAImage} from '../../../src/util/image';

import type Actor from '../../../src/util/actor';
import type Dispatcher from '../../../src/util/dispatcher';
import type {Map as MapboxMap} from '../../../src/ui/map';

function createSource() {
    const source = new RasterArrayTileSource(
        'test-id',
        {type: 'raster-array', tileSize: 512},
        {send() {}, getActor() { return {send() {}}; }} as unknown as Dispatcher,
        new Evented()
    );

    source.map = {
        triggerRepaint: vi.fn(),
        painter: {_terrain: null},
        style: {getSourceCache: () => null},
    } as unknown as MapboxMap;

    return source;
}

function createTile() {
    const tile = new RasterArrayTile(new OverscaledTileID(3, 0, 2, 1, 2), 512, 0);
    tile._isHeaderLoaded = true;
    tile.actor = {send() {}} as unknown as Actor;
    tile._mrt = new MapboxRasterTile(30);
    return tile;
}

describe('RasterArrayTileSource#prepareTile', () => {
    test('skips fetch when header is not loaded', () => {
        const source = createSource();
        const tile = createTile();
        tile._isHeaderLoaded = false;
        vi.spyOn(tile, 'fetchBandForRender');

        source.prepareTile(tile, 'sourceLayer', 'layerId', 0);

        expect(tile.fetchBandForRender).not.toHaveBeenCalled();
        expect(source.map.triggerRepaint).not.toHaveBeenCalled();
    });

    test('keeps state as reloading when fetch returns no data', () => {
        const source = createSource();
        const tile = createTile();
        tile.state = 'loaded';
        vi.spyOn(tile, 'fetchBandForRender').mockImplementation((sourceLayer, layerId, band, cb) => {
            cb(null, null);
        });

        source.prepareTile(tile, 'sourceLayer', 'layerId', 0);

        expect(tile.state).toBe('reloading');
    });

    test('does not set state to reloading for empty tiles', () => {
        const source = createSource();
        const tile = createTile();
        tile.state = 'empty';
        vi.spyOn(tile, 'fetchBandForRender').mockImplementation((sourceLayer, layerId, band, cb) => {
            cb(null, null);
        });

        source.prepareTile(tile, 'sourceLayer', 'layerId', 0);

        expect(tile.state).toBe('empty');
    });

    test('always triggers repaint after fetch — even with no data', () => {
        const source = createSource();
        const tile = createTile();
        vi.spyOn(tile, 'fetchBandForRender').mockImplementation((sourceLayer, layerId, band, cb) => {
            cb(null, null);
        });

        source.prepareTile(tile, 'sourceLayer', 'layerId', 0);

        expect(source.map.triggerRepaint).toHaveBeenCalledTimes(1);
    });

    test('sets tile state to errored and fires event on error', () => {
        const source = createSource();
        const tile = createTile();
        vi.spyOn(tile, 'fetchBandForRender').mockImplementation((sourceLayer, layerId, band, cb) => {
            cb(new Error('fail'), null);
        });

        source.prepareTile(tile, 'sourceLayer', 'layerId', 0);

        expect(tile.state).toBe('errored');
        expect(source.map.triggerRepaint).toHaveBeenCalled();
    });

    test('sets texture and state to loaded on success', () => {
        const source = createSource();
        const tile = createTile();
        const data = new RGBAImage({width: 4, height: 4});
        vi.spyOn(tile, 'fetchBandForRender').mockImplementation((sourceLayer, layerId, band, cb) => {
            cb(null, data);
        });
        vi.spyOn(tile, 'setTexturePerLayer').mockImplementation(() => {});

        source.prepareTile(tile, 'sourceLayer', 'layerId', 0);

        expect(tile.state).toBe('loaded');
        expect(tile.setTexturePerLayer).toHaveBeenCalledWith('layerId', data, source.map.painter);
        expect(source.map.triggerRepaint).toHaveBeenCalled();
    });
});
