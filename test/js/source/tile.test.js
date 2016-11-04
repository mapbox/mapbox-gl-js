'use strict';

const test = require('mapbox-gl-js-test').test;
const Tile = require('../../../js/source/tile');
const GeoJSONWrapper = require('../../../js/source/geojson_wrapper');
const TileCoord = require('../../../js/source/tile_coord');
const fs = require('fs');
const path = require('path');
const vtpbf = require('vt-pbf');
const FeatureIndex = require('../../../js/data/feature_index');
const CollisionTile = require('../../../js/symbol/collision_tile');
const CollisionBoxArray = require('../../../js/symbol/collision_box');
const SymbolInstancesArray = require('../../../js/symbol/symbol_instances');
const SymbolQuadsArray = require('../../../js/symbol/symbol_quads');
const util = require('../../../js/util/util');

test('querySourceFeatures', (t) => {
    const features = [{
        type: 1,
        geometry: [0, 0],
        tags: { oneway: true }
    }];


    t.test('geojson tile', (t) => {
        const tile = new Tile(new TileCoord(1, 1, 1));
        let result;

        result = [];
        tile.querySourceFeatures(result, {});
        t.equal(result.length, 0);

        const geojsonWrapper = new GeoJSONWrapper(features);
        geojsonWrapper.name = '_geojsonTileLayer';
        tile.rawTileData = vtpbf({ layers: { '_geojsonTileLayer': geojsonWrapper }});

        result = [];
        tile.querySourceFeatures(result);
        t.equal(result.length, 1);
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

    t.test('vector tile', (t) => {
        const tile = new Tile(new TileCoord(1, 1, 1));
        let result;

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

    t.test('loadVectorData unloads existing data before overwriting it', (t) => {
        const tile = new Tile(new TileCoord(1, 1, 1));
        tile.state = 'loaded';
        t.stub(tile, 'unloadVectorData');
        const painter = {};

        tile.loadVectorData(null, painter);

        t.ok(tile.unloadVectorData.calledWith(painter));
        t.end();
    });

    t.test('loadVectorData preserves the most recent rawTileData', (t) => {
        const tile = new Tile(new TileCoord(1, 1, 1));
        tile.state = 'loaded';

        tile.loadVectorData(
            createVectorData({rawTileData: createRawTileData()}),
            createPainter()
        );
        tile.loadVectorData(
            createVectorData(),
            createPainter()
        );

        const features = [];
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
    const collisionBoxArray = new CollisionBoxArray();
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
