'use strict';

var test = require('tape');
var vt = require('vector-tile');
var fs = require('fs');
var Protobuf = require('pbf');
var FeatureTree = require('../../../js/data/feature_tree');
var path = require('path');

test('featuretree', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
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
        y: 0
    }, function(err, features) {
        t.deepEqual(features, []);
        t.equal(err, null);
        t.end();
    });
});

test('featuretree with args', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
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
        y: 0
    }, function(err, features) {
        t.deepEqual(features, []);
        t.equal(err, null);
        t.end();
    });
});

test('featuretree query', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
    function getType(feature) {
        return vt.VectorTileFeature.types[feature.type];
    }
    function getGeometry(feature) {
        return feature.loadGeometry();
    }
    var ft = new FeatureTree(getGeometry, getType);

    for (var i = 0; i < tile.layers.water._features.length; i++) {
        var feature = tile.layers.water.feature(i);
        ft.insert(feature.bbox(), ['water'], feature);
    }

    ft.query({
        source: "mapbox.mapbox-streets-v5",
        scale: 724.0773439350247,
        params: {
            radius: 30
        },
        x: 1842,
        y: 2014
    }, function(err, features) {
        t.notEqual(features.length, 0, 'non-empty results for queryFeatures');
        features.forEach(function(f) {
            t.equal(f.type, 'Feature');
            t.equal(f.geometry.type, 'Polygon');
            t.equal(f.layer, 'water');
            t.ok(f.properties, 'result has properties');
            t.notEqual(f.properties.osm_id, undefined, 'properties has osm_id by default');
        });
        t.equal(err, null);
        t.end();
    });
});
