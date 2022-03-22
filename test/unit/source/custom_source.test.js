import {test} from '../../util/test.js';
import CustomSource from '../../../src/source/custom_source.js';
import Transform from '../../../src/geo/transform.js';
import {Evented} from '../../../src/util/evented.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import SourceCache from '../../../src/source/source_cache.js';

function createSource(options = {}) {
    const eventedParent = new Evented();
    const source = new CustomSource('id', options, {send() {}}, eventedParent);
    const sourceCache = new SourceCache('id', source, /* dispatcher */ {}, eventedParent);
    sourceCache.transform = new Transform();
    sourceCache.map = {painter: {transform: sourceCache.transform}};

    return {source, sourceCache, eventedParent};
}

test('CustomSource', (t) => {
    t.test('constructor', (t) => {
        const {source} = createSource({
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
        const {source, eventedParent} = createSource({
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

        const {sourceCache} = createSource({
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

        const {sourceCache, eventedParent} = createSource({loadTile, prepareTile});

        eventedParent.on('data', () => {
            t.ok(loadTile.calledOnce);
            t.ok(prepareTile.calledBefore(loadTile));
            t.end();
        });

        sourceCache.onAdd();

        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._addTile(tileID);
    });

    t.end();
});
