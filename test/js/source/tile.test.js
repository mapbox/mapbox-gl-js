'use strict';

var test = require('tap').test;
var Tile = require('../../../js/source/tile');
var GeoJSONWrapper = require('../../../js/source/geojson_wrapper');
var TileCoord = require('../../../js/source/tile_coord');
var fs = require('fs');
var path = require('path');
var vtpbf = require('vt-pbf');

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

        tile.rawTileData = fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'));

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


    t.end();
});
