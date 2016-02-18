'use strict';

var test = require('prova');
var MRUCache = require('../../../js/util/mru_cache');

test('MRUCache', function(t) {
    var cache = new MRUCache(10, function(removed) {
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

test('MRUCache - overflow', function(t) {
    var cache = new MRUCache(1, function(removed) {
        t.equal(removed, 'c');
        t.end();
    });
    cache.add('a', 'b');
    cache.add('a', 'c');
});

test('MRUCache#reset', function(t) {
    var called;
    var cache = new MRUCache(10, function(removed) {
        t.equal(removed, 'dc');
        called = true;
    });
    cache.add('washington', 'dc');
    t.equal(cache.reset(), cache);
    t.equal(cache.has('washington'), false);
    t.ok(called);
    t.end();
});

test('MRUCache#setMaxSize', function(t) {
    var numRemoved = 0;
    var cache = new MRUCache(10, function() {
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
