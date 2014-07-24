'use strict';
var test = require('tape').test;
var MRUCache = require('../../../js/util/mrucache.js');

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
    t.deepEqual(cache.reset(), cache, '.reset()');
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
