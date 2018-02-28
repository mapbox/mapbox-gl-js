import { test } from 'mapbox-gl-js-test';
import Tile from '../../../src/source/tile';
import GeoJSONWrapper from '../../../src/source/geojson_wrapper';
import { OverscaledTileID } from '../../../src/source/tile_id';
import fs from 'fs';
import path from 'path';
import vtpbf from 'vt-pbf';
import FeatureIndex from '../../../src/data/feature_index';
import { CollisionBoxArray } from '../../../src/data/array_types';
import { extend } from '../../../src/util/util';
import Context from '../../../src/gl/context';
import { serialize } from '../../../src/util/web_worker_transfer';

test('querySourceFeatures', (t) => {
    const features = [{
        type: 1,
        geometry: [0, 0],
        tags: { oneway: true }
    }];


    t.test('geojson tile', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
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

    t.test('empty geojson tile', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        let result;

        result = [];
        tile.querySourceFeatures(result, {});
        t.equal(result.length, 0);

        const geojsonWrapper = new GeoJSONWrapper([]);
        geojsonWrapper.name = '_geojsonTileLayer';
        tile.rawTileData = vtpbf({ layers: { '_geojsonTileLayer': geojsonWrapper }});
        result = [];
        t.doesNotThrow(() => { tile.querySourceFeatures(result); });
        t.equal(result.length, 0);
        t.end();
    });

    t.test('vector tile', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
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
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        tile.state = 'loaded';
        t.stub(tile, 'unloadVectorData');
        const painter = {};

        tile.loadVectorData(null, painter);

        t.ok(tile.unloadVectorData.calledWith());
        t.end();
    });

    t.test('loadVectorData preserves the most recent rawTileData', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
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

test('Tile#setMask', (t) => {

    t.test('simple mask', (t)=>{
        const tile = new Tile(0, 0, 0);
        const context = new Context(require('gl')(10, 10));
        const a = new OverscaledTileID(1, 0, 1, 0, 0);
        const b = new OverscaledTileID(1, 0, 1, 1, 1);
        const mask = {};
        mask[a.id] = a;
        mask[b.id] = b;
        tile.setMask(mask, context);
        t.deepEqual(tile.mask, mask);
        t.end();
    });

    t.test('complex mask', (t) => {
        const tile = new Tile(0, 0, 0);
        const context = new Context(require('gl')(10, 10));
        const a = new OverscaledTileID(1, 0, 1, 0, 1);
        const b = new OverscaledTileID(1, 0, 1, 1, 0);
        const c = new OverscaledTileID(2, 0, 2, 2, 3);
        const d = new OverscaledTileID(2, 0, 2, 3, 2);
        const e = new OverscaledTileID(3, 0, 3, 6, 7);
        const f = new OverscaledTileID(3, 0, 3, 7, 6);
        const mask = {};
        mask[a.id] = a;
        mask[b.id] = b;
        mask[c.id] = c;
        mask[d.id] = d;
        mask[e.id] = e;
        mask[f.id] = f;
        tile.setMask(mask, context);
        t.deepEqual(tile.mask, mask);
        t.end();

    });
    t.end();

});

test('Tile#isLessThan', (t)=>{
    t.test('correctly sorts tiles', (t)=>{
        const tiles = [
            new OverscaledTileID(9, 0, 9, 146, 195),
            new OverscaledTileID(9, 0, 9, 147, 195),
            new OverscaledTileID(9, 0, 9, 148, 195),
            new OverscaledTileID(9, 0, 9, 149, 195),
            new OverscaledTileID(9, 1, 9, 144, 196),
            new OverscaledTileID(9, 0, 9, 145, 196),
            new OverscaledTileID(9, 0, 9, 146, 196),
            new OverscaledTileID(9, 1, 9, 147, 196),
            new OverscaledTileID(9, 0, 9, 145, 194),
            new OverscaledTileID(9, 0, 9, 149, 196),
            new OverscaledTileID(10, 0, 10, 293, 391),
            new OverscaledTileID(10, 0, 10, 291, 390),
            new OverscaledTileID(10, 1, 10, 293, 390),
            new OverscaledTileID(10, 0, 10, 294, 390),
            new OverscaledTileID(10, 0, 10, 295, 390),
            new OverscaledTileID(10, 0, 10, 291, 391),
        ];

        const sortedTiles = tiles.sort((a, b) => { return a.isLessThan(b) ? -1 : b.isLessThan(a) ? 1 : 0; });

        t.deepEqual(sortedTiles, [
            new OverscaledTileID(9, 0, 9, 145, 194),
            new OverscaledTileID(9, 0, 9, 145, 196),
            new OverscaledTileID(9, 0, 9, 146, 195),
            new OverscaledTileID(9, 0, 9, 146, 196),
            new OverscaledTileID(9, 0, 9, 147, 195),
            new OverscaledTileID(9, 0, 9, 148, 195),
            new OverscaledTileID(9, 0, 9, 149, 195),
            new OverscaledTileID(9, 0, 9, 149, 196),
            new OverscaledTileID(10, 0, 10, 291, 390),
            new OverscaledTileID(10, 0, 10, 291, 391),
            new OverscaledTileID(10, 0, 10, 293, 391),
            new OverscaledTileID(10, 0, 10, 294, 390),
            new OverscaledTileID(10, 0, 10, 295, 390),
            new OverscaledTileID(9, 1, 9, 144, 196),
            new OverscaledTileID(9, 1, 9, 147, 196),
            new OverscaledTileID(10, 1, 10, 293, 390),
        ]);
        t.end();
    });
    t.end();
});

test('expiring tiles', (t) => {
    t.test('regular tiles do not expire', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        tile.state = 'loaded';
        tile.timeAdded = Date.now();

        t.notOk(tile.cacheControl);
        t.notOk(tile.expires);

        t.end();
    });

    t.test('set, get expiry', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        tile.state = 'loaded';
        tile.timeAdded = Date.now();

        t.notOk(tile.cacheControl, 'no cache-control set');
        t.notOk(tile.expires, 'no expires set');

        tile.setExpiryData({
            cacheControl: 'max-age=60'
        });

        // times are fuzzy, so we'll give this a little leeway:
        let expiryTimeout = tile.getExpiryTimeout();
        t.ok(expiryTimeout >= 56000 && expiryTimeout <= 60000, 'cache-control parsed as expected');

        const date = new Date();
        date.setMinutes(date.getMinutes() + 10);
        date.setMilliseconds(0);

        tile.setExpiryData({
            expires: date.toString()
        });

        expiryTimeout = tile.getExpiryTimeout();
        t.ok(expiryTimeout > 598000 && expiryTimeout < 600000, 'expires header set date as expected');

        t.end();
    });

    t.test('exponential backoff handling', (t) => {
        const tile = new Tile(new OverscaledTileID(1, 0, 1, 1, 1));
        tile.state = 'loaded';
        tile.timeAdded = Date.now();

        tile.setExpiryData({
            cacheControl: 'max-age=10'
        });

        const expiryTimeout = tile.getExpiryTimeout();
        t.ok(expiryTimeout >= 8000 && expiryTimeout <= 10000, 'expiry timeout as expected when fresh');

        const justNow = new Date();
        justNow.setSeconds(justNow.getSeconds() - 1);

        // every time we set a tile's expiration to a date already expired,
        // it assumes it comes from a new HTTP response, so this is counted
        // as an extra expired tile request
        tile.setExpiryData({
            expires: justNow
        });
        t.equal(tile.getExpiryTimeout(), 1000, 'tile with one expired request retries after 1 second');

        tile.setExpiryData({
            expires: justNow
        });
        t.equal(tile.getExpiryTimeout(), 2000, 'exponential backoff');
        tile.setExpiryData({
            expires: justNow
        });
        t.equal(tile.getExpiryTimeout(), 4000, 'exponential backoff');

        tile.setExpiryData({
            expires: justNow
        });
        t.equal(tile.getExpiryTimeout(), 8000, 'exponential backoff');

        t.end();
    });

    t.end();
});

function createRawTileData() {
    return fs.readFileSync(path.join(__dirname, '/../../fixtures/mbsv5-6-18-23.vector.pbf'));
}

function createVectorData(options) {
    const collisionBoxArray = new CollisionBoxArray();
    return extend({
        collisionBoxArray: serialize(collisionBoxArray),
        featureIndex: serialize(new FeatureIndex(new OverscaledTileID(1, 0, 1, 1, 1))),
        buckets: []
    }, options);
}

function createPainter() {
    return { style: {} };
}
