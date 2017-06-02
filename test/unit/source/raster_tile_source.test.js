'use strict';
const test = require('mapbox-gl-js-test').test;
const RasterTileSource = require('../../../src/source/raster_tile_source');
const window = require('../../../src/util/window');


function createSource(options) {
    const source = new RasterTileSource('id', options, { send: function() {} }, options.eventedParent);
    source.onAdd({
        transform: { angle: 0, pitch: 0, showCollisionBoxes: false }
    });

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

test('RasterTileSource', (t) => {
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.restore();
        callback();
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
