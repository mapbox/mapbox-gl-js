'use strict';

/* jshint -W079 */

var test = require('tap').test;
var http = require('http');
var Worker = require('../../../js/source/worker');

var _self = {
    addEventListener: function() {}
};

var server = http.createServer(function(request, response) {
    switch (request.url) {
    case "/error":
        response.writeHead(404, {"Content-Type": "text/plain"});
        response.end();
        break;
    }
});

test('before', function(t) {
    server.listen(2900, t.end);
});

test('load tile', function(t) {
    t.test('calls callback on error', function(t) {
        var worker = new Worker(_self);
        worker['load tile'](0, {
            source: 'source',
            uid: 0,
            url: 'http://localhost:2900/error'
        }, function(err) {
            t.ok(err);
            t.end();
        });
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

test('after', function(t) {
    server.close(t.end);
});
