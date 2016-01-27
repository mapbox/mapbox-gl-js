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

test('geojson', function(t) {
    var geojson = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [-122.48369693756104, 37.83381888486939],
                    [-122.48348236083984, 37.83317489144141]
                ]
            }
        }]
    };

    // test parsing of GeoJSON in native and stringified form.
    [geojson, JSON.stringify(geojson)].forEach(function (data) {
        t.test('parses geojson', function(t) {
            var worker = new Worker(_self);

            worker.loaded = {
                source: {
                    '0': {}
                }
            };

            t.deepEqual(worker.geoJSONIndexes, {});
            worker['parse geojson']({
                data: data,
                tileSize: 512,
                source: "test",
                geojsonVtOptions: { maxZoom: 20 },
                cluster: false,
                superclusterOptions: {
                    maxZoom: 19,
                    extent: 4096,
                    radius: 400,
                    log: false
                }
            }, function() {
                t.notDeepEqual(worker.geoJSONIndexes, {});
                t.end();
            });
        });
    });
});

test('after', function(t) {
    server.close(t.end);
});
