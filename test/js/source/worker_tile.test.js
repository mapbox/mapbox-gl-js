'use strict';

var test = require('tap').test;
var WorkerTile = require('../../../js/source/worker_tile');
var Wrapper = require('../../../js/source/geojson_wrapper');
var TileCoord = require('../../../js/source/tile_coord');
var vt = require('vector-tile');
var fs = require('fs');
var path = require('path');
var Protobuf = require('pbf');

test('basic', function(t) {
    var buckets = [{
        id: 'test',
        source: 'source',
        type: 'circle',
        layout: {},
        compare: function () { return true; }
    }];

    var features = [{
        type: 1,
        geometry: [0, 0],
        tags: {}
    }];

    var tile = new WorkerTile({uid: '', zoom: 0, maxZoom: 20, tileSize: 512, source: 'source',
        coord: new TileCoord(1, 1, 1), overscaling: 1 });

    t.test('basic worker tile', function(t) {
        tile.parse(new Wrapper(features), buckets, {}, function(err, result) {
            t.equal(err, null);
            t.ok(result.buckets[0]);
            t.end();
        });
    });

    t.test('hidden layers', function(t) {
        buckets.push({
            id: 'test-hidden',
            source: 'source',
            type: 'fill',
            layout: { visibility: 'none' },
            compare: function () { return true; }
        });
        tile.parse(new Wrapper(features), buckets, {}, function(err, result) {
            t.equal(err, null);
            t.equal(Object.keys(result.buckets[0].elementGroups).length, 1, 'element groups exclude hidden layer');
            t.end();
        });
    });

    t.end();
});

test('querySourceFeatures', function(t) {
    var features = [{
        type: 1,
        geometry: [0, 0],
        tags: { oneway: true }
    }];


    t.test('geojson tile', function(t) {
        var tile = new WorkerTile({uid: '', zoom: 0, maxZoom: 20, tileSize: 512, source: 'source',
            coord: new TileCoord(1, 1, 1), overscaling: 1 });

        t.equal(tile.querySourceFeatures({}), null);

        tile.data = new Wrapper(features);

        t.equal(tile.querySourceFeatures({}).length, 1);
        t.deepEqual(tile.querySourceFeatures({})[0].properties, features[0].tags);
        t.equal(tile.querySourceFeatures({ filter: ['==', 'oneway', true]}).length, 1);
        t.equal(tile.querySourceFeatures({ filter: ['!=', 'oneway', true]}).length, 0);
        t.end();
    });

    t.test('vector tile', function(t) {
        var tile = new WorkerTile({uid: '', zoom: 0, maxZoom: 20, tileSize: 512, source: 'source',
            coord: new TileCoord(1, 1, 1), overscaling: 1 });

        t.equal(tile.querySourceFeatures({}), null);

        tile.data = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));

        t.equal(tile.querySourceFeatures({ 'source-layer': 'does-not-exist'}), null);

        var roads = tile.querySourceFeatures({ 'source-layer': 'road' });
        t.equal(roads.length, 3);

        t.equal(tile.querySourceFeatures({ 'source-layer': 'road', filter: ['==', 'class', 'main'] }).length, 1);
        t.equal(tile.querySourceFeatures({ 'source-layer': 'road', filter: ['!=', 'class', 'main'] }).length, 2);

        t.end();
    });


    t.end();
});
