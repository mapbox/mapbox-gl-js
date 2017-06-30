'use strict';
const test = require('mapbox-gl-js-test').test;
const RasterTerrainTileSource = require('../../../src/source/raster_terrain_tile_source');
const window = require('../../../src/util/window');
const Evented = require('../../../src/util/evented');


function createSource(options) {
    const source = new RasterTerrainTileSource('id', options, { send: function() {} }, options.eventedParent);
    source.onAdd({
        transform: { angle: 0, pitch: 0, showCollisionBoxes: false }
    });

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

test('RasterTerrainTileSource', (t) => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.restore();
        callback();
    });

    t.test('neighboring tiles are populated for each added tile', (t)=>{
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
        });

        const neighbs = source._getNeighboringTiles(52440939);
        console.log(neighbs)
        t.end();

    })

    t.test('fires event with metadata property', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(require('../../fixtures/source')));
        const source = createSource({ url: "/source.json" });
        source.on('data', (e)=>{
            if (e.sourceDataType === 'content') t.end();
        });
        window.server.respond();
    });

    t.test('fires "dataloading" event', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(require('../../fixtures/source')));
        const evented = new Evented();
        let dataloadingFired = false;
        evented.on('dataloading', () => {
            dataloadingFired = true;
        });
        const source = createSource({ url: "/source.json", eventedParent: evented });
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                if (!dataloadingFired) t.fail();
                t.end();
            }
        });
        window.server.respond();
    });

    t.test('respects TileJSON.bounds', (t)=>{
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
        });
        source.setBounds([-47, -7, -45, -5]);
        t.false(source.hasTile({z: 8, x:96, y: 132}), 'returns false for tiles outside bounds');
        t.true(source.hasTile({z: 8, x:95, y: 132}), 'returns true for tiles inside bounds');
        t.end();
    });

    t.test('does not error on invalid bounds', (t)=>{
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
        });
        source.setBounds([-47, -7, -45, 91]);
        t.deepEqual(source.tileBounds.bounds, {_sw:{lng: -47, lat: -7}, _ne:{lng: -45, lat: 90}}, 'converts invalid bounds to closest valid bounds');
        t.end();
    });

    t.test('respects TileJSON.bounds when loaded from TileJSON', (t)=>{
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({ url: "/source.json" });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                t.false(source.hasTile({z: 8, x:96, y: 132}), 'returns false for tiles outside bounds');
                t.true(source.hasTile({z: 8, x:95, y: 132}), 'returns true for tiles inside bounds');
                t.end();
            }
        });
        window.server.respond();
    });
    t.end();

});
