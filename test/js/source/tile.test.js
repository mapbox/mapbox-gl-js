'use strict';

var test = require('tap').test;
var Tile = require('../../../js/source/tile');
var GeoJSONWrapper = require('../../../js/source/geojson_wrapper');
var TileCoord = require('../../../js/source/tile_coord');
var fs = require('fs');
var path = require('path');
var vtpbf = require('vt-pbf');
var sinon = require('sinon');
var FeatureIndex = require('../../../js/data/feature_index');
var CollisionTile = require('../../../js/symbol/collision_tile');
var CollisionBoxArray = require('../../../js/symbol/collision_box');
var SymbolInstancesArray = require('../../../js/symbol/symbol_instances');
var SymbolQuadsArray = require('../../../js/symbol/symbol_quads');
var util = require('../../../js/util/util');

test('querySourceFeatures', function(t) {
    var features = [{
        type: 1,
        geometry: [0, 0],
        tags: { oneway: true }
    }];


    t.test('geojson tile', function(t) {
        var tile = new Tile(new TileCoord(1, 1, 1));
        var result;

        result = [];
        tile.querySourceFeatures(result, {});
        t.equal(result.length, 0);

        var geojsonWrapper = new GeoJSONWrapper(features);
        geojsonWrapper.name = '_geojsonTileLayer';
        tile.rawTileData = vtpbf({ layers: { '_geojsonTileLayer': geojsonWrapper }});

        result = [];
        tile.querySourceFeatures(result, {});
        t.equal(result.length, 1);
        t.deepEqual(result[0].properties, features[0].tags);
        result = [];
        tile.querySourceFeatures(result, { filter: ['==', 'oneway', true]});
        t.equal(result.length, 1);
        result = [];
        tile.querySourceFeatures(result, { filter: ['!=', 'oneway', true]});
        t.equal(result.length, 0);
        t.end();
    });

    t.test('vector tile', function(t) {
        var tile = new Tile(new TileCoord(1, 1, 1));
        var result;

        result = [];
        tile.querySourceFeatures(result, {});
        t.equal(result.length, 0);

        tile.loadVectorData(
            createVectorData({rawTileData: createRawTileData()}),
            createPainter()
        );

        result = [];
        tile.querySourceFeatures(result, { 'sourceLayer': 'does-not-exist'});
        t.equal(result.length, 0);

        result = [];
        tile.querySourceFeatures(result, { 'sourceLayer': 'road' });
        t.equal(result.length, 3);

        result = [];
        tile.querySourceFeatures(result, { 'sourceLayer': 'road', filter: ['==', 'class', 'main'] });
        t.equal(result.length, 1);
        result = [];
        tile.querySourceFeatures(result, { 'sourceLayer': 'road', filter: ['!=', 'class', 'main'] });
        t.equal(result.length, 2);

        t.end();
    });

    t.test('loadVectorData unloads existing data before overwriting it', function(t) {
        var tile = new Tile(new TileCoord(1, 1, 1));
        tile.state = 'loaded';
        sinon.stub(tile, 'unloadVectorData');
        var painter = {};

        tile.loadVectorData(null, painter);

        t.ok(tile.unloadVectorData.calledWith(painter));
        t.end();
    });

    t.test('loadVectorData preserves the most recent rawTileData', function(t) {
        var tile = new Tile(new TileCoord(1, 1, 1));
        tile.state = 'loaded';

        tile.loadVectorData(
            createVectorData({rawTileData: createRawTileData()}),
            createPainter()
        );
        tile.loadVectorData(
            createVectorData(),
            createPainter()
        );

        var features = [];
        tile.querySourceFeatures(features, { 'sourceLayer': 'road' });
        t.equal(features.length, 3);

        t.end();
    });

    t.end();
});

function createRawTileData() {
    return fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'));
}

function createVectorData(options) {
    var collisionBoxArray = new CollisionBoxArray();
    return util.extend({
        collisionBoxArray: collisionBoxArray.serialize(),
        collisionTile: (new CollisionTile(0, 0, collisionBoxArray)).serialize(),
        symbolInstancesArray: (new SymbolInstancesArray()).serialize(),
        symbolQuadsArray: (new SymbolQuadsArray()).serialize(),
        featureIndex: (new FeatureIndex(new TileCoord(1, 1, 1))).serialize(),
        buckets: []
    }, options);
}

function createPainter() {
    return { style: {} };
}
