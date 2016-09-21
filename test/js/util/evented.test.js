'use strict';

var test = require('tap').test;
var Evented = require('../../../js/util/evented');
var sinon = require('sinon');

test('Evented', function(t) {

    t.test('calls listeners added with "on"', function(t) {
        var evented = Object.create(Evented);
        var listener = sinon.spy();
        evented.on('a', listener);
        evented.fire('a');
        evented.fire('a');
        t.ok(listener.calledTwice);
        t.end();
    });

    t.test('calls piped listeners added with "on"', function(t) {
        var listener = sinon.spy();
        var eventedSource = Object.create(Evented);
        var eventedSink = Object.create(Evented);
        eventedSource.pipe(eventedSink);
        eventedSink.on('a', listener);
        eventedSource.fire('a');
        eventedSource.fire('a');
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

    t.test('removes pipes with "unpipe"', function(t) {
        var listener = sinon.spy();
        var eventedSource = Object.create(Evented);
        var eventedSink = Object.create(Evented);
        eventedSink.on('a', listener);
        eventedSource.pipe(eventedSink);
        eventedSource.unpipe(eventedSink);
        eventedSource.fire('a');
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

    t.test('reports if an event has piped listeners with "listens"', function(t) {
        var eventedSource = Object.create(Evented);
        var eventedSink = Object.create(Evented);
        eventedSink.on('a', function() {});
        eventedSource.pipe(eventedSink);
        t.ok(eventedSink.listens('a'));
        t.end();
    });

    t.test('does not immediately call listeners added within another listener', function(t) {
        var evented = Object.create(Evented);
        evented.on('a', function() {
            evented.on('a', t.fail.bind(t));
        });
        evented.fire('a');
        t.end();
    });

    t.end();

});
