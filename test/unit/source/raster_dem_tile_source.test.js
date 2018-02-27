'use strict';
import { test } from 'mapbox-gl-js-test';
import RasterDEMTileSource from '../../../src/source/raster_dem_tile_source';
import window from '../../../src/util/window';
import { OverscaledTileID } from '../../../src/source/tile_id';

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
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
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
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        }));
        const source = createSource({ url: "/source.json" });
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData: function () {},
                    setExpiryData: function() {}
                };
                source.loadTile(tile, () => {});

                t.deepEqual(Object.keys(tile.neighboringTiles), [
                    new OverscaledTileID(10, 0, 10, 4, 4).key,
                    new OverscaledTileID(10, 0, 10, 5, 4).key,
                    new OverscaledTileID(10, 0, 10, 6, 4).key,
                    new OverscaledTileID(10, 0, 10, 4, 5).key,
                    new OverscaledTileID(10, 0, 10, 6, 5).key,
                    new OverscaledTileID(10, 0, 10, 4, 6).key,
                    new OverscaledTileID(10, 0, 10, 5, 6).key,
                    new OverscaledTileID(10, 0, 10, 6, 6).key
                ]);

                t.end();

            }
        });
        window.server.respond();
    });

    t.test('populates neighboringTiles with wrapped tiles', (t) => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        }));
        const source = createSource({ url: "/source.json" });
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(5, 0, 5, 31, 5),
                    state: 'loading',
                    loadVectorData: function () {},
                    setExpiryData: function() {}
                };
                source.loadTile(tile, () => {});

                t.deepEqual(Object.keys(tile.neighboringTiles), [
                    new OverscaledTileID(5, 0, 5, 30, 4).key,
                    new OverscaledTileID(5, 0, 5, 31, 4).key,
                    new OverscaledTileID(5, 0, 5, 30, 5).key,
                    new OverscaledTileID(5, 0, 5, 30, 6).key,
                    new OverscaledTileID(5, 0, 5, 31, 6).key,
                    new OverscaledTileID(5, 1, 5, 0,  4).key,
                    new OverscaledTileID(5, 1, 5, 0,  5).key,
                    new OverscaledTileID(5, 1, 5, 0,  6).key
                ]);
                t.end();
            }
        });
        window.server.respond();
    });
    t.end();

});
