'use strict';

var test = require('tap').test;
var WorkerTile = require('../../../js/source/worker_tile');
var Wrapper = require('../../../js/source/geojson_wrapper');
var TileCoord = require('../../../js/source/tile_coord');
var StyleLayer = require('../../../js/style/style_layer');

test('WorkerTile', function(t) {
    var features = [{
        type: 1,
        geometry: [0, 0],
        tags: {}
    }];

    var tile = new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        coord: new TileCoord(1, 1, 1),
        overscaling: 1
    });

    t.test('basic worker tile', function(t) {
        var layerFamilies = {
            test: [new StyleLayer({
                id: 'test',
                source: 'source',
                type: 'circle',
                layout: {},
                compare: function () { return true; }
            })]
        };

        tile.parse(new Wrapper(features), layerFamilies, {}, function(err, result) {
            t.equal(err, null);
            t.ok(result.buckets[0]);
            t.end();
        });
    });

    t.test('hidden layers', function(t) {
        var layerFamilies = {
            'test': [new StyleLayer({
                id: 'test',
                source: 'source',
                type: 'circle',
                layout: {},
                compare: function () { return true; }
            })],
            'test-hidden': [new StyleLayer({
                id: 'test-hidden',
                source: 'source',
                type: 'fill',
                layout: { visibility: 'none' },
                compare: function () { return true; }
            })]
        };

        tile.parse(new Wrapper(features), layerFamilies, {}, function(err, result) {
            t.equal(err, null);
            t.equal(Object.keys(result.buckets[0].arrays).length, 1, 'array groups exclude hidden layer');
            t.end();
        });
    });

    t.test('WorkerTile#updateProperties', function(t) {
        var layerFamilies = {
            test: [new StyleLayer({
                id: 'test',
                source: 'source',
                type: 'circle',
                layout: {},
                paint: {
                    'circle-color': {
                        property: 'x',
                        stops: [[0, '#000000'], [1, '#ffffff']]
                    }
                },
                compare: function () { return true; }
            })]
        };
        layerFamilies.test[0].sourceLayer = 'test';

        var features = [{
            type: 1,
            geometry: [0, 0],
            tags: { x: 0 }
        }];

        tile.parse({ layers: { test: new Wrapper(features) } }, layerFamilies, {}, null, function(err) {
            t.error(err);
            t.ok(tile.buckets && tile.buckets[0]);

            var updatedProperties;
            tile.buckets[0].updateFeatureProperties = function (properties) {
                updatedProperties = properties;
            };
            tile.buckets[0].isEmpty = function () { return false; };
            tile.updateProperties({test: [{x: 1}]}, layerFamilies, {}, function (err, result) {
                t.error(err);
                t.ok(result.buckets[0]);
                t.same(updatedProperties, [{x: 1}]);
                t.end();
            });
        });
    });

    t.end();
});
