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
        worker['load tile']({
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

test('abort tile', function(t) {
    t.test('aborts pending request', function(t) {
        var worker = new Worker(_self);

        worker['load tile']({
            source: 'source',
            uid: 0,
            url: 'http://localhost:2900/abort'
        }, t.fail);

        worker['abort tile']({
            source: 'source',
            uid: 0
        });

        t.deepEqual(worker.loading, { source: {} });
        t.end();
    });

    t.end();
});

test('set layers', function(t) {
    var worker = new Worker(_self);

    worker['set layers']([
        { id: 'one', type: 'circle', paint: { 'circle-color': 'red' }  },
        { id: 'two', type: 'circle', paint: { 'circle-color': 'green' }  },
        { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'blue' } }
    ]);

    t.equal(worker.layers.one.id, 'one');
    t.equal(worker.layers.two.id, 'two');
    t.equal(worker.layers.three.id, 'three');

    t.equal(worker.layers.one.getPaintProperty('circle-color'), 'red');
    t.equal(worker.layers.two.getPaintProperty('circle-color'), 'green');
    t.equal(worker.layers.three.getPaintProperty('circle-color'), 'blue');

    t.equal(worker.layerFamilies.one.length, 1);
    t.equal(worker.layerFamilies.one[0].id, 'one');
    t.equal(worker.layerFamilies.two.length, 2);
    t.equal(worker.layerFamilies.two[0].id, 'two');
    t.equal(worker.layerFamilies.two[1].id, 'three');

    t.end();
});

test('update layers', function(t) {
    var worker = new Worker(_self);

    worker['set layers']([
        { id: 'one', type: 'circle', paint: { 'circle-color': 'red' }  },
        { id: 'two', type: 'circle', paint: { 'circle-color': 'green' }  },
        { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'blue' } }
    ]);

    worker['update layers']({
        one: { id: 'one', type: 'circle', paint: { 'circle-color': 'cyan' }  },
        two: { id: 'two', type: 'circle', paint: { 'circle-color': 'magenta' }  },
        three: { id: 'three', ref: 'two', type: 'circle', paint: { 'circle-color': 'yellow' } }
    });

    t.equal(worker.layers.one.getPaintProperty('circle-color'), 'cyan');
    t.equal(worker.layers.two.getPaintProperty('circle-color'), 'magenta');
    t.equal(worker.layers.three.getPaintProperty('circle-color'), 'yellow');

    t.end();
});

test('remove tile', function(t) {
    t.test('removes loaded tile', function(t) {
        var worker = new Worker(_self);

        worker.loaded = {
            source: {
                '0': {}
            }
        };

        worker['remove tile']({
            source: 'source',
            uid: 0
        });

        t.deepEqual(worker.loaded, { source: {} });
        t.end();
    });

    t.end();
});

test('after', function(t) {
    server.close(t.end);
});
