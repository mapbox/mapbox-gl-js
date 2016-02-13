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

test('getData', function(t) {
    var features = [{
        type: 1,
        geometry: [0, 0],
        tags: { oneway: true }
    }];


    t.test('geojson tile', function(t) {
        var tile = new WorkerTile({uid: '', zoom: 0, maxZoom: 20, tileSize: 512, source: 'source',
            coord: new TileCoord(1, 1, 1), overscaling: 1 });

        t.equal(tile.getData({}), null);

        tile.data = new Wrapper(features);

        t.equal(tile.getData({}).type, 'FeatureCollection');
        t.equal(tile.getData({}).features.length, 1);
        t.deepEqual(tile.getData({}).features[0].properties, features[0].tags);
        t.equal(tile.getData({ filter: ['==', 'oneway', true]}).features.length, 1);
        t.equal(tile.getData({ filter: ['!=', 'oneway', true]}).features.length, 0);
        t.end();
    });

    t.test('vector tile', function(t) {
        var tile = new WorkerTile({uid: '', zoom: 0, maxZoom: 20, tileSize: 512, source: 'source',
            coord: new TileCoord(1, 1, 1), overscaling: 1 });

        t.equal(tile.getData({}), null);

        tile.data = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));

        t.equal(tile.getData({ 'source-layer': 'does-not-exist'}), null);

        var roads = tile.getData({ 'source-layer': 'road' });
        t.equal(roads.type, 'FeatureCollection');
        t.equal(roads.features.length, 3);

        t.equal(tile.getData({ 'source-layer': 'road', filter: ['==', 'class', 'main'] }).features.length, 1);
        t.equal(tile.getData({ 'source-layer': 'road', filter: ['!=', 'class', 'main'] }).features.length, 2);

        t.end();
    });


    t.end();
});
