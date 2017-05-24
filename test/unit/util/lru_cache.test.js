'use strict';

const test = require('mapbox-gl-js-test').test;
const LRUCache = require('../../../src/util/lru_cache');

test('LRUCache', (t) => {
    const cache = new LRUCache(10, (removed) => {
        t.equal(removed, 'dc');
    });
    t.equal(cache.get('foo'), null, '.get() to null');
    t.equal(cache.add('washington', 'dc'), cache, '.add()');
    t.deepEqual(cache.keys(), ['washington'], '.keys()');
    t.equal(cache.has('washington'), true, '.has()');
    t.equal(cache.get('washington'), 'dc', '.get()');
    t.equal(cache.get('washington'), 'dc', '.get()');
    t.equal(cache.has('washington'), true, '.has()');
    t.deepEqual(cache.keys(), ['washington'], '.keys()');
    t.end();
});

test('LRUCache - get moves key to top of order stack', (t) => {
    const cache = new LRUCache(10, (removed) => {
        t.equal(removed, 'dc');
    });
    t.equal(cache.add('washington', 'dc'), cache, '.add()');
    t.equal(cache.add('san francisco', 'ca'), cache, '.add()');
    t.deepEqual(cache.keys(), ['washington', 'san francisco'], '.keys()');
    t.equal(cache.has('washington'), true, '.has()');
    t.equal(cache.get('washington'), 'dc', '.get()');
    t.deepEqual(cache.keys(), ['san francisco', 'washington'], '.keys()');
    t.end();
});

test('LRUCache - getWithoutRemoving', (t) => {
    const cache = new LRUCache(10, () => {
        t.fail();
    });
    t.equal(cache.add('washington', 'dc'), cache, '.add()');
    t.equal(cache.getWithoutRemoving('washington'), 'dc', '.getWithoutRemoving()');
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
    t.equal(cache.get('a'), 'c');
    t.end();
});

test('LRUCache - remove', (t) => {
    let called;
    const cache = new LRUCache(10, (removed) => {
        t.equal(removed, 'dc');
        called = true;
    });

    cache.add('washington', 'dc');
    cache.add('baltimore', 'md');
    cache.add('richmond', 'va');

    t.deepEqual(cache.keys(), ['washington', 'baltimore', 'richmond']);
    t.ok(cache.has('baltimore'));

    cache.remove('baltimore');

    t.deepEqual(cache.keys(), ['washington', 'richmond']);
    t.notOk(cache.has('baltimore'));

    t.ok(cache.remove('baltimore'));

    t.notOk(called);
    cache.remove('washington', true);
    t.ok(called);

    t.end();
});

test('LRUCache - overflow', (t) => {
    const cache = new LRUCache(1, (removed) => {
        t.equal(removed, 'b');
        t.end();
    });
    cache.add('a', 'b');
    cache.add('c', 'd');
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
