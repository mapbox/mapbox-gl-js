'use strict';

const test = require('mapbox-gl-js-test').test;
const Worker = require('../../../js/source/worker');
const window = require('../../../js/util/window');

const _self = {
    addEventListener: function() {}
};

test('load tile', (t) => {
    t.test('calls callback on error', (t) => {
        window.useFakeXMLHttpRequest();
        const worker = new Worker(_self);
        worker.loadTile(0, {
            type: 'vector',
            source: 'source',
            uid: 0,
            url: '/error' // Sinon fake server gives 404 responses by default
        }, (err) => {
            t.ok(err);
            window.restore();
            t.end();
        });
        window.server.respond();
    });

    t.end();
});

test('redo placement', (t) => {
    const worker = new Worker(_self);
    _self.registerWorkerSource('test', function() {
        this.redoPlacement = function(options) {
            t.ok(options.mapbox);
            t.end();
        };
    });

    worker.redoPlacement(0, {type: 'test', mapbox: true});
});

test('isolates different instances\' data', (t) => {
    const worker = new Worker(_self);

    worker.setLayers(0, [
        { id: 'one', type: 'circle' }
    ]);

    worker.setLayers(1, [
        { id: 'one', type: 'circle' },
        { id: 'two', type: 'circle' },
    ]);

    t.notEqual(worker.layerIndexes[0], worker.layerIndexes[1]);
    t.end();
});

test('worker source messages dispatched to the correct map instance', (t) => {
    const worker = new Worker(_self);

    worker.actor.send = function (type, data, callback, buffers, mapId) {
        t.equal(type, 'main thread task');
        t.equal(mapId, 999);
        t.end();
    };

    _self.registerWorkerSource('test', function(actor) {
        this.loadTile = function() {
            // we expect the map id to get appended in the call to the "real"
            // actor.send()
            actor.send('main thread task', {}, () => {}, null);
        };
    });

    worker.loadTile(999, {type: 'test'});
});
