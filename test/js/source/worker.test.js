'use strict';

/* jshint -W079 */

var test = require('prova');
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
});

test('overzoomed tile position', function(t) {
    t.test('x, y pos calculated for overzoomed tile', function(t) {
        var worker = new Worker(_self);
        var ul = worker.getChildPosition(319335, 20421);
        t.deepEqual(ul, { dz: 2, xPos: 3, yPos: 1 });
        t.end();
    });
});

test('after', function(t) {
    server.close(t.end);
});
