import { test } from 'mapbox-gl-js-test';
import TileCache from '../../../src/source/tile_cache';
import { OverscaledTileID } from '../../../src/source/tile_id';

const idA = new OverscaledTileID(10, 0, 10, 0, 1);
const idB = new OverscaledTileID(10, 0, 10, 0, 2);
const idC = new OverscaledTileID(10, 0, 10, 0, 3);
const idD = new OverscaledTileID(10, 0, 10, 0, 4);
const tileA = { tileID: idA };
const tileA2 = { tileID: idA };
const tileB = { tileID: idB };
const tileC = { tileID: idC };
const tileD = { tileID: idD };

function keysExpected(t, cache, ids) {
    t.deepEqual(cache.order, ids.map((id) => id.key), 'keys');
}

test('TileCache', (t) => {
    const cache = new TileCache(10, (removed) => {
        t.equal(removed, 'dc');
    });
    t.equal(cache.getAndRemove(idC), null, '.getAndRemove() to null');
    t.equal(cache.add(idA, tileA), cache, '.add()');
    keysExpected(t, cache, [idA]);
    t.equal(cache.has(idA), true, '.has()');
    t.equal(cache.getAndRemove(idA), tileA, '.getAndRemove()');
    t.equal(cache.getAndRemove(idA), null, '.getAndRemove()');
    t.equal(cache.has(idA), false, '.has()');
    keysExpected(t, cache, []);
    t.end();
});

test('TileCache - getWithoutRemoving', (t) => {
    const cache = new TileCache(10, () => {
        t.fail();
    });
    t.equal(cache.add(idA, tileA), cache, '.add()');
    t.equal(cache.get(idA), tileA, '.get()');
    keysExpected(t, cache, [idA]);
    t.equal(cache.get(idA), tileA, '.get()');
    t.end();
});

test('TileCache - duplicate add', (t) => {
    const cache = new TileCache(10, () => {
        t.fail();
    });

    cache.add(idA, tileA);
    cache.add(idA, tileA2);

    keysExpected(t, cache, [idA, idA]);
    t.ok(cache.has(idA));
    t.equal(cache.getAndRemove(idA), tileA);
    t.ok(cache.has(idA));
    t.equal(cache.getAndRemove(idA), tileA2);
    t.end();
});

test('TileCache - expiry', (t) => {
    const cache = new TileCache(10, (removed) => {
        t.ok(cache.has(idB));
        t.equal(removed, tileA2);
        t.end();
    });


    cache.add(idB, tileB, 0);
    cache.getAndRemove(idB);
    // removing clears the expiry timeout
    cache.add(idB);

    cache.add(idA, tileA);
    cache.add(idA, tileA2, 0); // expires immediately and `onRemove` is called.
});

test('TileCache - remove', (t) => {
    const cache = new TileCache(10, () => {});

    cache.add(idA, tileA);
    cache.add(idB, tileB);
    cache.add(idC, tileC);

    keysExpected(t, cache, [idA, idB, idC]);
    t.ok(cache.has(idB));

    cache.remove(idB);

    keysExpected(t, cache, [idA, idC]);
    t.notOk(cache.has(idB));

    t.ok(cache.remove(idB));

    t.end();
});

test('TileCache - overflow', (t) => {
    const cache = new TileCache(1, (removed) => {
        t.equal(removed, tileA);
    });
    cache.add(idA, tileA);
    cache.add(idB, tileB);

    t.ok(cache.has(idB));
    t.notOk(cache.has(idA));
    t.end();
});

test('TileCache#reset', (t) => {
    let called;
    const cache = new TileCache(10, (removed) => {
        t.equal(removed, tileA);
        called = true;
    });
    cache.add(idA, tileA);
    t.equal(cache.reset(), cache);
    t.equal(cache.has(idA), false);
    t.ok(called);
    t.end();
});

test('TileCache#setMaxSize', (t) => {
    let numRemoved = 0;
    const cache = new TileCache(10, () => {
        numRemoved++;
    });
    cache.add(idA, tileA);
    cache.add(idB, tileB);
    cache.add(idC, tileC);
    t.equal(numRemoved, 0);
    cache.setMaxSize(15);
    t.equal(numRemoved, 0);
    cache.setMaxSize(1);
    t.equal(numRemoved, 2);
    cache.add(idD, tileD);
    t.equal(numRemoved, 3);
    t.end();
});
