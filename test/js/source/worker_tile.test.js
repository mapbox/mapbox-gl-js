'use strict';

const test = require('mapbox-gl-js-test').test;
const WorkerTile = require('../../../js/source/worker_tile');
const Wrapper = require('../../../js/source/geojson_wrapper');
const TileCoord = require('../../../js/source/tile_coord');
const StyleLayer = require('../../../js/style/style_layer');
const util = require('../../../js/util/util');
const featureFilter = require('feature-filter');

function createWorkerTile() {
    return new WorkerTile({
        uid: '',
        zoom: 0,
        maxZoom: 20,
        tileSize: 512,
        source: 'source',
        coord: new TileCoord(1, 1, 1),
        overscaling: 1
    });
}

function createWrapper() {
    return new Wrapper([{
        type: 1,
        geometry: [0, 0],
        tags: {}
    }]);
}

test('WorkerTile#parse', function(t) {
    const layerFamilies = {
        test: [new StyleLayer({
            id: 'test',
            source: 'source',
            type: 'circle',
            layout: {},
            compare: function () { return true; },
            filter: featureFilter()
        })]
    };

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerFamilies, {}, function(err, result) {
        t.ifError(err);
        t.ok(result.buckets[0]);
        t.end();
    });
});

test('WorkerTile#parse skips hidden layers', function(t) {
    const layerFamilies = {
        'test': [new StyleLayer({
            id: 'test',
            source: 'source',
            type: 'circle',
            layout: {},
            compare: function () { return true; },
            filter: featureFilter()
        })],
        'test-hidden': [new StyleLayer({
            id: 'test-hidden',
            source: 'source',
            type: 'fill',
            layout: { visibility: 'none' },
            compare: function () { return true; },
            filter: featureFilter()
        })]
    };

    const tile = createWorkerTile();
    tile.parse(createWrapper(), layerFamilies, {}, function(err, result) {
        t.ifError(err);
        t.equal(Object.keys(result.buckets[0].arrays).length, 1);
        t.end();
    });
});

test('WorkerTile#parse skips layers without a corresponding source layer', function(t) {
    const layerFamilies = {
        'test-sourceless': [new StyleLayer({
            id: 'test',
            source: 'source',
            'source-layer': 'nonesuch',
            type: 'fill',
            layout: {},
            compare: function () { return true; },
            filter: featureFilter()
        })]
    };

    const tile = createWorkerTile();
    tile.parse({layers: {}}, layerFamilies, {}, function(err, result) {
        t.ifError(err);
        t.equal(result.buckets.length, 0);
        t.end();
    });
});

test('WorkerTile#parse warns once when encountering a v1 vector tile layer', function(t) {
    const layerFamilies = {
        'test': [new StyleLayer({
            id: 'test',
            source: 'source',
            'source-layer': 'test',
            type: 'fill',
            layout: {},
            compare: function () { return true; },
            filter: featureFilter()
        })]
    };

    const data = {
        layers: {
            test: {
                version: 1
            }
        }
    };

    t.stub(util, 'warnOnce');

    const tile = createWorkerTile();
    tile.parse(data, layerFamilies, {}, function(err) {
        t.ifError(err);
        t.ok(util.warnOnce.calledWithMatch(/does not use vector tile spec v2/));
        t.end();
    });
});
