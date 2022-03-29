import {test} from '../../util/test.js';
import CustomSource from '../../../src/source/custom_source.js';
import Transform from '../../../src/geo/transform.js';
import {Evented} from '../../../src/util/evented.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import SourceCache from '../../../src/source/source_cache.js';

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

    t.test('loadTile', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const {sourceCache} = createSource(t, {
            async loadTile(tile, {signal}) {
                const {x, y, z} = tileID.canonical;
                t.deepEqual(tile, {x, y, z});
                t.ok(signal, 'AbortSignal is present in loadTile');
                t.end();
            }
        });

        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('prepareTile', (t) => {
        const loadTile = t.spy(async () => {});
        const prepareTile = t.spy();

        const {source, sourceCache, eventedParent} = createSource(t, {loadTile, prepareTile});

        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.tile) {
                t.ok(loadTile.calledOnce, 'loadTile must be called');
                t.ok(prepareTile.calledBefore(loadTile), 'prepareTile must be called before loadTile');
                t.equal(source.loadTileData.callCount, 1);
                t.end();
            }
        });

        sourceCache.onAdd(eventedParent);
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._addTile(tileID);
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
