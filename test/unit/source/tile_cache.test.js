import {test, expect} from "../../util/vitest.js";
import TileCache from '../../../src/source/tile_cache.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';

const idA = new OverscaledTileID(10, 0, 10, 0, 1);
const idB = new OverscaledTileID(10, 0, 10, 0, 2);
const idC = new OverscaledTileID(10, 0, 10, 0, 3);
const idD = new OverscaledTileID(10, 0, 10, 0, 4);
const tileA = {tileID: idA};
const tileA2 = {tileID: idA};
const tileB = {tileID: idB};
const tileC = {tileID: idC};
const tileD = {tileID: idD};

function keysExpected(cache, ids) {
    expect(cache.order).toEqual(ids.map((id) => id.key));
}

test('TileCache', () => {
    const cache = new TileCache(10, (removed) => {
        expect(removed).toEqual('dc');
    });
    expect(cache.getAndRemove(idC)).toEqual(null);
    expect(cache.add(idA, tileA)).toEqual(cache);
    keysExpected(cache, [idA]);
    expect(cache.has(idA)).toEqual(true);
    expect(cache.getAndRemove(idA)).toEqual(tileA);
    expect(cache.getAndRemove(idA)).toEqual(null);
    expect(cache.has(idA)).toEqual(false);
    keysExpected(cache, []);
});

test('TileCache - getWithoutRemoving', () => {
    const cache = new TileCache(10, () => {
        expect.unreachable();
    });
    expect(cache.add(idA, tileA)).toEqual(cache);
    expect(cache.get(idA)).toEqual(tileA);
    keysExpected(cache, [idA]);
    expect(cache.get(idA)).toEqual(tileA);
});

test('TileCache - duplicate add', () => {
    const cache = new TileCache(10, () => {
        expect.unreachable();
    });

    cache.add(idA, tileA);
    cache.add(idA, tileA2);

    keysExpected(cache, [idA, idA]);
    expect(cache.has(idA)).toBeTruthy();
    expect(cache.getAndRemove(idA)).toEqual(tileA);
    expect(cache.has(idA)).toBeTruthy();
    expect(cache.getAndRemove(idA)).toEqual(tileA2);
});

test('TileCache - expiry', () => {
    const cache = new TileCache(10, (removed) => {
        expect(cache.has(idB)).toBeTruthy();
        expect(removed).toEqual(tileA2);
    });

    cache.add(idB, tileB, 0);
    cache.getAndRemove(idB);
    // removing clears the expiry timeout
    cache.add(idB);

    cache.add(idA, tileA);
    cache.add(idA, tileA2, 0); // expires immediately and `onRemove` is called.
});

test('TileCache - remove', () => {
    const cache = new TileCache(10, () => {});

    cache.add(idA, tileA);
    cache.add(idB, tileB);
    cache.add(idC, tileC);

    keysExpected(cache, [idA, idB, idC]);
    expect(cache.has(idB)).toBeTruthy();

    cache.remove(idB);

    keysExpected(cache, [idA, idC]);
    expect(cache.has(idB)).toBeFalsy();

    expect(cache.remove(idB)).toBeTruthy();
});

test('TileCache - overflow', () => {
    const cache = new TileCache(1, (removed) => {
        expect(removed).toEqual(tileA);
    });
    cache.add(idA, tileA);
    cache.add(idB, tileB);

    expect(cache.has(idB)).toBeTruthy();
    expect(cache.has(idA)).toBeFalsy();
});

test('TileCache#reset', () => {
    let called;
    const cache = new TileCache(10, (removed) => {
        expect(removed).toEqual(tileA);
        called = true;
    });
    cache.add(idA, tileA);
    expect(cache.reset()).toEqual(cache);
    expect(cache.has(idA)).toEqual(false);
    expect(called).toBeTruthy();
});

test('TileCache#setMaxSize', () => {
    let numRemoved = 0;
    const cache = new TileCache(10, () => {
        numRemoved++;
    });
    cache.add(idA, tileA);
    cache.add(idB, tileB);
    cache.add(idC, tileC);
    expect(numRemoved).toEqual(0);
    cache.setMaxSize(15);
    expect(numRemoved).toEqual(0);
    cache.setMaxSize(1);
    expect(numRemoved).toEqual(2);
    cache.add(idD, tileD);
    expect(numRemoved).toEqual(3);
});
