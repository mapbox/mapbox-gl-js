'use strict';
const test = require('mapbox-gl-js-test').test;
const RasterDEMTileSource = require('../../../src/source/raster_dem_tile_source');
const window = require('../../../src/util/window');
const TileCoord = require('../../../src/source/tile_coord');

function createSource(options, transformCallback) {
    const source = new RasterDEMTileSource('id', options, { send: function() {} }, options.eventedParent);
    source.onAdd({
        transform: { angle: 0, pitch: 0, showCollisionBoxes: false },
        _transformRequest: transformCallback ? transformCallback : (url) => { return { url }; }
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

    t.test('transforms request for TileJSON URL', (t) => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.pngraw"],
            bounds: [-47, -7, -45, -5]
        }));
        const transformSpy = t.spy((url) => {
            return { url };
        });

        createSource({ url: "/source.json" }, transformSpy);
        window.server.respond();

        t.equal(transformSpy.getCall(0).args[0], '/source.json');
        t.equal(transformSpy.getCall(0).args[1], 'Source');
        t.end();
    });

    t.test('transforms tile urls before requesting', (t) => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({ url: "/source.json" });
        const transformSpy = t.spy(source.map, '_transformRequest');
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    coord: new TileCoord(10, 5, 5, 0),
                    state: 'loading',
                    loadVectorData: function () {},
                    setExpiryData: function() {}
                };
                source.loadTile(tile, () => {});

                t.ok(transformSpy.calledOnce);
                t.equal(transformSpy.getCall(0).args[0], 'http://example.com/10/5/5.png');
                t.equal(transformSpy.getCall(0).args[1], 'Tile');
                t.end();

            }
        });
        window.server.respond();
    });
    t.test('populates neighboringTiles', (t) => {
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
                const tile = {
                    coord: new TileCoord(10, 5, 5, 0),
                    state: 'loading',
                    loadVectorData: function () {},
                    setExpiryData: function() {}
                };
                source.loadTile(tile, () => {});
                t.deepEqual(tile.neighboringTiles, { '131210': { backfilled: false },
                    '131242': { backfilled: false },
                    '131274': { backfilled: false },
                    '163978': { backfilled: false },
                    '164042': { backfilled: false },
                    '196746': { backfilled: false },
                    '196778': { backfilled: false },
                    '196810': { backfilled: false } });

                t.end();

            }
        });
        window.server.respond();
    });
    t.end();

});
