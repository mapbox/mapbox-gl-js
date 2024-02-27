import {describe, test, expect, vi} from "../../util/vitest.js";
import CustomSource from '../../../src/source/custom_source.js';
import Transform from '../../../src/geo/transform.js';
import {Evented} from '../../../src/util/evented.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import SourceCache from '../../../src/source/source_cache.js';

function createSource(options = {}) {
    const transform = new Transform();

    const eventedParent = new Evented();
    eventedParent.style = {clearSource: vi.fn(() => {})};
    eventedParent.painter = {transform};
    eventedParent.transform = transform;

    const source = new CustomSource('id', options, {send() {}}, eventedParent);
    source.loadTileData = vi.fn(() => {});

    const sourceCache = new SourceCache('id', source, /* dispatcher */ {}, eventedParent);
    sourceCache.transform = eventedParent.transform;

    return {source, sourceCache, eventedParent};
}

describe('CustomSource', () => {
    test('constructor', async () => {
        const {source} = createSource({
            async loadTile() {}
        });

        expect(source.scheme).toEqual('xyz');
        expect(source.minzoom).toEqual(0);
        expect(source.maxzoom).toEqual(22);
        expect(source.tileSize).toEqual(512);
        expect(source.roundZoom).toEqual(true);

        await new Promise(resolve => {
            source.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                    resolve();
                }
            });

            source.onAdd();

        });
    });

    test('respects bounds', async () => {
        const {source, eventedParent} = createSource({
            async loadTile() {},
            bounds: [-47, -7, -45, -5]
        });

        await new Promise(resolve => {
            source.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                    expect(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132))).toBeFalsy();  // returns false for tiles outside bounds
                    expect(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132))).toBeTruthy(); // returns true for tiles inside bounds
                    resolve();
                }
            });

            source.onAdd(eventedParent);
        });
    });

    test('fires "dataloading" event', async () => {
        const {source, eventedParent} = createSource({
            async loadTile() {}
        });

        let dataloadingFired = false;
        eventedParent.on('dataloading', () => {
            dataloadingFired = true;
        });

        await new Promise(resolve => {
            source.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                    if (!dataloadingFired) expect.unreachable('no "dataloading" event was fired');
                    resolve();
                }
            });

            source.onAdd(eventedParent);
        });
    });

    test('loadTile throws', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const loadTile = vi.fn(async () => {
            throw new Error('Error loading tile');
        });

        const {source, sourceCache, eventedParent} = createSource({loadTile});
        source.loadTileData.mockImplementation(() => {});

        await new Promise(resolve => {
            eventedParent.on('error', (err) => {
                expect(err.error.message).toEqual('Error loading tile');
                expect(loadTile).toHaveBeenCalledTimes(1);
                expect(source.loadTileData).not.toHaveBeenCalled(); // loadTileData must not be called if loadTile throws
                expect(sourceCache._tiles[tileID.key].state).toEqual('errored'); //  tile must be in the `errored` state if `loadTile` throws
                resolve();
            });

            sourceCache.onAdd();
            sourceCache._addTile(tileID);
        });
    });

    test('loadTile resolves to ImageData', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const expectedData = new window.ImageData(512, 512);

        const loadTile = vi.fn(async () => expectedData);
        const {source, sourceCache, eventedParent} = createSource({loadTile});

        source.loadTileData.mockImplementation((tile, actualData) => {
            expect(actualData).toEqual(expectedData);
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.dataType === 'source' && e.tile) {
                    expect(loadTile).toHaveBeenCalledTimes(1);
                    expect(source.loadTileData).toHaveBeenCalledTimes(1);
                    expect(sourceCache._tiles[tileID.key].state).toEqual('loaded');
                    resolve();
                }
            });

            sourceCache.onAdd();
            sourceCache._addTile(tileID);
        });
    });

    test('loadTile resolves to undefined', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const loadTile = vi.fn(async () => {
            return undefined;
        });

        const {source, sourceCache, eventedParent} = createSource({loadTile});
        source.loadTileData.mockImplementation(() => {});

        await new Promise(resolve => {
            eventedParent.on('data', e => {
                if (e.dataType === 'source' && e.tile) {
                    expect(loadTile).toHaveBeenCalledTimes(1);
                    expect(source.loadTileData).not.toHaveBeenCalled();
                    expect(sourceCache._tiles[tileID.key].state).toEqual('errored');
                    resolve();
                }
            });

            sourceCache.onAdd();
            sourceCache._addTile(tileID);
        });
    });

    test('loadTile resolves to null', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const loadTile = vi.fn(async () => null);

        const {source, sourceCache, eventedParent} = createSource({loadTile});
        source.loadTileData.mockImplementation((tile, actualData) => {
            const expectedData = {width: source.tileSize, height: source.tileSize, data: null};
            expect(actualData).toEqual(expectedData);
        });

        await new Promise(resolve => {
            eventedParent.on('data', e => {
                if (e.dataType === 'source' && e.tile) {
                    expect(loadTile).toHaveBeenCalledTimes(1);
                    expect(source.loadTileData).toHaveBeenCalledTimes(1);
                    expect(sourceCache._tiles[tileID.key].state).toEqual('loaded');
                    resolve();
                }
            });
            sourceCache.onAdd();
            sourceCache._addTile(tileID);
        });
    });

    test('loadTile aborts', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        await new Promise(resolve => {

            const loadTile = vi.fn(async (tile, {signal}) => {
                const {x, y, z} = tileID.canonical;
                expect(tile).toEqual({x, y, z});
                expect(signal).toBeTruthy();
                signal.addEventListener('abort', () => {
                    resolve(); // AbortSignal was aborted
                });
            });

            const {sourceCache} = createSource({loadTile});

            sourceCache.onAdd();
            const tile = sourceCache._addTile(tileID);
            sourceCache._abortTile(tile);
        });
    });

    test('hasTile', async () => {
        const {sourceCache, eventedParent} = createSource({
            loadTile: async () => {},
            hasTile: (tileID) => tileID.x !== 0
        });

        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    expect(sourceCache.getIds().sort()).toEqual([
                        new OverscaledTileID(1, 0, 1, 1, 0).key,
                        new OverscaledTileID(1, 0, 1, 1, 1).key
                    ].sort());
                    resolve();
                }
            });
            sourceCache.used = true;
            sourceCache.getSource().onAdd();
        });

    });

    test('coveringTiles', async () => {
        class CustomSource {
            async loadTile() {}
        }

        const customSource = new CustomSource();
        const {sourceCache, eventedParent} = createSource(customSource);

        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    const coveringTiles = customSource.coveringTiles();
                    expect(coveringTiles).toEqual([{x: 0, y: 0, z: 0}]);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd({transform});
        });
    });

    test('clearTiles', () => {
        class CustomSource {
            async loadTile() {}
        }

        const customSource = new CustomSource();
        const {source, eventedParent} = createSource(customSource);

        source.onAdd(eventedParent);
        customSource.clearTiles();

        expect(eventedParent.style.clearSource).toHaveBeenCalledTimes(1);
    });

    test('update', async () => {
        class CustomSource {
            async loadTile() {}
        }

        const customSource = new CustomSource();
        const {eventedParent} = createSource(customSource);

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'content') {
                    resolve();
                }
            });
            customSource.update();
        });

    });
});
