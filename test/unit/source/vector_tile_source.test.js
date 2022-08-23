import {test} from '../../util/test.js';
import VectorTileSource from '../../../src/source/vector_tile_source.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import window from '../../../src/util/window.js';
import {Evented} from '../../../src/util/evented.js';
import {RequestManager} from '../../../src/util/mapbox.js';
import sourceFixture from '../../fixtures/source.json';

const wrapDispatcher = (dispatcher) => {
    return {
        getActor() {
            return dispatcher;
        },
        ready: true
    };
};

const mockDispatcher = wrapDispatcher({
    send () {}
});

function createSource(options, {transformCallback, customAccessToken} = {}) {
    const source = new VectorTileSource('id', options, mockDispatcher, options.eventedParent);
    const sourceCache = {clearTiles: () => {}};

    source.onAdd({
        transform: {showCollisionBoxes: false},
        _getMapId: () => 1,
        _requestManager: new RequestManager(transformCallback, customAccessToken),
        _sourceCaches: [sourceCache],
        style: {
            _getSourceCaches: () => [sourceCache]
        }
    });

    source.on('error', (e) => {
        throw e.error;
    });

    return source;
}

test('VectorTileSource', (t) => {
    t.beforeEach(() => {
        window.useFakeXMLHttpRequest();
    });

    t.afterEach(() => {
        window.restore();
    });

    t.test('can be constructed from TileJSON', (t) => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
                t.deepEqual(source.minzoom, 1);
                t.deepEqual(source.maxzoom, 10);
                t.deepEqual(source.attribution, "Mapbox");
                t.end();
            }
        });
    });

    t.test('can be constructed from a TileJSON URL', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(sourceFixture));

        const source = createSource({url: "/source.json"});

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
                t.deepEqual(source.minzoom, 1);
                t.deepEqual(source.maxzoom, 10);
                t.deepEqual(source.attribution, "Mapbox");
                t.end();
            }
        });

        window.server.respond();
    });

    t.test('transforms the request for TileJSON URL', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(sourceFixture));
        const transformSpy = t.spy((url) => {
            return {url};
        });

        createSource({url: "/source.json"}, {transformCallback: transformSpy});
        window.server.respond();
        t.equal(transformSpy.getCall(0).args[0], '/source.json');
        t.equal(transformSpy.getCall(0).args[1], 'Source');
        t.end();
    });

    t.test('fires event with metadata property', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(sourceFixture));
        const source = createSource({url: "/source.json"});
        source.on('data', (e) => {
            if (e.sourceDataType === 'content') t.end();
        });
        window.server.respond();
    });

    t.test('fires "dataloading" event', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(sourceFixture));
        const evented = new Evented();
        let dataloadingFired = false;
        evented.on('dataloading', () => {
            dataloadingFired = true;
        });
        const source = createSource({url: "/source.json", eventedParent: evented});
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                if (!dataloadingFired) t.fail();
                t.end();
            }
        });
        window.server.respond();
    });

    t.test('serialize URL', (t) => {
        const source = createSource({
            url: "http://localhost:2900/source.json"
        });
        t.deepEqual(source.serialize(), {
            type: 'vector',
            url: "http://localhost:2900/source.json"
        });
        t.end();
    });

    t.test('serialize TileJSON', (t) => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        t.deepEqual(source.serialize(), {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        t.end();
    });

    function testScheme(scheme, expectedURL) {
        t.test(`scheme "${scheme}"`, (t) => {
            const source = createSource({
                minzoom: 1,
                maxzoom: 10,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"],
                scheme
            });

            source.dispatcher = wrapDispatcher({
                send(type, params) {
                    t.equal(type, 'loadTile');
                    t.equal(expectedURL, params.request.url);
                    t.end();
                }
            });

            source.on('data', (e) => {
                if (e.sourceDataType === 'metadata') source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5)
                }, () => {});
            });
        });
    }

    testScheme('xyz', 'http://example.com/10/5/5.png');
    testScheme('tms', 'http://example.com/10/5/1018.png');

    function testRemoteScheme(scheme, expectedURL) {
        t.test(`remote scheme "${scheme}"`, (t) => {
            window.server.respondWith('/source.json', JSON.stringify({...sourceFixture, scheme}));

            const source = createSource({url: "/source.json"});

            source.dispatcher = wrapDispatcher({
                send(type, params) {
                    t.equal(type, 'loadTile');
                    t.equal(expectedURL, params.request.url);
                    t.end();
                }
            });

            source.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    t.deepEqual(source.scheme, scheme);
                    source.loadTile({
                        tileID: new OverscaledTileID(10, 0, 10, 5, 5)
                    }, () => {});
                }
            });

            window.server.respond();
        });
    }

    testRemoteScheme('xyz', 'http://example.com/10/5/5.png');
    testRemoteScheme('tms', 'http://example.com/10/5/1018.png');

    t.test('transforms tile urls before requesting', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(sourceFixture));

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

    t.test('canonicalizes tile URLs in inline TileJSON', (t) => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["https://api.mapbox.com/v4/user.map/{z}/{x}/{y}.png?access_token=key"]
        });
        const transformSpy = t.spy(source.map._requestManager, 'transformRequest');
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                t.deepEqual(source.tiles, ["mapbox://tiles/user.map/{z}/{x}/{y}.png?access_token=key"]);
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {});
                t.ok(transformSpy.calledOnce);
                t.equal(transformSpy.getCall(0).args[0], `https://api.mapbox.com/v4/user.map/10/5/5.png?sku=${source.map._requestManager._skuToken}&access_token=key`);
                t.equal(transformSpy.getCall(0).args[1], 'Tile');
                t.end();
            }
        });

    });

    t.test('reloads a loading tile properly', (t) => {
        const source = createSource({
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        const events = [];
        source.dispatcher = wrapDispatcher({
            send(type, params, cb) {
                events.push(type);
                if (cb) setTimeout(cb, 0);
                return 1;
            }
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {
                        this.state = 'loaded';
                        events.push('tileLoaded');
                    },
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {});
                t.equal(tile.state, 'loading');
                source.loadTile(tile, () => {
                    t.same(events, ['loadTile', 'tileLoaded', 'enforceCacheSizeLimit', 'reloadTile', 'tileLoaded']);
                    t.end();
                });
            }
        });
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

    t.test('respects collectResourceTiming parameter on source', (t) => {
        const source = createSource({
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            collectResourceTiming: true
        });
        source.dispatcher = wrapDispatcher({
            send(type, params, cb) {
                t.true(params.request.collectResourceTiming, 'collectResourceTiming is true on dispatcher message');
                setTimeout(cb, 0);
                t.end();

                // do nothing for cache size check dispatch
                source.dispatcher = mockDispatcher;

                return 1;
            }
        });

        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {});
            }
        });
    });

    t.test('cancels TileJSON request if removed', (t) => {
        const source = createSource({url: "/source.json"});
        source.onRemove();
        t.equal(window.server.lastRequest.aborted, true);
        t.end();
    });

    t.test('supports property updates', (t) => {
        window.server.respondWith('/source.json', JSON.stringify(sourceFixture));
        const source = createSource({url: '/source.json'});
        window.server.respond();

        const loadSpy = t.spy(source, 'load');
        const clearTilesSpy = t.spy(source.map._sourceCaches[0], 'clearTiles');

        const responseSpy = t.spy((xhr) =>
            xhr.respond(200, {"Content-Type": "application/json"}, JSON.stringify(sourceFixture)));

        window.server.respondWith('/source.json', responseSpy);

        source.setSourceProperty(() => {
            source.attribution = 'OpenStreetMap';
        });

        window.server.respond();

        t.ok(loadSpy.calledOnce);
        t.ok(responseSpy.calledOnce);
        t.ok(clearTilesSpy.calledOnce);
        t.ok(responseSpy.calledBefore(clearTilesSpy), 'Tiles should be cleared after TileJSON is loaded');

        t.end();
    });

    t.test('supports url property updates', (t) => {
        const source = createSource({
            url: "http://localhost:2900/source.json"
        });
        source.setUrl("http://localhost:2900/source2.json");
        t.deepEqual(source.serialize(), {
            type: 'vector',
            url: "http://localhost:2900/source2.json"
        });
        t.end();
    });

    t.test('supports tiles property updates', (t) => {
        const source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        source.setTiles(["http://example2.com/{z}/{x}/{y}.png"]);
        t.deepEqual(source.serialize(), {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example2.com/{z}/{x}/{y}.png"]
        });
        t.end();
    });

    t.test('supports i18n tilesets', (t) => {
        /* eslint camelcase: ["error", {allow: ["language_options", "worldview_options", "worldview_default"]}] */
        const source = createSource({url: 'mapbox://user.map'}, {customAccessToken: 'key'});

        const manager = source.map._requestManager;
        const transformSpy = t.spy(manager, 'transformRequest');

        // Response for initial request
        window.server.respondWith(manager.normalizeSourceURL('mapbox://user.map'), JSON.stringify({
            id: 'id',
            minzoom: 1,
            maxzoom: 10,
            attribution: 'Mapbox',
            language_options: {en: 'English', es: 'Spanish'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/user.map/{z}/{x}/{y}.png?access_token=key'],
        }));

        // Response for i18n request
        window.server.respondWith(manager.normalizeSourceURL('mapbox://user.map', null, 'es', 'CN'), JSON.stringify({
            id: 'id',
            minzoom: 1,
            maxzoom: 10,
            attribution: 'Mapbox',
            language: {id: 'es'},
            language_options: {en: 'English', es: 'Spanish'},
            worldview: {id: 'CN'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/user.map/{z}/{x}/{y}.png?access_token=key&language=es&worldview=CN'],
        }));

        let initialMetadataEvent = true;

        source.on('data', (e) => {
            if (e.sourceDataType !== 'metadata') return;

            if (initialMetadataEvent) {
                initialMetadataEvent = false;

                // Initial language and worldview
                t.deepEqual(source.tiles, ['mapbox://tiles/user.map/{z}/{x}/{y}.png']);
                t.deepEqual(source.minzoom, 1);
                t.deepEqual(source.maxzoom, 10);
                t.deepEqual(source.attribution, 'Mapbox');
                t.deepEqual(source.language, undefined);
                t.deepEqual(source.languageOptions, {en: 'English', es: 'Spanish'});
                t.deepEqual(source.worldview, 'US');
                t.deepEqual(source.worldviewOptions, {CN: 'China', US: 'United States'});

                source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                }, () => {});

                t.equal(transformSpy.lastCall.firstArg, `https://api.mapbox.com/v4/user.map/10/5/5.png?sku=${manager._skuToken}&access_token=key`);

                // Update source language and worldview
                source._setLanguage('es');
                source._setWorldview('CN');
                window.server.respond();

                return;
            }

            // Updated language and worldview
            t.deepEqual(source.tiles, ['mapbox://tiles/user.map/{z}/{x}/{y}.png?language=es&worldview=CN']);
            t.deepEqual(source.minzoom, 1);
            t.deepEqual(source.maxzoom, 10);
            t.deepEqual(source.attribution, 'Mapbox');
            t.deepEqual(source.language, 'es');
            t.deepEqual(source.languageOptions, {en: 'English', es: 'Spanish'});
            t.deepEqual(source.worldview, 'CN');
            t.deepEqual(source.worldviewOptions, {CN: 'China', US: 'United States'});

            source.loadTile({
                tileID: new OverscaledTileID(10, 0, 10, 5, 5),
            }, () => {});

            t.equal(transformSpy.lastCall.firstArg, `https://api.mapbox.com/v4/user.map/10/5/5.png?language=es&worldview=CN&sku=${manager._skuToken}&access_token=key`);

            t.end();
        });

        window.server.respond();
    });

    t.end();
});
