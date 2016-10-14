'use strict';

var test = require('mapbox-gl-js-test').test;
var LRUCache = require('../../../js/util/lru_cache');

test('LRUCache', function(t) {
    var cache = new LRUCache(10, function(removed) {
        t.equal(removed, 'dc');
    });
    t.equal(cache.get('foo'), null, '.get() to null');
    t.equal(cache.add('washington', 'dc'), cache, '.add()');
    t.deepEqual(cache.keys(), ['washington'], '.keys()');
    t.equal(cache.has('washington'), true, '.has()');
    t.equal(cache.get('washington'), 'dc', '.get()');
    t.equal(cache.get('washington'), null, '.get()');
    t.equal(cache.has('washington'), false, '.has()');
    t.deepEqual(cache.keys(), [], '.keys()');
    t.end();
});

test('LRUCache - duplicate add', function(t) {
    var cache = new LRUCache(10, function() {
        t.fail();
    });

    cache.add('a', 'b');
    cache.add('a', 'c');

    t.deepEqual(cache.keys(), ['a']);
    t.ok(cache.has('a'));
    t.equal(cache.get('a'), 'c');
    t.end();
});

test('LRUCache - overflow', function(t) {
    var cache = new LRUCache(1, function(removed) {
        t.equal(removed, 'b');
        t.end();
    });
    cache.add('a', 'b');
    cache.add('c', 'd');
});

test('LRUCache#reset', function(t) {
    var called;
    var cache = new LRUCache(10, function(removed) {
        t.equal(removed, 'dc');
        called = true;
    });
    cache.add('washington', 'dc');
    t.equal(cache.reset(), cache);
    t.equal(cache.has('washington'), false);
    t.ok(called);
    t.end();
});

test('LRUCache#setMaxSize', function(t) {
    var numRemoved = 0;
    var cache = new LRUCache(10, function() {
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
