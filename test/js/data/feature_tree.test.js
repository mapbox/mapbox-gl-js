'use strict';

var test = require('tap').test;
var vt = require('vector-tile');
var fs = require('fs');
var Point = require('point-geometry');
var Protobuf = require('pbf');
var FeatureTree = require('../../../js/data/feature_tree');
var path = require('path');
var CollisionTile = require('../../../js/symbol/collision_tile');

var styleLayers = {
    water: {
        type: 'fill',
        paint: {
            'fill-translate': [0, 0]
        }
    },
    road: {
        type: 'line',
        paint: {
            'line-offset': 0,
            'line-translate': [0, 0],
            'line-width': 0
        }
    }
};

test('featuretree', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
    function getType(feature) {
        return vt.VectorTileFeature.types[feature.type];
    }
    function getGeometry(feature) {
        return feature.loadGeometry();
    }
    var ft = new FeatureTree(getGeometry, getType, new CollisionTile(0, 0));
    var feature = tile.layers.road.feature(0);
    t.ok(feature);
    t.ok(ft, 'can be created');
    ft.insert(feature.bbox(), ['road'], feature);
    t.deepEqual(ft.query({
        scale: 1,
        tileSize: 512,
        params: { },
        queryGeometry: [new Point(0, 0)]
    }, styleLayers), []);
    t.end();
});

test('featuretree with args', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
    function getType(feature) {
        return vt.VectorTileFeature.types[feature.type];
    }
    function getGeometry(feature) {
        return feature.loadGeometry();
    }
    var ft = new FeatureTree(getGeometry, getType, new CollisionTile(0, 0));
    var feature = tile.layers.road.feature(0);
    t.ok(feature);
    t.ok(ft, 'can be created');
    ft.insert(feature.bbox(), ['road'], feature);
    t.deepEqual(ft.query({
        params: {},
        scale: 1,
        tileSize: 512,
        queryGeometry: [new Point(0, 0)]
    }, styleLayers), []);
    t.end();
});

test('featuretree point query', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
    var ft = new FeatureTree({ x: 18, y: 23, z: 6 }, 1, new CollisionTile(0, 0));

    for (var i = 0; i < tile.layers.water._features.length; i++) {
        var feature = tile.layers.water.feature(i);
        ft.insert(feature.bbox(), ['water'], feature);
    }
    var features = ft.query({
        source: "mapbox.mapbox-streets-v5",
        scale: 1.4142135624,
        tileSize: 512,
        params: {
            includeGeometry: true
        },
        queryGeometry: [new Point(-180, 1780)]
    }, styleLayers);
    t.notEqual(features.length, 0, 'non-empty results for queryFeatures');
    features.forEach(function(f) {
        t.equal(f.type, 'Feature');
        t.equal(f.geometry.type, 'Polygon');
        t.equal(f.layer, 'water');
        t.ok(f.properties, 'result has properties');
        t.notEqual(f.properties.osm_id, undefined, 'properties has osm_id by default');
    });
    t.end();
});

test('featuretree rect query', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
    var ft = new FeatureTree({ x: 18, y: 23, z: 6 }, 1, new CollisionTile(0, 0));

    for (var i = 0; i < tile.layers.water._features.length; i++) {
        var feature = tile.layers.water.feature(i);
        ft.insert(feature.bbox(), ['water'], feature);
    }

    var features = ft.query({
        source: "mapbox.mapbox-streets-v5",
        scale: 1.4142135624,
        tileSize: 512,
        params: {
            includeGeometry: true
        },
        queryGeometry: [
            new Point(0, 3072),
            new Point(2048, 3072),
            new Point(2048, 4096),
            new Point(0, 4096),
            new Point(0, 3072)
        ]
    }, styleLayers);
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
    t.end();
});

test('featuretree query with layerIds', function(t) {
    var tile = new vt.VectorTile(new Protobuf(new Uint8Array(fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf')))));
    function getType(feature) {
        return vt.VectorTileFeature.types[feature.type];
    }
    function getGeometry(feature) {
        return feature.loadGeometry();
    }
    var ft = new FeatureTree(getGeometry, getType, new CollisionTile(0, 0));

    for (var i = 0; i < tile.layers.water._features.length; i++) {
        var feature = tile.layers.water.feature(i);
        ft.insert(feature.bbox(), ['water'], feature);
    }

    var features = ft.query({
        source: "mapbox.mapbox-streets-v5",
        scale: 1.4142135624,
        tileSize: 512,
        params: {
            layerIds: ['water']
        },
        queryGeometry: [new Point(-180, 1780)]
    }, styleLayers);

    t.equal(features.length, 1);

    var features2 = ft.query({
        source: "mapbox.mapbox-streets-v5",
        scale: 1.4142135624,
        tileSize: 512,
        params: {
            layerIds: ['none']
        },
        queryGeometry: [new Point(1842, 2014)]
    }, styleLayers);

    t.equal(features2.length, 0);
    t.end();
});
