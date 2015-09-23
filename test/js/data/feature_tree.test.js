'use strict';

var test = require('prova');
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

test('featuretree point query', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
    var ft = new FeatureTree({ x: 18, y: 23, z: 6 }, 1);

    for (var i = 0; i < tile.layers.water._features.length; i++) {
        var feature = tile.layers.water.feature(i);
        ft.insert(feature.bbox(), ['water'], feature);
    }

    ft.query({
        source: "mapbox.mapbox-streets-v5",
        scale: 724.0773439350247,
        params: {
            radius: 30,
            includeGeometry: true
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

test('featuretree rect query', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
    var ft = new FeatureTree({ x: 18, y: 23, z: 6 }, 1);

    for (var i = 0; i < tile.layers.water._features.length; i++) {
        var feature = tile.layers.water.feature(i);
        ft.insert(feature.bbox(), ['water'], feature);
    }

    ft.query({
        source: "mapbox.mapbox-streets-v5",
        scale: 724.0773439350247,
        params: {
            includeGeometry: true
        },
        minX: 0,
        minY: 3072,
        maxX: 2048,
        maxY: 4096
    }, function(err, features) {
        t.notEqual(features.length, 0, 'non-empty results for queryFeatures');
        features.forEach(function(f) {
            t.equal(f.type, 'Feature');
            t.equal(f.geometry.type, 'Polygon');
            t.equal(f.layer, 'water');
            t.ok(f.properties, 'result has properties');
            t.notEqual(f.properties.osm_id, undefined, 'properties has osm_id by default');
            var points = Array.prototype.concat.apply([], f.geometry.coordinates);
            var isInBox = points.reduce(function (isInBox, point) {
                return isInBox || (
                    point[0] >= -78.9 &&
                    point[0] <= -72.6 &&
                    point[1] >= 40.7 &&
                    point[1] <= 43.2
                );
            }, false);
            t.ok(isInBox, 'feature has at least one point in queried box');
        });
        t.equal(err, null);
        t.end();
    });
});

test('featuretree query with layerIds', function(t) {
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
            radius: 30,
            layerIds: ['water']
        },
        x: 1842,
        y: 2014
    }, function(err, features) {
        t.ifError(err);
        t.equal(features.length, 2);
    });

    ft.query({
        source: "mapbox.mapbox-streets-v5",
        scale: 724.0773439350247,
        params: {
            radius: 30,
            layerIds: ['none']
        },
        x: 1842,
        y: 2014
    }, function(err, features) {
        t.ifError(err);
        t.equal(features.length, 0);
        t.end();
    });
});
