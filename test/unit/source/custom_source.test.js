import {test} from '../../util/test.js';
import CustomSource from '../../../src/source/custom_source.js';
import Transform from '../../../src/geo/transform.js';
import {Evented} from '../../../src/util/evented.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import SourceCache from '../../../src/source/source_cache.js';
import window from '../../../src/util/window.js';

function createSource(t, options = {}) {
    const transform = new Transform();

    const eventedParent = new Evented();
    eventedParent.painter = {transform};
    eventedParent.transform = transform;

    const source = new CustomSource('id', options, {send() {}}, eventedParent);
    source.loadTileData = t.stub();

    const sourceCache = new SourceCache('id', source, /* dispatcher */ {}, eventedParent);
    sourceCache.transform = eventedParent.transform;

    return {source, sourceCache, eventedParent};
}

test('CustomSource', (t) => {
    t.test('constructor', (t) => {
        const {source} = createSource(t, {
            async loadTile() {}
        });

        t.equal(source.scheme, 'xyz');
        t.equal(source.minzoom, 0);
        t.equal(source.maxzoom, 22);
        t.equal(source.tileSize, 512);
        t.equal(source.roundZoom, true);

        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                t.end();
            }
        });

        source.onAdd();
    });

    t.test('respects bounds', (t) => {
        const {source, eventedParent} = createSource(t, {
            async loadTile() {},
            bounds: [-47, -7, -45, -5]
        });

        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                t.false(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132)), 'returns false for tiles outside bounds');
                t.true(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132)), 'returns true for tiles inside bounds');
                t.end();
            }
        });

        source.onAdd(eventedParent);
    });

    t.test('fires "dataloading" event', (t) => {
        const {source, eventedParent} = createSource(t, {
            async loadTile() {}
        });

        let dataloadingFired = false;
        eventedParent.on('dataloading', () => {
            dataloadingFired = true;
        });

        source.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                if (!dataloadingFired) t.fail('no "dataloading" event was fired');
                t.end();
            }
        });

        source.onAdd(eventedParent);
    });

    t.test('loadTile throws', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const loadTile = t.spy(async () => {
            throw new Error('Error loading tile');
        });

        const {source, sourceCache, eventedParent} = createSource(t, {loadTile});
        source.loadTileData.callsFake(() => {});

        eventedParent.on('error', (err) => {
            t.equal(err.error.message, 'Error loading tile');
            t.ok(loadTile.calledOnce, 'loadTile must be called');
            t.equal(source.loadTileData.callCount, 0, 'loadTileData must not be called if loadTile throws');
            t.equal(sourceCache._tiles[tileID.key].state, 'errored', 'tile must be in the `errored` state if `loadTile` throws');
            t.end();
        });

        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('loadTile resolves to ImageData', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const expectedData = new window.ImageData(512, 512);

        const loadTile = t.spy(async (tile, {signal}) => {
            const {x, y, z} = tileID.canonical;
            t.deepEqual(tile, {x, y, z});
            t.ok(signal, 'AbortSignal is present in loadTile');
            return expectedData;
        });

        const {source, sourceCache, eventedParent} = createSource(t, {loadTile});

        source.loadTileData.callsFake((tile, actualData) => {
            t.equal(actualData, expectedData, 'loadTileData must be called with the data returned by the loadTile');
        });

        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.tile) {
                t.ok(loadTile.calledOnce, 'loadTile must be called');
                t.equal(source.loadTileData.callCount, 1, 'loadTileData must be called if loadTile resolves to ImageData');
                t.equal(sourceCache._tiles[tileID.key].state, 'loaded', 'tile must be in the `loaded` state if `loadTile` resolves to ImageData');
                t.end();
            }
        });

        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('loadTile resolves to undefined', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const loadTile = t.spy(async () => {
            return undefined;
        });

        const {source, sourceCache, eventedParent} = createSource(t, {loadTile});
        source.loadTileData.callsFake(() => {});

        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.tile) {
                t.ok(loadTile.calledOnce, 'loadTile must be called');
                t.equal(source.loadTileData.callCount, 0, 'loadTileData must not be called if loadTile resolves to undefined');
                t.equal(sourceCache._tiles[tileID.key].state, 'errored', 'tile must be in the `errored` state if `loadTile` resolves to undefined');
                t.end();
            }
        });

        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('loadTile resolves to null', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const loadTile = t.spy(async (tile, {signal}) => {
            const {x, y, z} = tileID.canonical;
            t.deepEqual(tile, {x, y, z});
            t.ok(signal, 'AbortSignal is present in loadTile');
            return null;
        });

        const {source, sourceCache, eventedParent} = createSource(t, {loadTile});
        source.loadTileData.callsFake((tile, actualData) => {
            const expectedData = {width: source.tileSize, height: source.tileSize, data: null};
            t.deepEqual(actualData, expectedData, 'loadTileData must be called with an empty tile data if `loadTile` resolves to null');
        });

        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.tile) {
                t.ok(loadTile.calledOnce, 'loadTile must be called');
                t.equal(source.loadTileData.callCount, 1, 'loadTileData must be called if loadTile resolves to null');
                t.equal(sourceCache._tiles[tileID.key].state, 'loaded', 'tile must be in the `loaded` state if `loadTile` resolves to null');
                t.end();
            }
        });

        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('loadTile aborts', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const loadTile = t.spy(async (tile, {signal}) => {
            t.ok(signal, 'AbortSignal is present in loadTile');
            signal.addEventListener('abort', () => {
                t.pass('AbortSignal was aborted');
                t.end();
            });
        });

        const {sourceCache} = createSource(t, {loadTile});

        sourceCache.onAdd();
        const tile = sourceCache._addTile(tileID);
        sourceCache._abortTile(tile);
    });

    t.test('prepareTile does not change the tile data if it returns undefined', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const expectedData = new window.ImageData(512, 512);

        const loadTile = t.spy(async (tile, {signal}) => {
            const {x, y, z} = tileID.canonical;
            t.deepEqual(tile, {x, y, z});
            t.ok(signal, 'AbortSignal is present in loadTile');
            return expectedData;
        });

        const prepareTile = t.spy((tile) => {
            const {x, y, z} = tileID.canonical;
            t.deepEqual(tile, {x, y, z});
        });

        const {source, sourceCache, eventedParent} = createSource(t, {loadTile, prepareTile});

        source.loadTileData.callsFake((tile, actualData) => {
            t.equal(actualData, expectedData, 'loadTileData must be called with the data returned by the loadTile');
        });

        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.tile) {
                t.ok(prepareTile.calledBefore(loadTile), 'prepareTile must be called before loadTile');
                t.ok(loadTile.calledOnce, 'loadTile must be called');
                t.equal(source.loadTileData.callCount, 1);
                t.end();
            }
        });

        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('loadTile is not called if prepareTile returns data', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const loadTile = t.spy();
        const prepareTile = t.spy((tile) => {
            const {x, y, z} = tileID.canonical;
            t.deepEqual(tile, {x, y, z});
            return new window.ImageData(512, 512);
        });

        const {sourceCache} = createSource(t, {loadTile, prepareTile});

        sourceCache.onAdd();
        sourceCache._addTile(tileID);

        t.ok(prepareTile.calledOnce, 'prepareTile must be called');
        t.notOk(loadTile.calledOnce, 'loadTile must be called');
        t.equal(sourceCache._tiles[tileID.key].state, 'loaded', 'tile must be in the loaded state');
        t.end();
    });

    t.test('prepareTile updates the tile data if it returns valid tile data', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const tileCache = {};
        const unmodifiedData = new window.ImageData(512, 512);
        const modifiedData = new window.ImageData(512, 512);

        const loadTile = t.spy(async ({x, y, z}) => {
            tileCache[`${z}/${x}/${y}`] = unmodifiedData;
            return unmodifiedData;
        });

        const prepareTile = t.spy(({x, y, z}) => {
            const data = tileCache[`${z}/${x}/${y}`];
            if (!data) return;
            return modifiedData;
        });

        const {source, sourceCache, eventedParent} = createSource(t, {loadTile, prepareTile});

        source.loadTileData.onFirstCall().callsFake((tile, actualData) => {
            t.equal(actualData, unmodifiedData, 'loadTileData must be called with the data returned by the loadTile');
        });

        source.loadTileData.onSecondCall().callsFake((tile, actualData) => {
            t.ok(loadTile.calledOnce, 'loadTile must be called once');
            t.equal(actualData, modifiedData, 'loadTileData must be called with the data returned by the prepareTile');
            t.end();
        });

        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.tile) {
                t.ok(prepareTile.calledBefore(loadTile), 'prepareTile must be called before loadTile');
                sourceCache._addTile(tileID);
            }
        });

        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('prepareTile removes the tile data if it returns null', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const originalData = new window.ImageData(512, 512);
        const loadTile = t.spy(async () => originalData);

        const prepareTile = t.stub()
            // Do nothing on first call
            .onFirstCall().returns(undefined)
            // Return original image on second call
            .onSecondCall().returns(originalData);

        const {source, sourceCache, eventedParent} = createSource(t, {loadTile, prepareTile});

        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.tile) {
                sourceCache._addTile(tileID);
            }
        });

        source.loadTileData.onFirstCall().callsFake((tile, actualData) => {
            t.equal(actualData, originalData, 'loadTileData must be called with the data returned by the loadTile');
        });

        source.loadTileData.onSecondCall().callsFake((tile, actualData) => {
            t.equal(actualData, originalData, 'loadTileData must be called with the original image if prepareTile returns valid data');
            t.ok(loadTile.calledOnce, 'loadTile must be called once');
            t.end();
        });

        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('hasTile', (t) => {
        const {sourceCache, eventedParent} = createSource(t, {
            loadTile: async () => {},
            hasTile: (tileID) => tileID.x !== 0
        });

        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        eventedParent.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds().sort(), [
                    new OverscaledTileID(1, 0, 1, 1, 0).key,
                    new OverscaledTileID(1, 0, 1, 1, 1).key
                ].sort());
                t.end();
            }
        });

        sourceCache.used = true;
        sourceCache.getSource().onAdd();
    });

    t.test('coveringTiles', (t) => {
        class CustomSource {
            async loadTile() {}
        }

        const customSource = new CustomSource();
        const {sourceCache, eventedParent} = createSource(t, customSource);

        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        eventedParent.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                const coveringTiles = customSource.coveringTiles();
                t.deepEqual(coveringTiles, [{x: 0, y: 0, z: 0}]);
                t.end();
            }
        });

        sourceCache.getSource().onAdd({transform});
    });

    t.test('update', (t) => {
        class CustomSource {
            async loadTile() {}
        }

        const customSource = new CustomSource();
        const {eventedParent} = createSource(t, customSource);

        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'content') {
                t.ok(true);
                t.end();
            }
        });

        customSource.update();
    });

    t.end();
});
