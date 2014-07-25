'use strict';
var test = require('tape').test;
var FeatureTree = require('../../../js/data/featuretree.js');
var vt = require('vector-tile');
var fs = require('fs');
var Protobuf = require('pbf');

test('featuretree', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(__dirname + '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
    function getType(feature) {
        return vt.VectorTileFeature.types[feature.type];
    }
    function getGeometry(feature) {
        return feature.loadGeometry();
    }
    var ft = new FeatureTree(getGeometry, getType);
    var feature = tile.layers.road.feature(0);
    t.ok(feature);
    t.ok(ft, 'can be created');
    ft.insert(feature.bbox(), 'road', feature);
    ft.query({
        params: { },
        x: 0,
        y: 0,
    }, function(err, features) {
        t.deepEqual(features, []);
        t.equal(err, null);
        t.end();
    });
});

test('featuretree with args', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(__dirname + '/../../fixtures/mbsv5-6-18-23.vector.pbf'))));
    function getType(feature) {
        return vt.VectorTileFeature.types[feature.type];
    }
    function getGeometry(feature) {
        return feature.loadGeometry();
    }
    var ft = new FeatureTree(getGeometry, getType);
    var feature = tile.layers.road.feature(0);
    t.ok(feature);
    t.ok(ft, 'can be created');
    ft.insert(feature.bbox(), 'road', feature);
    ft.query({
        params: {
            radius: 5
        },
        x: 0,
        y: 0,
    }, function(err, features) {
        t.deepEqual(features, []);
        t.equal(err, null);
        t.end();
    });
});
