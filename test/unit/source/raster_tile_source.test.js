import {test} from '../../util/test.js';
import RasterTileSource from '../../../src/source/raster_tile_source.js';
import window from '../../../src/util/window.js';
import config from '../../../src/util/config.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import {RequestManager} from '../../../src/util/mapbox.js';

function createSource(options, transformCallback) {
    const source = new RasterTileSource('id', options, {send() {}}, options.eventedParent);
    source.onAdd({
        transform: {angle: 0, pitch: 0, showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback)
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
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5]
        }));
        const transformSpy = t.spy((url) => {
            return {url};
        });

        createSource({url: "/source.json"}, transformSpy);
        window.server.respond();

        t.equal(transformSpy.getCall(0).args[0], '/source.json');
        t.equal(transformSpy.getCall(0).args[1], 'Source');
        t.end();
    });

    t.test('respects TileJSON.bounds', (t) => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5]
        });
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                t.false(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132)), 'returns false for tiles outside bounds');
                t.true(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132)), 'returns true for tiles inside bounds');
                t.end();
            }
        });
    });

    t.test('does not error on invalid bounds', (t) => {
        const source = createSource({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, 91]
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                t.deepEqual(source.tileBounds.bounds, {_sw:{lng: -47, lat: -7}, _ne:{lng: -45, lat: 90}}, 'converts invalid bounds to closest valid bounds');
                t.end();
            }
        });
    });

    t.test('respects TileJSON.bounds when loaded from TileJSON', (t) => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: "/source.json"});

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                t.false(source.hasTile(new OverscaledTileID(8, 0, 8, 96, 132)), 'returns false for tiles outside bounds');
                t.true(source.hasTile(new OverscaledTileID(8, 0, 8, 95, 132)), 'returns true for tiles inside bounds');
                t.end();
            }
        });
        window.server.respond();
    });

    t.test('transforms tile urls before requesting', (t) => {
        window.server.respondWith('/source.json', JSON.stringify({
            minzoom: 0,
            maxzoom: 22,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            bounds: [-47, -7, -45, -5]
        }));
        const source = createSource({url: "/source.json"});
        const transformSpy = t.spy(source.map._requestManager, 'transformRequest');
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
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

    t.test('adds @2x to requests on hidpi devices', (t) => {
        // helper function that makes a mock mapbox raster source and makes it load a tile
        function makeMapboxSource(url, extension, loadCb, accessToken) {
            window.devicePixelRatio = 2;
            config.API_URL = 'http://path.png';
            config.REQUIRE_ACCESS_TOKEN = !!accessToken;
            if (accessToken) {
                config.ACCESS_TOKEN = accessToken;
            }

            const source = createSource({url});
            source.tiles = [`${url}/{z}/{x}/{y}.${extension}`];
            const urlNormalizerSpy = t.spy(source.map._requestManager, 'normalizeTileURL');
            const tile = {
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                state: 'loading',
                loadVectorData () {},
                setExpiryData() {}
            };
            source.loadTile(tile, () => {});
            loadCb(urlNormalizerSpy);
        }

        t.test('png extension', (t) => {
            makeMapboxSource('mapbox://path.png', 'png', (spy) => {
                t.ok(spy.calledOnce);
                t.equal(spy.getCall(0).args[0], 'mapbox://path.png/10/5/5.png');
                t.equal(spy.getCall(0).args[1], true);
                t.end();
            });
        });
        t.test('png32 extension', (t) => {
            makeMapboxSource('mapbox://path.png', 'png32', (spy) => {
                t.ok(spy.calledOnce);
                t.equal(spy.getCall(0).args[0], 'mapbox://path.png/10/5/5.png32');
                t.equal(spy.getCall(0).args[1], true);
                t.end();
            });
        });
        t.test('jpg70 extension', (t) => {
            makeMapboxSource('mapbox://path.png', 'jpg70', (spy) => {
                t.ok(spy.calledOnce);
                t.equal(spy.getCall(0).args[0], 'mapbox://path.png/10/5/5.jpg70');
                t.equal(spy.getCall(0).args[1], true);
                t.end();
            });
        });
        t.end();
    });

    t.test('cancels TileJSON request if removed', (t) => {
        const source = createSource({url: "/source.json"});
        source.onRemove();
        t.equal(window.server.lastRequest.aborted, true);
        t.end();
    });

    t.end();
});
