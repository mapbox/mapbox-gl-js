'use strict';

/* jshint -W079 */

var test = require('tap').test;
var Worker = require('../../../js/source/worker');
var window = require('../../../js/util/window');

var _self = {
    addEventListener: function() {}
};

test('load tile', function(t) {
    t.test('calls callback on error', function(t) {
        window.useFakeXMLHttpRequest();
        var worker = new Worker(_self);
        worker['load tile'](0, {
            type: 'vector',
            source: 'source',
            uid: 0,
            url: '/error' // Sinon fake server gives 404 responses by default
        }, function(err) {
            t.ok(err);
            window.restore();
            t.end();
        });
        window.server.respond();
    });

    t.end();
});

test('set layers', function(t) {
    var worker = new Worker(_self);

    worker['set layers'](0, [
        { id: 'one', type: 'circle', paint: { 'circle-color': 'red' }  },
        { id: 'two', type: 'circle', paint: { 'circle-color': 'green' }  },
        { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'blue' } }
    ]);

    t.equal(worker.layers[0].one.id, 'one');
    t.equal(worker.layers[0].two.id, 'two');
    t.equal(worker.layers[0].three.id, 'three');

    t.equal(worker.layers[0].one.getPaintProperty('circle-color'), 'red');
    t.equal(worker.layers[0].two.getPaintProperty('circle-color'), 'green');
    t.equal(worker.layers[0].three.getPaintProperty('circle-color'), 'blue');

    t.equal(worker.layerFamilies[0].one.length, 1);
    t.equal(worker.layerFamilies[0].one[0].id, 'one');
    t.equal(worker.layerFamilies[0].two.length, 2);
    t.equal(worker.layerFamilies[0].two[0].id, 'two');
    t.equal(worker.layerFamilies[0].two[1].id, 'three');

    t.end();
});

test('update layers', function(t) {
    var worker = new Worker(_self);

    worker['set layers'](0, [
        { id: 'one', type: 'circle', paint: { 'circle-color': 'red' }  },
        { id: 'two', type: 'circle', paint: { 'circle-color': 'green' }  },
        { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'blue' } }
    ]);

    worker['update layers'](0, {
        one: { id: 'one', type: 'circle', paint: { 'circle-color': 'cyan' }  },
        two: { id: 'two', type: 'circle', paint: { 'circle-color': 'magenta' }  },
        three: { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'yellow' } }
    });

    t.equal(worker.layers[0].one.getPaintProperty('circle-color'), 'cyan');
    t.equal(worker.layers[0].two.getPaintProperty('circle-color'), 'magenta');
    t.equal(worker.layers[0].three.getPaintProperty('circle-color'), 'yellow');

    t.end();
});

test('redo placement', function(t) {
    var worker = new Worker(_self);
    _self.registerWorkerSource('test', function() {
        this.redoPlacement = function(options) {
            t.ok(options.mapbox);
            t.end();
        };
    });

    worker['redo placement'](0, {type: 'test', mapbox: true});
});

test('update layers isolates different instances\' data', function(t) {
    var worker = new Worker(_self);

    worker['set layers'](0, [
        { id: 'one', type: 'circle', paint: { 'circle-color': 'red' }  },
        { id: 'two', type: 'circle', paint: { 'circle-color': 'green' }  },
        { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'blue' } }
    ]);

    worker['set layers'](1, [
        { id: 'one', type: 'circle', paint: { 'circle-color': 'red' }  },
        { id: 'two', type: 'circle', paint: { 'circle-color': 'green' }  },
        { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'blue' } }
    ]);

    worker['update layers'](1, {
        one: { id: 'one', type: 'circle', paint: { 'circle-color': 'cyan' }  },
        two: { id: 'two', type: 'circle', paint: { 'circle-color': 'magenta' }  },
        three: { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'yellow' } }
    });

    t.equal(worker.layers[0].one.id, 'one');
    t.equal(worker.layers[0].two.id, 'two');
    t.equal(worker.layers[0].three.id, 'three');

    t.equal(worker.layers[0].one.getPaintProperty('circle-color'), 'red');
    t.equal(worker.layers[0].two.getPaintProperty('circle-color'), 'green');
    t.equal(worker.layers[0].three.getPaintProperty('circle-color'), 'blue');

    t.equal(worker.layerFamilies[0].one.length, 1);
    t.equal(worker.layerFamilies[0].one[0].id, 'one');
    t.equal(worker.layerFamilies[0].two.length, 2);
    t.equal(worker.layerFamilies[0].two[0].id, 'two');
    t.equal(worker.layerFamilies[0].two[1].id, 'three');


    t.end();
});

test('worker source messages dispatched to the correct map instance', function(t) {
    var worker = new Worker(_self);

    worker.actor.send = function (type, data, callback, buffers, mapId) {
        t.equal(type, 'main thread task');
        t.equal(mapId, 999);
        t.end();
    };

    _self.registerWorkerSource('test', function(actor) {
        this.loadTile = function() {
            // we expect the map id to get appended in the call to the "real"
            // actor.send()
            actor.send('main thread task', {}, function () {}, null);
        };
    });

    worker['load tile'](999, {type: 'test'});
});
