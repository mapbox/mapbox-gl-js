'use strict';

var test = require('tap').test;
var Evented = require('../../../js/util/evented');

test('evented', function(t) {
    var evented = Object.create(Evented);
    var report = function(data) {
        t.deepEqual(data, { a: 'a', type: 'a', target: evented });
    };
    t.equal(evented.on('a', report), evented);
    t.equal(evented.listens('a'), true);
    t.equal(evented.fire('a', { a: 'a' }), evented);
    t.equal(evented.off('a', report), evented);
    t.equal(evented.off('a', report), evented);
    t.equal(evented.listens('a'), false);
    t.end();
});

test('evented-all', function(t) {
    var report = function() {
        t.fail();
    };
    var evented = Object.create(Evented);
    t.equal(evented.on('a', report), evented);
    t.equal(evented.on('b', report), evented);
    t.equal(evented.on('c', report), evented);
    t.equal(evented.off(), evented);
    ['a', 'b', 'c'].forEach(function(e) {
        t.equal(evented.fire(e, { a: 'a' }), evented);
    });
    t.end();
});

test('evented-one', function(t) {
    var report1 = function() { t.fail(); };
    var report2 = function() { t.fail(); };
    var report3 = function() { t.fail(); };
    var evented = Object.create(Evented);
    t.equal(evented.on('a', report1), evented);
    t.equal(evented.on('a', report2), evented);
    t.equal(evented.on('a', report3), evented);
    t.equal(evented.off('a'), evented);
    t.equal(evented.fire('a', { a: 'a' }), evented);
    t.end();
});

test('evented-once', function(t) {
    var evented = Object.create(Evented);

    function report(data) {
        t.equal(data.type, 'a');
        t.equal(data.n, 1);
        t.end();
    }

    t.equal(evented.once('a', report), evented);

    evented.fire('a', {n: 1});
    evented.fire('a', {n: 2});
});

test('evented-not-found', function(t) {
    var report1 = function() { t.pass(); };
    var evented = Object.create(Evented);
    t.equal(evented.on('a', report1), evented);
    t.equal(evented.off('a', function() {}), evented);
    t.equal(evented.fire('a', { a: 'a' }), evented);
    t.end();
});
