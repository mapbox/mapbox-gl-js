'use strict';

import { test } from 'mapbox-gl-js-test';
import LRUCache from '../../../src/util/lru_cache';

test('LRUCache', (t) => {
    const cache = new LRUCache(10, (removed) => {
        t.equal(removed, 'dc');
    });
    t.equal(cache.getAndRemove('foo'), null, '.getAndRemove() to null');
    t.equal(cache.add('washington', 'dc'), cache, '.add()');
    t.deepEqual(cache.keys(), ['washington'], '.keys()');
    t.equal(cache.has('washington'), true, '.has()');
    t.equal(cache.getAndRemove('washington'), 'dc', '.getAndRemove()');
    t.equal(cache.getAndRemove('washington'), null, '.getAndRemove()');
    t.equal(cache.has('washington'), false, '.has()');
    t.deepEqual(cache.keys(), [], '.keys()');
    t.end();
});

test('LRUCache - getWithoutRemoving', (t) => {
    const cache = new LRUCache(10, () => {
        t.fail();
    });
    t.equal(cache.add('washington', 'dc'), cache, '.add()');
    t.equal(cache.get('washington'), 'dc', '.get()');
    t.deepEqual(cache.keys(), ['washington'], '.keys()');
    t.end();
});

test('LRUCache - duplicate add', (t) => {
    const cache = new LRUCache(10, () => {
        t.fail();
    });

    cache.add('a', 'b');
    cache.add('a', 'c');

    t.deepEqual(cache.keys(), ['a']);
    t.ok(cache.has('a'));
    t.equal(cache.getAndRemove('a'), 'c');
    t.end();
});

test('LRUCache - remove', (t) => {
    const cache = new LRUCache(10, () => {});

    cache.add('washington', 'dc');
    cache.add('baltimore', 'md');
    cache.add('richmond', 'va');

    t.deepEqual(cache.keys(), ['washington', 'baltimore', 'richmond']);
    t.ok(cache.has('baltimore'));

    cache.remove('baltimore');

    t.deepEqual(cache.keys(), ['washington', 'richmond']);
    t.notOk(cache.has('baltimore'));

    t.ok(cache.remove('baltimore'));

    t.end();
});

test('LRUCache - overflow', (t) => {
    const cache = new LRUCache(1, (removed) => {
        t.equal(removed, 'b');
    });
    cache.add('a', 'b');
    cache.add('c', 'd');

    t.ok(cache.has('c'));
    t.notOk(cache.has('a'));
    t.end();
});

test('LRUCache#reset', (t) => {
    let called;
    const cache = new LRUCache(10, (removed) => {
        t.equal(removed, 'dc');
        called = true;
    });
    cache.add('washington', 'dc');
    t.equal(cache.reset(), cache);
    t.equal(cache.has('washington'), false);
    t.ok(called);
    t.end();
});

test('LRUCache#setMaxSize', (t) => {
    let numRemoved = 0;
    const cache = new LRUCache(10, () => {
        numRemoved++;
    });
    cache.add(1, 1);
    cache.add(2, 2);
    cache.add(3, 3);
    t.equal(numRemoved, 0);
    cache.setMaxSize(15);
    t.equal(numRemoved, 0);
    cache.setMaxSize(1);
    t.equal(numRemoved, 2);
    cache.add(4, 4);
    t.equal(numRemoved, 3);
    t.end();
});
