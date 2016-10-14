'use strict';

const test = require('mapbox-gl-js-test').test;
const Evented = require('../../../js/util/evented');

test('Evented', function(t) {

    t.test('calls listeners added with "on"', function(t) {
        const evented = Object.create(Evented);
        const listener = t.spy();
        evented.on('a', listener);
        evented.fire('a');
        evented.fire('a');
        t.ok(listener.calledTwice);
        t.end();
    });

    t.test('calls listeners added with "once" once', function(t) {
        const evented = Object.create(Evented);
        const listener = t.spy();
        evented.once('a', listener);
        evented.fire('a');
        evented.fire('a');
        t.ok(listener.calledOnce);
        t.end();
    });

    t.test('passes data to listeners', function(t) {
        const evented = Object.create(Evented);
        evented.on('a', function(data) {
            t.equal(data.foo, 'bar');
        });
        evented.fire('a', {foo: 'bar'});
        t.end();
    });

    t.test('passes "target" to listeners', function(t) {
        const evented = Object.create(Evented);
        evented.on('a', function(data) {
            t.equal(data.target, evented);
        });
        evented.fire('a');
        t.end();
    });

    t.test('passes "type" to listeners', function(t) {
        const evented = Object.create(Evented);
        evented.on('a', function(data) {
            t.deepEqual(data.type, 'a');
        });
        evented.fire('a');
        t.end();
    });

    t.test('removes listeners with "off"', function(t) {
        const evented = Object.create(Evented);
        const listener = t.spy();
        evented.on('a', listener);
        evented.off('a', listener);
        evented.fire('a');
        t.ok(listener.notCalled);
        t.end();
    });

    t.test('reports if an event has listeners with "listens"', function(t) {
        const evented = Object.create(Evented);
        evented.on('a', function() {});
        t.ok(evented.listens('a'));
        t.notOk(evented.listens('b'));
        t.end();
    });

    t.test('does not immediately call listeners added within another listener', function(t) {
        const evented = Object.create(Evented);
        evented.on('a', function() {
            evented.on('a', t.fail.bind(t));
        });
        evented.fire('a');
        t.end();
    });

    t.test('evented parents', function(t) {

        t.test('adds parents with "setEventedParent"', function(t) {
            const listener = t.spy();
            const eventedSource = Object.create(Evented);
            const eventedSink = Object.create(Evented);
            eventedSource.setEventedParent(eventedSink);
            eventedSink.on('a', listener);
            eventedSource.fire('a');
            eventedSource.fire('a');
            t.ok(listener.calledTwice);
            t.end();
        });

        t.test('passes original data to parent listeners', function(t) {
            const eventedSource = Object.create(Evented);
            const eventedSink = Object.create(Evented);
            eventedSource.setEventedParent(eventedSink);
            eventedSink.on('a', function(data) {
                t.equal(data.foo, 'bar');
            });
            eventedSource.fire('a', {foo: 'bar'});
            t.end();
        });

        t.test('attaches parent data to parent listeners', function(t) {
            const eventedSource = Object.create(Evented);
            const eventedSink = Object.create(Evented);
            eventedSource.setEventedParent(eventedSink, {foz: 'baz'});
            eventedSink.on('a', function(data) {
                t.equal(data.foz, 'baz');
            });
            eventedSource.fire('a', {foo: 'bar'});
            t.end();
        });

        t.test('passes original "target" to parent listeners', function(t) {
            const eventedSource = Object.create(Evented);
            const eventedSink = Object.create(Evented);
            eventedSource.setEventedParent(eventedSink);
            eventedSource.setEventedParent(null);
            eventedSink.on('a', function(data) {
                t.equal(data.target, eventedSource);
            });
            eventedSource.fire('a');
            t.end();
        });

        t.test('removes parents with "setEventedParent(null)"', function(t) {
            const listener = t.spy();
            const eventedSource = Object.create(Evented);
            const eventedSink = Object.create(Evented);
            eventedSink.on('a', listener);
            eventedSource.setEventedParent(eventedSink);
            eventedSource.setEventedParent(null);
            eventedSource.fire('a');
            t.ok(listener.notCalled);
            t.end();
        });

        t.test('reports if an event has parent listeners with "listens"', function(t) {
            const eventedSource = Object.create(Evented);
            const eventedSink = Object.create(Evented);
            eventedSink.on('a', function() {});
            eventedSource.setEventedParent(eventedSink);
            t.ok(eventedSink.listens('a'));
            t.end();
        });

        t.end();

    });

    t.end();
});
