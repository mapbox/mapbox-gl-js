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
    t.beforeEach((callback) => {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach((callback) => {
        window.restore();
        callback();
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
            tiles: ["https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key"]
        });
        const transformSpy = t.spy(source.map._requestManager, 'transformRequest');
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                t.deepEqual(source.tiles, ["mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key"]);
                const tile = {
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                    state: 'loading',
                    loadVectorData () {},
                    setExpiryData() {}
                };
                source.loadTile(tile, () => {});
                t.ok(transformSpy.calledOnce);
                t.equal(transformSpy.getCall(0).args[0], `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/10/5/5.png?sku=${source.map._requestManager._skuToken}&access_token=key`);
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

    /* eslint camelcase: ["error", {allow: ["language_options", "worldview_options", "worldview_default"]}] */
    // Tests source instance state after requesting a TileJSON with i18n support
    function testI18nTileJson(description, url, language, worldview, tileJsonResponse, expectedSource) {
        t.test(description, (t) => {
            const source = createSource({url, language, worldview}, {customAccessToken: 'key'});

            const manager = source.map._requestManager;
            const transformSpy = t.spy(manager, 'transformRequest');

            const tileJsonUrl = manager.normalizeSourceURL(url, null, language, worldview);
            window.server.respondWith(tileJsonUrl, JSON.stringify(tileJsonResponse));

            source.on('data', (e) => {
                if (e.sourceDataType !== 'metadata') return;

                t.deepEqual(source.tiles, expectedSource.tiles, 'tiles don\'t match');
                t.deepEqual(source.language, expectedSource.language, 'languages don\'t match');
                t.deepEqual(source.worldview, expectedSource.worldview, 'worldviews don\'t match');

                source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                }, () => {});

                const tileRequestUrl = new URL(transformSpy.lastCall.firstArg);
                t.equal(tileRequestUrl.searchParams.get('language'), source.language);

                // Worldview must be present in the tile request only if it's explicitly set
                if (worldview) t.equal(tileRequestUrl.searchParams.get('worldview'), source.worldview, 'worldviews don\'t match');

                t.end();
            });

            window.server.respond();
        });
    }

    testI18nTileJson('Supports i18n TileJSON with no language and no worldview',
        'mapbox://mapbox.mapbox-streets-v8',
        null,
        null,
        {
            id: 'id',
            language_options: {en: 'English', fr: 'French', 'zh-Hans': 'Simplified Chinese'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key'],
        },
        {
            language: undefined,
            worldview: undefined,
            tiles: ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png'],
        }
    );

    testI18nTileJson('Supports i18n TileJSON with English language and US worldview',
        'mapbox://mapbox.mapbox-streets-v8',
        'en',
        'US',
        {
            id: 'id',
            language: {id: 'en'},
            language_options: {en: 'English', fr: 'French', 'zh-Hans': 'Simplified Chinese'},
            worldview: {id: 'US'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key&language=en&worldview=US'],
        },
        {
            language: 'en',
            worldview: 'US',
            tiles: ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?language=en&worldview=US'],
        }
    );

    testI18nTileJson('Supports i18n TileJSON with Simplified Chinese and China worldview',
        'mapbox://mapbox.mapbox-streets-v8',
        'zh-Hans',
        'CN',
        {
            id: 'id',
            language: {id: 'zh-Hans'},
            language_options: {en: 'English', fr: 'French', 'zh-Hans': 'Simplified Chinese'},
            worldview: {id: 'CN'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key&language=zh-Hans&worldview=CN'],
        },
        {
            language: 'zh-Hans',
            worldview: 'CN',
            tiles: ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?language=zh-Hans&worldview=CN'],
        }
    );

    testI18nTileJson('Supports i18n TileJSON with Canadian French (with extended subtag) and no worldview',
        'mapbox://mapbox.mapbox-streets-v8',
        'fr-CA',
        null,
        {
            id: 'id',
            language: {id: 'fr'},
            language_options: {en: 'English', fr: 'French', 'zh-Hans': 'Simplified Chinese'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key&language=fr'],
        },
        {
            language: 'fr',
            worldview: undefined,
            tiles: ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?language=fr'],
        }
    );

    testI18nTileJson('Supports i18n TileJSON with no language and China worldview',
        'mapbox://mapbox.mapbox-streets-v8',
        null,
        'CN',
        {
            id: 'id',
            language_options: {en: 'English', fr: 'French', 'zh-Hans': 'Simplified Chinese'},
            worldview: {id: 'CN'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key&worldview=CN'],
        },
        {
            worldview: 'CN',
            tiles: ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?worldview=CN'],
        }
    );

    testI18nTileJson('Supports i18n TileJSON with Composite Sources',
        'mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2',
        'zh-Hans',
        'CN',
        {
            id: undefined,
            language: {'mapbox.mapbox-streets-v8': 'zh-Hans'},
            language_options: {en: 'English', fr: 'French', 'zh-Hans': 'Simplified Chinese'},
            worldview: {'mapbox.mapbox-streets-v8': 'CN'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key&language=zh-Hans&worldview=CN'],
        },
        {
            language: 'zh-Hans',
            worldview: 'CN',
            tiles: ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?language=zh-Hans&worldview=CN'],
        }
    );

    t.test('supports i18n tileset updates', (t) => {
        const source = createSource({url: 'mapbox://mapbox.mapbox-streets-v8'}, {customAccessToken: 'key'});

        const manager = source.map._requestManager;
        const transformSpy = t.spy(manager, 'transformRequest');

        // 1. Response for request with no language, no worldview
        window.server.respondWith(manager.normalizeSourceURL('mapbox://mapbox.mapbox-streets-v8'), JSON.stringify({
            id: 'id',
            language_options: {en: 'English', es: 'Spanish', fr: 'French'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key'],
        }));

        // 2. Response for request with Spanish language and China worldview
        window.server.respondWith(manager.normalizeSourceURL('mapbox://mapbox.mapbox-streets-v8', null, 'es', 'CN'), JSON.stringify({
            id: 'id',
            language: {id: 'es'},
            language_options: {en: 'English', es: 'Spanish', fr: 'French'},
            worldview: {id: 'CN'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key&language=es&worldview=CN'],
        }));

        // 3. Response for request with Canadian French language and China worldview
        window.server.respondWith(manager.normalizeSourceURL('mapbox://mapbox.mapbox-streets-v8', null, 'fr-CA', 'CN'), JSON.stringify({
            id: 'id',
            language: {id: 'fr'},
            language_options: {en: 'English', es: 'Spanish', fr: 'French'},
            worldview: {id: 'CN'},
            worldview_default: 'US',
            worldview_options: {CN: 'China', US: 'United States'},
            tiles: ['https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?access_token=key&language=fr&worldview=CN'],
        }));

        let step = 0;
        source.on('data', (e) => {
            if (e.sourceDataType !== 'metadata') return;

            // No language, no worldview
            if (step === 0) {
                t.deepEqual(source.tiles, ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png']);
                t.deepEqual(source.language, undefined);
                t.deepEqual(source.worldview, undefined);

                source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                }, () => {});

                t.equal(transformSpy.lastCall.firstArg, `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/10/5/5.png?sku=${manager._skuToken}&access_token=key`);

                // Set Spanish language and China worldview
                step++;
                source._setLanguage('es');
                source._setWorldview('CN');
                window.server.respond();

                return;
            }

            // Spanish language, China worldview
            if (step === 1) {
                t.deepEqual(source.tiles, ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?language=es&worldview=CN']);
                t.deepEqual(source.language, 'es');
                t.deepEqual(source.worldview, 'CN');

                source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                }, () => {});

                t.equal(transformSpy.lastCall.firstArg, `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/10/5/5.png?language=es&worldview=CN&sku=${manager._skuToken}&access_token=key`);

                // Set Canadian French (with extended subtag) and no worldview
                step++;
                source._setLanguage('fr-CA');
                source._setWorldview('CN');
                window.server.respond();

                return;
            }

            // Canadian French (with extended subtag), China worldview
            if (step === 2) {
                t.deepEqual(source.tiles, ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png?language=fr&worldview=CN']);
                t.deepEqual(source.language, 'fr');
                t.deepEqual(source.worldview, 'CN');

                source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                }, () => {});

                t.equal(transformSpy.lastCall.firstArg, `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/10/5/5.png?language=fr&worldview=CN&sku=${manager._skuToken}&access_token=key`);

                // Set no language and no worldview
                step++;
                source._setLanguage();
                source._setWorldview();
                window.server.respond();

                return;
            }

            // No language, no worldview
            if (step === 3) {
                t.deepEqual(source.tiles, ['mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.png']);
                t.deepEqual(source.language, undefined, 'Can reset the language to default');
                t.deepEqual(source.worldview, undefined, 'Can reset the worldview to default');

                source.loadTile({
                    tileID: new OverscaledTileID(10, 0, 10, 5, 5),
                }, () => {});

                t.equal(transformSpy.lastCall.firstArg, `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/10/5/5.png?sku=${manager._skuToken}&access_token=key`);
            }

            t.end();
        });

        window.server.respond();
    });

    t.end();
});
