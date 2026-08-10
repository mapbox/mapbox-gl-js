import {describe, test, expect, vi, waitFor} from '../../util/vitest';
import RasterArrayTile from '../../../src/source/raster_array_tile';
import {OverscaledTileID} from '../../../src/source/tile_id';
import {MapboxRasterTile} from '../../../src/data/mrt/mrt.esm.js';
import {Event, Evented} from '../../../src/util/evented';
import {RGBAImage} from '../../../src/util/image';
import {mockFetch} from '../../util/network';
import {RequestManager} from '../../../src/util/mapbox';
import RasterArrayTileSource from '../../../src/source/raster_array_tile_source.js';

import type Actor from '../../../src/util/actor';
import type Dispatcher from '../../../src/util/dispatcher';
import type {Map as MapboxMap} from '../../../src/ui/map';
import type {WorkerInbox} from '../../../src/util/actor_messages.js';

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
    tile.actor = {send() { }} as unknown as Actor<WorkerInbox>;
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

    test('triggers repaint exactly once per fetch on success', () => {
        const source = createSource();
        const tile = createTile();
        const data = new RGBAImage({width: 4, height: 4});
        vi.spyOn(tile, 'fetchBandForRender').mockImplementation((sourceLayer, layerId, band, cb) => {
            cb(null, data);
        });
        vi.spyOn(tile, 'setTexturePerLayer').mockImplementation(() => {});

        source.prepareTile(tile, 'sourceLayer', 'layerId', 0);

        expect(source.map.triggerRepaint).toHaveBeenCalledTimes(1);
    });

    test('triggers repaint exactly once on error', () => {
        const source = createSource();
        const tile = createTile();
        vi.spyOn(tile, 'fetchBandForRender').mockImplementation((sourceLayer, layerId, band, cb) => {
            cb(new Error('fail'), null);
        });

        source.prepareTile(tile, 'sourceLayer', 'layerId', 0);

        expect(source.map.triggerRepaint).toHaveBeenCalledTimes(1);
    });
});

describe('RasterArrayTileSource maxzoom cascade discovery', () => {
    function privateSource() {
        return createSource() as unknown as {
            _narrowDataMaxzoom: (z: number) => void;
            getDataMaxzoom: () => number | undefined;
            maxzoom: number;
            minzoom: number;
        };
    }

    test('first 404 sets data maxzoom to failedZoom - 1', () => {
        const source = privateSource();
        source.minzoom = 0;
        source.maxzoom = 22;

        source._narrowDataMaxzoom(22);

        expect(source.getDataMaxzoom()).toBe(21);
    });

    test('subsequent 404 cascades down by one, every existing ancestor probed', () => {
        // The cascade is correct because tile coverage at midpoint zooms can be
        // non-uniform — see _dataMaxzoom field doc.
        const source = privateSource();
        source.minzoom = 0;
        source.maxzoom = 10;

        const visited: number[] = [];
        let current = source.maxzoom;
        // Simulate cascade: each step 404s at the current candidate and gets the
        // next candidate from getDataMaxzoom().
        while (current > 0) {
            source._narrowDataMaxzoom(current);
            const next = source.getDataMaxzoom() ?? 0;
            visited.push(next);
            if (next === current - 1) current = next;
            else break;
        }

        // Cascade visits every zoom level from maxzoom-1 down to minzoom.
        expect(visited).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    });

    test('does not raise maxzoom when a later 404 happens at a higher zoom', () => {
        const source = privateSource();
        source.minzoom = 0;
        source.maxzoom = 22;

        source._narrowDataMaxzoom(5); // data maxzoom -> 4
        source._narrowDataMaxzoom(8); // would imply 7, but 7 > 4, so leave at 4

        expect(source.getDataMaxzoom()).toBe(4);
    });

    test('clamps to minzoom', () => {
        const source = privateSource();
        source.minzoom = 0;
        source.maxzoom = 22;

        source._narrowDataMaxzoom(0); // can't go below minzoom

        expect(source.getDataMaxzoom()).toBe(0);
    });

    test('seeds data maxzoom from TileJSON metadata event', () => {
        const source = createSource();
        vi.spyOn(source, 'load').mockImplementation(() => {});
        source.onAdd(source.map);
        source.maxzoom = 5;

        source.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));

        expect(source.getDataMaxzoom()).toBe(5);
    });

    test('TileJSON metadata does not overwrite a narrower discovered maxzoom', () => {
        const source = createSource();
        vi.spyOn(source, 'load').mockImplementation(() => {});
        source.onAdd(source.map);
        (source as unknown as {_dataMaxzoom: number})._dataMaxzoom = 3;
        source.maxzoom = 5;

        source.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));

        expect(source.getDataMaxzoom()).toBe(3);
    });
});

describe('RasterArrayTileSource#collectOverzoomParentTileIDs', () => {
    function tile(z: number, x: number, y: number, parent?: RasterArrayTile): RasterArrayTile {
        const t = new RasterArrayTile(new OverscaledTileID(z, 0, z, x, y), 512, 0);
        if (parent) t.parentTile = parent;
        return t;
    }

    test('returns nothing when source has no overzoomed tiles and no dataMaxzoom', () => {
        const source = createSource();

        const result = source.collectOverzoomParentTileIDs({}, []);
        expect(result).toEqual([]);
    });

    test('retains the parent of each existing overzoomed tile if it is in cache', () => {
        const source = createSource();
        const parent = tile(4, 10, 10);
        const child = tile(8, 169, 162, parent);

        const tiles = {
            [parent.tileID.key]: parent,
            [child.tileID.key]: child,
        };

        const result = source.collectOverzoomParentTileIDs(tiles, []);
        expect(result).toHaveLength(1);

        expect(result[0].canonical.z).toBe(4);
    });

    test('does not retain a parent that is not in cache', () => {
        const source = createSource();
        const parent = tile(4, 10, 10);
        const child = tile(8, 169, 162, parent);

        // Note: parent NOT in cache map.
        const tiles = {
            [child.tileID.key]: child,
        };

        const result = source.collectOverzoomParentTileIDs(tiles, []);
        expect(result).toEqual([]);
    });

    test('retains parents for ideal tiles past dataMaxzoom', () => {
        const source = createSource();
        (source as unknown as {_dataMaxzoom: number})._dataMaxzoom = 4;
        const parent = tile(4, 10, 10);
        const tiles = {
            [parent.tileID.key]: parent,
        };

        const idealTileID = new OverscaledTileID(8, 0, 8, 169, 162);

        const result = source.collectOverzoomParentTileIDs(tiles, [idealTileID]);

        expect(result).toHaveLength(1);

        expect(result[0].canonical.z).toBe(4);

        expect(result[0].canonical.x).toBe(10);

        expect(result[0].canonical.y).toBe(10);
    });

    test('does not retain parents for ideal tiles at or below dataMaxzoom', () => {
        const source = createSource();
        (source as unknown as {_dataMaxzoom: number})._dataMaxzoom = 4;
        const tiles = {};

        const idealTileID = new OverscaledTileID(4, 0, 4, 10, 10);

        const result = source.collectOverzoomParentTileIDs(tiles, [idealTileID]);

        expect(result).toEqual([]);
    });
});

describe('RasterArrayTileSource#_waitForParent', () => {
    function readyParent(): RasterArrayTile {
        const parent = new RasterArrayTile(new OverscaledTileID(4, 0, 4, 10, 10), 512, 0);
        parent._mrt = new MapboxRasterTile(30);
        // Inject a non-empty layers map so _isParentReady returns true.
        (parent._mrt as unknown as {layers: Record<string, unknown>}).layers = {sample: {}};
        parent._isHeaderLoaded = true;
        parent.state = 'loaded';
        return parent;
    }

    function loadingParent(): RasterArrayTile {
        const parent = new RasterArrayTile(new OverscaledTileID(4, 0, 4, 10, 10), 512, 0);
        parent._mrt = new MapboxRasterTile(30);
        (parent._mrt as unknown as {layers: Record<string, unknown>}).layers = {};
        parent._isHeaderLoaded = false;
        parent.state = 'loading';
        return parent;
    }

    test('fires callback immediately when parent is already ready', () => {
        const source = createSource();
        const parent = readyParent();
        const cb = vi.fn();

        (source as unknown as {_waitForParent: (p: RasterArrayTile, cb: (err: Error | null) => void) => void})
            ._waitForParent(parent, cb);

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(null);
    });

    test('fires callback with error when parent is already errored', () => {
        const source = createSource();
        const parent = loadingParent();
        parent.state = 'errored';
        const cb = vi.fn();

        (source as unknown as {_waitForParent: (p: RasterArrayTile, cb: (err: Error | null) => void) => void})
            ._waitForParent(parent, cb);

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test('multiple waiters on the same parent are deduped via one listener', () => {
        const source = createSource();
        const parent = loadingParent();
        const cb1 = vi.fn();
        const cb2 = vi.fn();
        const cb3 = vi.fn();

        const wait = (source as unknown as {_waitForParent: (p: RasterArrayTile, cb: (err: Error | null) => void) => void})._waitForParent.bind(source);

        wait(parent, cb1);
        wait(parent, cb2);
        wait(parent, cb3);

        // Pending map has one entry with three callbacks queued.
        const pending = (source as unknown as {_pendingParentWaiters: Map<number, unknown[]>})._pendingParentWaiters;
        expect(pending.size).toBe(1);
        expect(pending.get(parent.uid)).toHaveLength(3);

        // Make parent ready, then fire the source's 'data' event so the queue drains.
        parent._isHeaderLoaded = true;
        parent.state = 'loaded';
        (parent._mrt as unknown as {layers: Record<string, unknown>}).layers = {sample: {}};
        source.fire(new Event('data', {dataType: 'source', tile: parent}));

        expect(cb1).toHaveBeenCalledWith(null);
        expect(cb2).toHaveBeenCalledWith(null);
        expect(cb3).toHaveBeenCalledWith(null);
        expect(pending.has(parent.uid)).toBe(false);
    });

    test('drains all waiters with an error when parent fails to load', () => {
        const source = createSource();
        const parent = loadingParent();
        const cb1 = vi.fn();
        const cb2 = vi.fn();

        const wait = (source as unknown as {_waitForParent: (p: RasterArrayTile, cb: (err: Error | null) => void) => void})._waitForParent.bind(source);
        wait(parent, cb1);
        wait(parent, cb2);

        parent.state = 'errored';
        source.fire(new Event('data', {dataType: 'source', tile: parent}));

        expect(cb1.mock.calls[0][0]).toBeInstanceOf(Error);
        expect(cb2.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test('ignores data events for unrelated tiles', () => {
        const source = createSource();
        const parent = loadingParent();
        const otherTile = new RasterArrayTile(new OverscaledTileID(4, 0, 4, 5, 5), 512, 0);
        const cb = vi.fn();

        (source as unknown as {_waitForParent: (p: RasterArrayTile, cb: (err: Error | null) => void) => void})
            ._waitForParent(parent, cb);

        // Fire 'data' for an unrelated tile.
        source.fire(new Event('data', {dataType: 'source', tile: otherTile}));
        expect(cb).not.toHaveBeenCalled();

        const pending = (source as unknown as {_pendingParentWaiters: Map<number, unknown[]>})._pendingParentWaiters;
        expect(pending.has(parent.uid)).toBe(true);
    });
});

describe('RasterArrayTileSource TileJSON integration', () => {
    function createSourceWithUrl(url: string) {
        const dispatcher = {
            send() {},
            getActor() { return {send() { return {cancel() {}}; }}; },
        } as unknown as Dispatcher;

        const source = new RasterArrayTileSource(
            'id',
            {type: 'raster-array', url},
            dispatcher,
            new Evented(),
        );

        source.onAdd({
            transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
            _getMapId: () => 1,
            _requestManager: new RequestManager(),
            _refreshExpiredTiles: true,
            style: {clearSource: () => {}},
            painter: {_terrain: null},
            getWorldview: () => undefined,
            triggerRepaint: vi.fn(),
        } as unknown as MapboxMap);

        return source;
    }

    test('primes _dataMaxzoom from the TileJSON maxzoom after metadata event', async () => {
        mockFetch({
            '/source.json': () => Promise.resolve(new Response(JSON.stringify({
                tiles: ['http://example.com/{z}/{x}/{y}.mrt'],
                minzoom: 0,
                maxzoom: 5,
            })))
        });

        const source = createSourceWithUrl('/source.json');

        // The 'metadata' event is the first 'data' event the parent fires
        // after TileJSON load (followed immediately by 'content') — the
        // listener installed in onAdd seeds _dataMaxzoom synchronously on it.
        const event = await waitFor(source, 'data') as {sourceDataType?: string};
        expect(event.sourceDataType).toBe('metadata');

        expect(source.maxzoom).toBe(5);

        expect(source.getDataMaxzoom()).toBe(5);
    });

    test('without a TileJSON maxzoom, priming falls through to the source default (22)', async () => {
        mockFetch({
            '/source.json': () => Promise.resolve(new Response(JSON.stringify({
                tiles: ['http://example.com/{z}/{x}/{y}.mrt'],
                minzoom: 0,
            })))
        });

        const source = createSourceWithUrl('/source.json');
        await waitFor(source, 'data');

        // No maxzoom in TileJSON, so this.maxzoom stays at the constructor
        // default of 22. The seed reflects that — cascade still has work to do,
        // but a high-zoom entry won't request beyond 22.

        expect(source.getDataMaxzoom()).toBe(22);
    });
});
