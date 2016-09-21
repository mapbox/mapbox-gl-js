'use strict';

var test = require('tap').test;
var Evented = require('../../../js/util/evented');
var sinon = require('sinon');

test('Evented', function(t) {

    t.test('calls listeners added with "on" when their event is fired', function(t) {
        var evented = Object.create(Evented);
        var listener = sinon.spy();
        evented.on('a', listener);
        evented.fire('a');
        evented.fire('a');
        evented.fire('b');
        t.ok(listener.calledTwice);
        t.end();
    });

    t.test('calls listeners added with "once" once', function(t) {
        var evented = Object.create(Evented);
        var listener = sinon.spy();
        evented.once('a', listener);
        evented.fire('a');
        evented.fire('a');
        t.ok(listener.calledOnce);
        t.end();
    });

    t.test('passes data to listeners', function(t) {
        var evented = Object.create(Evented);
        evented.on('a', function(data) {
            t.equal(data.foo, 'bar');
        });
        evented.fire('a', {foo: 'bar'});
        t.end();
    });

    t.test('passes "target" to listeners', function(t) {
        var evented = Object.create(Evented);
        evented.on('a', function(data) {
            t.equal(data.target, evented);
        });
        evented.fire('a');
        t.end();
    });

    t.test('passes "type" to listeners', function(t) {
        var evented = Object.create(Evented);
        evented.on('a', function(data) {
            t.deepEqual(data.type, 'a');
        });
        evented.fire('a');
        t.end();
    });

    t.test('removes listeners with "off"', function(t) {
        var evented = Object.create(Evented);
        var listener = sinon.spy();
        evented.on('a', listener);
        evented.off('a', listener);
        evented.fire('a');
        t.ok(listener.notCalled);
        t.end();
    });

    t.test('reports if an event has listeners with "listens"', function(t) {
        var evented = Object.create(Evented);
        evented.on('a', function() {});
        t.ok(evented.listens('a'));
        t.notOk(evented.listens('b'));
        t.end();
    });

    t.test('does not immediately call listeners added within another listener', function(t) {
        var evented = Object.create(Evented);
        evented.on('a', function() {
            evented.on('a', function() {
                assert.fail();
            })
        });
        evented.fire('a');
        t.end();
    });

    t.end();

});
