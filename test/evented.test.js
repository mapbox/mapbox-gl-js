'use strict';
var test = require('tape').test;
var Evented = require('../js/util/evented.js');

test('evented', function(t) {
    var report = function(data) {
        t.deepEqual(data, { a: 'a' });
    };
    var evented = Object.create(Evented);
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

test('evented-not-found', function(t) {
    var report1 = function() { t.pass(); };
    var evented = Object.create(Evented);
    t.equal(evented.on('a', report1), evented);
    t.equal(evented.off('a', function() {}), evented);
    t.equal(evented.fire('a', { a: 'a' }), evented);
    t.end();
});
