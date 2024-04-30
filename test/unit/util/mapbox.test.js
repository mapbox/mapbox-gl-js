import {describe, test, beforeEach, afterEach, expect, vi, equalWithPrecision} from "../../util/vitest.js";
import {getRequestBody} from '../../util/network.js';
import * as mapbox from '../../../src/util/mapbox.js';
import config from '../../../src/util/config.js';
import webpSupported from '../../../src/util/webp_supported.js';
import {uuid} from '../../../src/util/util.js';
import {SKU_ID} from '../../../src/util/sku_token.js';
import {version} from '../../../package.json';
import assert from 'assert';

const mapboxTileURLs = [
    'https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7/{z}/{x}/{y}.vector.pbf',
    'https://b.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7/{z}/{x}/{y}.vector.pbf'
];

const nonMapboxTileURLs = [
    'https://a.example.com/tiles/{z}/{x}/{y}.mvt',
    'https://b.example.com/tiles/{z}/{x}/{y}.mvt'
];

function withFixedDate(now, fn) {
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => now);
    fn();
    dateNow.mockRestore();
}

restore();

function restore() {
    window.useFakeXMLHttpRequest = function() {
        const spy = vi.spyOn(window, 'fetch').mockImplementation(() => {
            return Promise.resolve(new window.Response());
        });
        window.server = {
            get requests() {
                return spy.mock.calls.map(args => {
                    return {
                        get url() {
                            return args[0].url;
                        },
                        get method() {
                            return args[0].method;
                        },
                        get requestBody() {
                            return getRequestBody(args[0]);
                        },
                        respond() {}
                    };
                });
            }
        };
    };

    window.restore = restore;

    return window;
}

describe("mapbox", () => {
    beforeEach(() => {
        config.ACCESS_TOKEN = 'key';
        config.REQUIRE_ACCESS_TOKEN = true;
        config.API_URL = 'https://api.mapbox.com';
    });

    describe('RequestManager', () => {
        const manager = new mapbox.RequestManager();

        test('creates token and expiration timestamp on construction', () => {
            expect(manager._skuToken).toBeTruthy();
            expect(manager._skuTokenExpiresAt).toBeTruthy();
        });

        test('identifies expired tokens correctly', () => {
            const now = +Date.now();
            const ms13Hours = (13 * 60 * 60 * 1000);
            expect(manager._isSkuTokenExpired()).toBeFalsy();
            const token = manager._skuToken;
            withFixedDate(now + ms13Hours, () => manager.normalizeTileURL("mapbox://tiles/a.b/0/0/0.pbf"));
            expect(token).not.toEqual(manager._skuToken);
        });

        test('takes map-specific tokens correctly', () => {
            const m = new mapbox.RequestManager(undefined, 'customAccessToken');
            expect(m.normalizeStyleURL('mapbox://styles/user/style')).toEqual(
                `https://api.mapbox.com/styles/v1/user/style?sdk=js-${version}&access_token=customAccessToken`
            );
        });

        webpSupported.supported = false;

        describe('.normalizeStyleURL', () => {
            test(
                'returns an API URL with access_token parameter when no query string',
                () => {
                    expect(manager.normalizeStyleURL('mapbox://styles/user/style')).toEqual(
                        `https://api.mapbox.com/styles/v1/user/style?sdk=js-${version}&access_token=key`
                    );
                    expect(manager.normalizeStyleURL('mapbox://styles/user/style/draft')).toEqual(
                        `https://api.mapbox.com/styles/v1/user/style/draft?sdk=js-${version}&access_token=key`
                    );
                }
            );

            test(
                'returns an API URL with access_token parameter when query string exists',
                () => {
                    expect(manager.normalizeStyleURL('mapbox://styles/user/style?fresh=true')).toEqual(
                        `https://api.mapbox.com/styles/v1/user/style?fresh=true&sdk=js-${version}&access_token=key`
                    );
                    expect(manager.normalizeStyleURL('mapbox://styles/user/style/draft?fresh=true')).toEqual(
                        `https://api.mapbox.com/styles/v1/user/style/draft?fresh=true&sdk=js-${version}&access_token=key`
                    );
                    expect(manager.normalizeStyleURL('mapbox://styles/foo/bar')).toEqual(
                        `https://api.mapbox.com/styles/v1/foo/bar?sdk=js-${version}&access_token=key`
                    );
                }
            );

            test('ignores non-mapbox:// scheme', () => {
                expect(manager.normalizeStyleURL('http://path')).toEqual('http://path');
            });

            test('handles custom API_URLs with paths', () => {
                config.API_URL = 'https://test.example.com/api.mapbox.com';
                expect(manager.normalizeStyleURL('mapbox://styles/foo/bar')).toEqual(
                    `https://test.example.com/api.mapbox.com/styles/v1/foo/bar?sdk=js-${version}&access_token=key`
                );
            });
        });

        describe('.normalizeSourceURL', () => {
            test('returns a v4 URL with access_token parameter', () => {
                expect(manager.normalizeSourceURL('mapbox://user.map')).toEqual('https://api.mapbox.com/v4/user.map.json?secure&access_token=key');
            });

            test('uses provided access token', () => {
                expect(manager.normalizeSourceURL('mapbox://user.map', 'token')).toEqual('https://api.mapbox.com/v4/user.map.json?secure&access_token=token');
            });

            test('uses provided query parameters', () => {
                expect(manager.normalizeSourceURL('mapbox://user.map?foo=bar', 'token')).toEqual(
                    'https://api.mapbox.com/v4/user.map.json?foo=bar&secure&access_token=token'
                );
            });

            test('works with composite sources', () => {
                expect(manager.normalizeSourceURL('mapbox://one.a,two.b,three.c')).toEqual(
                    'https://api.mapbox.com/v4/one.a,two.b,three.c.json?secure&access_token=key'
                );
            });

            test('adds language query parameter', () => {
                expect(manager.normalizeSourceURL('mapbox://user.map?foo=bar', 'token', 'es')).toEqual(
                    'https://api.mapbox.com/v4/user.map.json?foo=bar&secure&language=es&access_token=token'
                );
            });

            test('adds worldview query parameter', () => {
                expect(
                    manager.normalizeSourceURL('mapbox://user.map?foo=bar', 'token', null, 'JP')
                ).toEqual(
                    'https://api.mapbox.com/v4/user.map.json?foo=bar&secure&worldview=JP&access_token=token'
                );
            });

            test('adds language and worldview query parameters', () => {
                expect(
                    manager.normalizeSourceURL('mapbox://user.map?foo=bar', 'token', 'es', 'JP')
                ).toEqual(
                    'https://api.mapbox.com/v4/user.map.json?foo=bar&secure&language=es&worldview=JP&access_token=token'
                );
            });

            test('throws an error if no access token is provided', () => {
                config.ACCESS_TOKEN = null;
                expect(() => { manager.normalizeSourceURL('mapbox://user.map'); }).toThrowError('An API access token is required to use Mapbox GL.');
                config.ACCESS_TOKEN = 'key';
            });

            test('throws an error if a secret access token is provided', () => {
                config.ACCESS_TOKEN = 'sk.abc.123';
                expect(() => { manager.normalizeSourceURL('mapbox://user.map'); }).toThrowError('Use a public access token (pk.*) with Mapbox GL');
                config.ACCESS_TOKEN = 'key';
            });

            test('ignores non-mapbox:// scheme', () => {
                expect(manager.normalizeSourceURL('http://path')).toEqual('http://path');
            });

            test('handles custom API_URLs with paths', () => {
                config.API_URL = 'https://test.example.com/api.mapbox.com';
                expect(manager.normalizeSourceURL('mapbox://one.a')).toEqual(
                    'https://test.example.com/api.mapbox.com/v4/one.a.json?secure&access_token=key'
                );
            });

            test('removes secure params if custom API_URL is http', () => {
                config.API_URL = 'http://test.example.com/api.mapbox.com';
                expect(manager.normalizeSourceURL('mapbox://one.a')).toEqual('http://test.example.com/api.mapbox.com/v4/one.a.json?access_token=key');
            });
        });

        describe('.normalizeGlyphsURL', () => {
            test('normalizes mapbox:// URLs when no query string', () => {
                expect(
                    manager.normalizeGlyphsURL('mapbox://fonts/boxmap/{fontstack}/{range}.pbf')
                ).toEqual(
                    'https://api.mapbox.com/fonts/v1/boxmap/{fontstack}/{range}.pbf?access_token=key'
                );
            });

            test('normalizes mapbox:// URLs when query string exists', () => {
                expect(
                    manager.normalizeGlyphsURL('mapbox://fonts/boxmap/{fontstack}/{range}.pbf?fresh=true')
                ).toEqual(
                    'https://api.mapbox.com/fonts/v1/boxmap/{fontstack}/{range}.pbf?fresh=true&access_token=key'
                );
            });

            test('ignores non-mapbox:// scheme', () => {
                expect(manager.normalizeGlyphsURL('http://path')).toEqual('http://path');
            });

            test('handles custom API_URLs with paths', () => {
                config.API_URL = 'https://test.example.com/api.mapbox.com';
                expect(
                    manager.normalizeGlyphsURL('mapbox://fonts/boxmap/{fontstack}/{range}.pbf')
                ).toEqual(
                    'https://test.example.com/api.mapbox.com/fonts/v1/boxmap/{fontstack}/{range}.pbf?access_token=key'
                );
            });
        });

        describe('.normalizeSpriteURL', () => {
            test('normalizes mapbox:// URLs when no query string', () => {
                expect(
                    manager.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8', '', '.json')
                ).toEqual(
                    'https://api.mapbox.com/styles/v1/mapbox/streets-v8/sprite.json?access_token=key'
                );

                expect(
                    manager.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8', '@2x', '.png')
                ).toEqual(
                    'https://api.mapbox.com/styles/v1/mapbox/streets-v8/sprite@2x.png?access_token=key'
                );

                expect(
                    manager.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8/draft', '@2x', '.png')
                ).toEqual(
                    'https://api.mapbox.com/styles/v1/mapbox/streets-v8/draft/sprite@2x.png?access_token=key'
                );
            });

            test('normalizes mapbox:// URLs when query string exists', () => {
                expect(
                    manager.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8?fresh=true', '', '.json')
                ).toEqual(
                    'https://api.mapbox.com/styles/v1/mapbox/streets-v8/sprite.json?fresh=true&access_token=key'
                );

                expect(
                    manager.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8?fresh=false', '@2x', '.png')
                ).toEqual(
                    'https://api.mapbox.com/styles/v1/mapbox/streets-v8/sprite@2x.png?fresh=false&access_token=key'
                );

                expect(
                    manager.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8/draft?fresh=true', '@2x', '.png')
                ).toEqual(
                    'https://api.mapbox.com/styles/v1/mapbox/streets-v8/draft/sprite@2x.png?fresh=true&access_token=key'
                );
            });

            test('concantenates path, ratio, and extension for non-mapbox:// scheme', () => {
                expect(manager.normalizeSpriteURL('http://www.foo.com/bar', '@2x', '.png')).toEqual('http://www.foo.com/bar@2x.png');
            });

            test('concantenates path, ratio, and extension for file:/// scheme', () => {
                expect(manager.normalizeSpriteURL('file:///path/to/bar', '@2x', '.png')).toEqual('file:///path/to/bar@2x.png');
            });

            test('normalizes non-mapbox:// scheme when query string exists', () => {
                expect(
                    manager.normalizeSpriteURL('http://www.foo.com/bar?fresh=true', '@2x', '.png')
                ).toEqual('http://www.foo.com/bar@2x.png?fresh=true');
            });

            test('handles custom API_URLs with paths', () => {
                config.API_URL = 'https://test.example.com/api.mapbox.com';
                expect(
                    manager.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8', '', '.json')
                ).toEqual(
                    'https://test.example.com/api.mapbox.com/styles/v1/mapbox/streets-v8/sprite.json?access_token=key'
                );
            });
        });

        test('canonicalize raster tileset', () => {
            const tileset = {tiles: ["http://a.tiles.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png?access_token=key"]};
            manager.canonicalizeTileset(tileset, "mapbox://mapbox.satellite");
            expect(manager.canonicalizeTileset(tileset, "mapbox://mapbox.satellite")).toStrictEqual(["mapbox://tiles/mapbox.satellite/{z}/{x}/{y}.png"]);
        });

        test('canonicalize vector tileset', () => {
            const tileset = {tiles: ["http://a.tiles.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}.vector.pbf?access_token=key"]};
            expect(manager.canonicalizeTileset(tileset, "mapbox://mapbox.streets")).toStrictEqual(["mapbox://tiles/mapbox.streets/{z}/{x}/{y}.vector.pbf"]);
        });

        test('.canonicalizeTileURL', () => {
            const tileJSONURL = "mapbox://mapbox.streets";

            expect(
                manager.canonicalizeTileURL("http://a.tiles.mapbox.com/v4/a.b/{z}/{x}/{y}.vector.pbf", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.vector.pbf");
            expect(
                manager.canonicalizeTileURL("http://b.tiles.mapbox.com/v4/a.b/{z}/{x}/{y}.vector.pbf", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.vector.pbf");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.vector.pbf", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.vector.pbf");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.vector.pbf?access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.vector.pbf");
            expect(
                manager.canonicalizeTileURL("https://api.mapbox.cn/v4/a.b/{z}/{x}/{y}.vector.pbf?access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.vector.pbf");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b,c.d/{z}/{x}/{y}.vector.pbf?access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b,c.d/{z}/{x}/{y}.vector.pbf");
            expect(
                manager.canonicalizeTileURL("http://a.tiles.mapbox.com/v4/a.b/{z}/{x}/{y}.vector.pbf?access_token=key&custom=parameter", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.vector.pbf?custom=parameter");
            expect(
                manager.canonicalizeTileURL("http://a.tiles.mapbox.com/v4/a.b/{z}/{x}/{y}.vector.pbf?custom=parameter&access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.vector.pbf?custom=parameter");
            expect(
                manager.canonicalizeTileURL("http://a.tiles.mapbox.com/v4/a.b/{z}/{x}/{y}.vector.pbf?custom=parameter&access_token=key&second=param", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.vector.pbf?custom=parameter&second=param");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.jpg?access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.jpg");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.jpg70?access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.jpg70");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.jpg?access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.jpg");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.jpg70?access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.jpg70");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.png", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.png");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.png?access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.png");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.png", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.png");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.png?access_token=key", tileJSONURL)
            ).toEqual("mapbox://tiles/a.b/{z}/{x}/{y}.png");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/raster/v1/a.b/{z}/{x}/{y}.png?access_token=key", tileJSONURL)
            ).toEqual("mapbox://raster/a.b/{z}/{x}/{y}.png");
            expect(
                manager.canonicalizeTileURL("http://api.mapbox.com/rasterarrays/v1/a.b/{z}/{x}/{y}.mrt?access_token=key", tileJSONURL)
            ).toEqual("mapbox://rasterarrays/a.b/{z}/{x}/{y}.mrt");

            // We don't ever expect to see these inputs, but be safe anyway.
            expect(manager.canonicalizeTileURL("http://path")).toEqual("http://path");
            expect(manager.canonicalizeTileURL("http://api.mapbox.com/v4/")).toEqual("http://api.mapbox.com/v4/");
            expect(manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.")).toEqual("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}.");
            expect(manager.canonicalizeTileURL("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}/.")).toEqual("http://api.mapbox.com/v4/a.b/{z}/{x}/{y}/.");
        });

        describe('.normalizeTileURL', () => {
            test('.normalizeTileURL does nothing on 1x devices', () => {
                config.API_URL = 'http://path.png';
                config.REQUIRE_ACCESS_TOKEN = false;
                webpSupported.supported = false;
                expect(manager.normalizeTileURL('mapbox://path.png/tile.png')).toEqual(`http://path.png/v4/tile.png`);
                expect(manager.normalizeTileURL('mapbox://path.png/tile.png32')).toEqual(`http://path.png/v4/tile.png32`);
                expect(manager.normalizeTileURL('mapbox://path.png/tile.jpg70')).toEqual(`http://path.png/v4/tile.jpg70`);
            });

            test('.normalizeTileURL inserts @2x if source requests it', () => {
                config.API_URL = 'http://path.png';
                config.REQUIRE_ACCESS_TOKEN = false;
                expect(manager.normalizeTileURL('mapbox://path.png/tile.png', true)).toEqual(`http://path.png/v4/tile@2x.png`);
                expect(manager.normalizeTileURL('mapbox://path.png/tile.png32', true)).toEqual(`http://path.png/v4/tile@2x.png32`);
                expect(manager.normalizeTileURL('mapbox://path.png/tile.jpg70', true)).toEqual(`http://path.png/v4/tile@2x.jpg70`);
                expect(
                    manager.normalizeTileURL('mapbox://path.png/tile.png?access_token=foo', true)
                ).toEqual(`http://path.png/v4/tile@2x.png?access_token=foo`);
            });

            test('.normalizeTileURL inserts @2x for 512 raster tiles on v4 of the api', () => {
                config.API_URL = 'http://path.png';
                config.REQUIRE_ACCESS_TOKEN = false;
                expect(manager.normalizeTileURL('mapbox://path.png/tile.png', false, 256)).toEqual(`http://path.png/v4/tile.png`);
                expect(manager.normalizeTileURL('mapbox://path.png/tile.png', false, 512)).toEqual(`http://path.png/v4/tile@2x.png`);
                expect(manager.normalizeTileURL("mapbox://raster/a.b/0/0/0.png", false, 256)).toEqual(`http://path.png/raster/v1/a.b/0/0/0.png`);
                expect(manager.normalizeTileURL("mapbox://raster/a.b/0/0/0.png", false, 512)).toEqual(`http://path.png/raster/v1/a.b/0/0/0.png`);
            });

            test('.normalizeTileURL replaces img extension with webp on supporting devices', () => {
                webpSupported.supported = true;
                config.API_URL = 'http://path.png';
                config.REQUIRE_ACCESS_TOKEN = false;
                expect(manager.normalizeTileURL('mapbox://path.png/tile.png')).toEqual(`http://path.png/v4/tile.webp`);
                expect(manager.normalizeTileURL('mapbox://path.png/tile.png32')).toEqual(`http://path.png/v4/tile.webp`);
                expect(manager.normalizeTileURL('mapbox://path.png/tile.jpg70')).toEqual(`http://path.png/v4/tile.webp`);
                expect(manager.normalizeTileURL('mapbox://path.png/tile.png?access_token=foo')).toEqual(`http://path.png/v4/tile.webp?access_token=foo`);
                webpSupported.supported = false;
            });

            test('.normalizeTileURL ignores non-mapbox:// sources', () => {
                expect(manager.normalizeTileURL('http://path.png')).toEqual('http://path.png');
            });

            test('.normalizeTileURL accounts for tileURLs w/ paths', () => {
                // Add a path to the config:
                config.API_URL = 'http://localhost:8080/mbx';
                const input    = `mapbox://tiles/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7/10/184/401.vector.pbf?access_token=${config.ACCESS_TOKEN}`;
                const expected = `http://localhost:8080/mbx/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v7/10/184/401.vector.pbf?sku=${manager._skuToken}&access_token=${config.ACCESS_TOKEN}`;
                expect(manager.normalizeTileURL(input)).toEqual(expected);
            });

            test('.normalizeTileURL ignores undefined sources', () => {
                expect(manager.normalizeTileURL('http://path.png')).toEqual('http://path.png');
            });

            test('.normalizeTileURL does not modify the access token for non-mapbox sources', () => {
                config.API_URL = 'http://example.com';
                expect(
                        manager.normalizeTileURL('http://example.com/tile.png?access_token=tk.abc.123')
                ).toEqual('http://example.com/tile.png?access_token=tk.abc.123');
            });

            test('.normalizeTileURL throw error on falsy url input', () => {
                expect(() => {
                    manager.normalizeTileURL('');
                }).toThrowError('Unable to parse URL object');
            });

            test('.normalizeTileURL matches gl-native normalization', () => {
                config.API_URL = 'https://api.mapbox.com/';
                // ensure the token exists
                expect(manager._skuToken).toBeTruthy();
                expect(manager.normalizeTileURL("mapbox://tiles/a.b/0/0/0.pbf")).toEqual(
                    `https://api.mapbox.com/v4/a.b/0/0/0.pbf?sku=${manager._skuToken}&access_token=key`
                );
                expect(
                    manager.normalizeTileURL("mapbox://tiles/a.b/0/0/0.pbf?style=mapbox://styles/mapbox/streets-v9@0")
                ).toEqual(
                    `https://api.mapbox.com/v4/a.b/0/0/0.pbf?style=mapbox://styles/mapbox/streets-v9@0&sku=${manager._skuToken}&access_token=key`
                );
                expect(manager.normalizeTileURL("mapbox://tiles/a.b/0/0/0.pbf?")).toEqual(
                    `https://api.mapbox.com/v4/a.b/0/0/0.pbf?sku=${manager._skuToken}&access_token=key`
                );
                expect(manager.normalizeTileURL("mapbox://tiles/a.b/0/0/0.png")).toEqual(
                    `https://api.mapbox.com/v4/a.b/0/0/0.png?sku=${manager._skuToken}&access_token=key`
                );
                expect(manager.normalizeTileURL("mapbox://tiles/a.b/0/0/0@2x.png")).toEqual(
                    `https://api.mapbox.com/v4/a.b/0/0/0@2x.png?sku=${manager._skuToken}&access_token=key`
                );
                expect(manager.normalizeTileURL("mapbox://tiles/a.b,c.d/0/0/0.pbf")).toEqual(
                    `https://api.mapbox.com/v4/a.b,c.d/0/0/0.pbf?sku=${manager._skuToken}&access_token=key`
                );
                expect(manager.normalizeTileURL("mapbox://raster/a.b/0/0/0.png")).toEqual(
                    `https://api.mapbox.com/raster/v1/a.b/0/0/0.png?sku=${manager._skuToken}&access_token=key`
                );
                expect(manager.normalizeTileURL("mapbox://rasterarrays/a.b/0/0/0.mrt")).toEqual(
                    `https://api.mapbox.com/rasterarrays/v1/a.b/0/0/0.mrt?sku=${manager._skuToken}&access_token=key`
                );

                config.API_URL = 'https://api.example.com/';
                expect(manager.normalizeTileURL("mapbox://tiles/a.b/0/0/0.png")).toEqual(
                    `https://api.example.com/v4/a.b/0/0/0.png?sku=${manager._skuToken}&access_token=key`
                );
                expect(manager.normalizeTileURL("http://path")).toEqual("http://path");
            });
        });

        webpSupported.supported = true;
    });

    describe('PerformanceEvent', () => {
        let event;

        beforeEach(() => {
            window.useFakeXMLHttpRequest();
            event = new mapbox.PerformanceEvent();
        });

        test('mapbox.postPerformanceEvent', () => {
            expect(mapbox.postPerformanceEvent).toBeTruthy();
        });

        test('does not contains sku, skuId and userId', async () => {
            event.postPerformanceEvent('token', {
                width: 100,
                height: 100,
                interactionRange: [0, 0],
                projection: 'mercator'
            });

            const reqBody = await window.server.requests[0].requestBody;
            const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));

            expect(performanceEvent.event).toEqual('gljs.performance');
            expect(performanceEvent.skuId).toBeFalsy();
            expect(performanceEvent.skuToken).toBeFalsy();
            expect(performanceEvent.userId).toBeFalsy();
        });

        test('contains default payload', async () => {
            event.postPerformanceEvent('token', {
                width: 100,
                height: 100,
                interactionRange: [0, 0],
                projection: 'mercator'
            });

            const reqBody = await window.server.requests[0].requestBody;
            const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));

            expect(performanceEvent.event).toEqual('gljs.performance');
            expect(!!performanceEvent.created).toBeTruthy();
        });

        test('metrics', async () => {
            event.postPerformanceEvent('token', {
                width: 100,
                height: 50,
                interactionRange: [0, 0],
                projection: 'mercator',
                vendor: 'webgl vendor',
                renderer: 'webgl renderer'
            });

            const reqBody = await window.server.requests[0].requestBody;
            const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));
            const checkMetric = (data, metricName, metricValue) => {
                for (const metric of data) {
                    if (metric.name === metricName) {
                        expect(metric.value).toEqual(metricValue);
                        return;
                    }
                }
                assert(false);
            };

            expect(performanceEvent.event).toEqual('gljs.performance');

            checkMetric(performanceEvent.metadata, 'sdkVersion', version);
            checkMetric(performanceEvent.metadata, 'sdkIdentifier', 'mapbox-gl-js');
            checkMetric(performanceEvent.metadata, 'devicePixelRatio', '1');
            checkMetric(performanceEvent.metadata, 'windowWidth', '300');
            checkMetric(performanceEvent.metadata, 'windowHeight', '150');
            checkMetric(performanceEvent.metadata, 'mapWidth', '100');
            checkMetric(performanceEvent.metadata, 'mapHeight', '50');
            checkMetric(performanceEvent.metadata, 'webglVendor', 'webgl vendor');
            checkMetric(performanceEvent.metadata, 'webglRenderer', 'webgl renderer');
            checkMetric(performanceEvent.attributes, 'terrainEnabled', 'false');
            checkMetric(performanceEvent.attributes, 'projection', 'mercator');
            checkMetric(performanceEvent.attributes, 'fogEnabled', 'false');
        });
    });

    describe('TurnstileEvent', () => {
        const ms25Hours = (25 * 60 * 60 * 1000);
        let event;
        beforeEach(() => {
            window.useFakeXMLHttpRequest();
            event = new mapbox.TurnstileEvent();
        });

        test('mapbox.postTurnstileEvent', () => {
            expect(mapbox.postTurnstileEvent).toBeTruthy();
        });

        test('contains all payload including skuId', async () => {
            event.postTurnstileEvent(mapboxTileURLs);
            const reqBody = await window.server.requests[0].requestBody;
            // reqBody is a string of an array containing the event object so pick out the stringified event object and convert to an object
            const mapLoadEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));
            expect(mapLoadEvent.event).toEqual('appUserTurnstile');
            expect(mapLoadEvent.skuId).toEqual(SKU_ID);
            expect(mapLoadEvent.sdkIdentifier).toEqual('mapbox-gl-js');
            expect(mapLoadEvent.sdkVersion).toEqual(version);
            expect(mapLoadEvent["enabled.telemetry"]).toEqual(false);
            expect(!!mapLoadEvent.userId).toBeTruthy();
            expect(!!mapLoadEvent.created).toBeTruthy();
        });

        test('does not POST when mapboxgl.ACCESS_TOKEN is not set', () => {
            config.ACCESS_TOKEN = null;

            event.postTurnstileEvent(mapboxTileURLs);

            expect(window.server.requests.length).toEqual(0);
        });

        test('does not POST when url does not point to mapbox.com', () => {
            event.postTurnstileEvent(nonMapboxTileURLs);

            expect(window.server.requests.length).toEqual(0);
        });

        test('POSTs cn event when API_URL change to cn endpoint', async () => {
            vi.stubGlobal('localStorage', undefined);
            vi.stubGlobal('caches', undefined);
            config.API_URL = 'https://api.mapbox.cn';

            event.postTurnstileEvent(mapboxTileURLs);

            await new Promise(resolve => {
                setTimeout(() => {
                    expect(window.server.requests[0].url.indexOf('https://events.mapbox.cn') > -1).toBeTruthy();
                    resolve();
                }, 0);
            });
        });

        test('POSTs no event when API_URL unavailable', () => {
            config.API_URL = null;
            event.postTurnstileEvent(mapboxTileURLs);
            expect(window.server.requests.length).toEqual(0);
        });

        test('POSTs no event when API_URL non-standard', () => {
            config.API_URL = 'https://api.example.com';
            event.postTurnstileEvent(mapboxTileURLs);
            expect(window.server.requests.length).toEqual(0);
        });

        describe('with LocalStorage available', () => {
            let prevLocalStorage;
            beforeEach(() => {
                prevLocalStorage = window.localStorage;
                vi.stubGlobal('localStorage', {
                    data: {},
                    setItem (id, val) {
                        this.data[id] = String(val);
                    },
                    getItem (id) {
                        return this.data.hasOwnProperty(id) ? this.data[id] : undefined;
                    },
                    removeItem (id) {
                        if (this.hasOwnProperty(id)) delete this[id];
                    }
                });
            });

            afterEach(() => {
                window.localStorage = prevLocalStorage;
            });

            test('does not POST event when previously stored data is on the same day', () => {
                const now = +Date.now();
                window.localStorage.setItem(`mapbox.eventData.uuid:${config.ACCESS_TOKEN}`, uuid());
                window.localStorage.setItem(`mapbox.eventData:${config.ACCESS_TOKEN}`, JSON.stringify({
                    lastSuccess: now,
                    tokenU: 'key'
                }));

                // Post 5 seconds later
                withFixedDate(now + 5, () => event.postTurnstileEvent(mapboxTileURLs));
                expect(window.server.requests.length).toBeFalsy();
            });

            test('POSTs event when previously stored anonId is not a valid uuid', async () => {
                const now = +Date.now();
                window.localStorage.setItem(`mapbox.eventData.uuid:${config.ACCESS_TOKEN}`, 'anonymous');
                window.localStorage.setItem(`mapbox.eventData:${config.ACCESS_TOKEN}`, JSON.stringify({
                    lastSuccess: now
                }));

                withFixedDate(now + ms25Hours, () => event.postTurnstileEvent(mapboxTileURLs));

                const req = window.server.requests[0];
                req.respond(200);

                const reqBody = JSON.parse(await req.requestBody)[0];
                expect(reqBody.userId).not.toEqual('anonymous');
                expect(reqBody.skuId).toEqual(SKU_ID);
            });

            test('POSTs event when previously stored timestamp is more than 24 hours in the future', async () => {
                const now = +Date.now();

                window.localStorage.setItem(`mapbox.eventData.uuid:${config.ACCESS_TOKEN}`, uuid());
                window.localStorage.setItem(`mapbox.eventData:${config.ACCESS_TOKEN}`, JSON.stringify({
                    lastSuccess: now + ms25Hours // 24-hours later
                }));

                withFixedDate(now, () => event.postTurnstileEvent(mapboxTileURLs));

                const req = window.server.requests[0];
                req.respond(200);
                const reqBody = JSON.parse(await req.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), now, 100);
                expect(reqBody.skuId).toEqual(SKU_ID);
            });

            test('does not POST appuserTurnstile event second time within same calendar day', async () => {
                let now = +Date.now();
                withFixedDate(now, () => event.postTurnstileEvent(mapboxTileURLs));

                //Post second event
                const firstEvent = now;
                now += (60 * 1000); // A bit later
                withFixedDate(now, () => event.postTurnstileEvent(mapboxTileURLs));

                const req = window.server.requests[0];
                req.respond(200);

                expect(window.server.requests.length).toEqual(1);

                const reqBody = JSON.parse(await req.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), firstEvent, 100);
            });

            test('does not POST appuserTurnstile event second time when clock goes backwards less than a day', async () => {
                let now = +Date.now();
                withFixedDate(now, () => event.postTurnstileEvent(mapboxTileURLs));

                //Post second event
                const firstEvent = now;
                now -= (60 * 1000); // A bit earlier
                withFixedDate(now, () => event.postTurnstileEvent(mapboxTileURLs));

                const req = window.server.requests[0];
                req.respond(200);

                expect(window.server.requests.length).toEqual(1);

                const reqBody = JSON.parse(await req.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), firstEvent, 100);
            });

            test('POSTs appuserTurnstile event when access token changes', () => {
                config.ACCESS_TOKEN = 'pk.new.*';

                event.postTurnstileEvent(mapboxTileURLs);

                const req = window.server.requests[0];
                req.respond(200);

                expect(req.url).toEqual(`${config.EVENTS_URL}?access_token=pk.new.*`);
            });
        });

        describe('when LocalStorage is not available', () => {
            beforeEach(() => {
                vi.stubGlobal('localStorage', undefined);
            });

            test('POSTs appuserTurnstile event', async () => {
                event.postTurnstileEvent(mapboxTileURLs);

                await new Promise((resolve) => {
                    setTimeout(async () => {
                        const req = window.server.requests[0];
                        const reqBody = JSON.parse(await req.requestBody)[0];
                        expect(req.url).toEqual(`${config.EVENTS_URL}?access_token=key`);
                        expect(req.method).toEqual('POST');
                        expect(reqBody.event).toEqual('appUserTurnstile');
                        expect(reqBody.sdkVersion).toEqual(version);
                        expect(reqBody.skuId).toEqual(SKU_ID);
                        expect(reqBody.userId).toBeTruthy();
                        resolve();
                    }, 0);
                });
            });

            test('does not POST appuserTurnstile event second time within same calendar day', async () => {
                let now = +Date.now();
                const firstEvent = now;
                withFixedDate(now, () => event.postTurnstileEvent(mapboxTileURLs));

                //Post second event
                now += (60 * 1000); // A bit later
                withFixedDate(now, () => event.postTurnstileEvent(mapboxTileURLs));

                const req = window.server.requests[0];
                req.respond(200);

                expect(window.server.requests.length).toEqual(1);

                const reqBody = JSON.parse(await req.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), firstEvent, 100);
            });

            test('does not POST appuserTurnstile event second time when clock goes backwards less than a day', async () => {
                let now = +Date.now();
                const firstEvent = now;
                event.postTurnstileEvent(mapboxTileURLs);

                //Post second event
                now -= (60 * 1000); // A bit earlier
                withFixedDate(now, () => event.postTurnstileEvent(mapboxTileURLs));

                const req = window.server.requests[0];
                expect(window.server.requests.length).toEqual(1);

                const reqBody = JSON.parse(await req.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), firstEvent, 100);
            });

            test('POSTs appuserTurnstile event when access token changes', async () => {
                config.ACCESS_TOKEN = 'pk.new.*';

                event.postTurnstileEvent(mapboxTileURLs);

                const req = window.server.requests[0];
                req.respond(200);

                const reqBody = JSON.parse(await req.requestBody)[0];
                expect(req.url).toEqual(`${config.EVENTS_URL}?access_token=pk.new.*`);
                expect(req.method).toEqual('POST');
                expect(reqBody.event).toEqual('appUserTurnstile');
                expect(reqBody.sdkVersion).toEqual(version);
                expect(reqBody.skuId).toEqual(SKU_ID);
                expect(reqBody.userId).toBeTruthy();
            });

            test('POSTs appUserTurnstile event on next calendar day', async () => {
                const now = +Date.now();
                event.postTurnstileEvent(mapboxTileURLs);
                // Add a day
                const tomorrow = now + ms25Hours;
                withFixedDate(tomorrow, () => event.postTurnstileEvent(mapboxTileURLs));

                let req = window.server.requests[0];
                req.respond(200);

                await new Promise(resolve => {
                    setTimeout(async () => {
                        req = window.server.requests[1];
                        const reqBody = JSON.parse(await req.requestBody)[0];
                        expect(req.url).toEqual(`${config.EVENTS_URL}?access_token=key`);
                        expect(req.method).toEqual('POST');
                        expect(reqBody.event).toEqual('appUserTurnstile');
                        expect(reqBody.sdkVersion).toEqual(version);
                        expect(reqBody.skuId).toEqual(SKU_ID);
                        expect(reqBody.userId).toBeTruthy();
                        equalWithPrecision(new Date(reqBody.created).valueOf(), tomorrow, 100);
                        resolve();
                    }, 0);
                });
            });

            test('Queues and POSTs appuserTurnstile events when triggered in quick succession', async () => {
                let now = Date.now();

                const today = now;
                event.postTurnstileEvent(mapboxTileURLs);

                const laterToday = now + 1;
                withFixedDate(laterToday, () => event.postTurnstileEvent(mapboxTileURLs));

                const tomorrow = laterToday + ms25Hours; // Add a day
                now = tomorrow;
                withFixedDate(tomorrow, () => event.postTurnstileEvent(mapboxTileURLs));

                const reqToday = window.server.requests[0];
                reqToday.respond(200);
                let reqBody = JSON.parse(await reqToday.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), today, 100);

                const reqTomorrow = window.server.requests[1];
                reqTomorrow.respond(200);
                reqBody = JSON.parse(await reqTomorrow.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), tomorrow, 100);
            });
        });
    });

    describe('MapLoadEvent', () => {
        let event;
        let turnstileEvent;
        const skuToken = '1234567890123';
        beforeEach(() => {
            window.useFakeXMLHttpRequest();
            event = new mapbox.MapLoadEvent();
            turnstileEvent = new mapbox.TurnstileEvent();
        });

        test('mapbox.postMapLoadEvent', () => {
            expect(mapbox.postMapLoadEvent).toBeTruthy();
        });

        test('contains all payload including skuId and skuToken', async () => {
            event.postMapLoadEvent(1, skuToken);
            const reqBody = await window.server.requests[0].requestBody;
            // reqBody is a string of an array containing the event object so pick out the stringified event object and convert to an object
            const mapLoadEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));
            expect(mapLoadEvent.event).toEqual('map.load');
            expect(mapLoadEvent.skuId).toEqual(SKU_ID);
            expect(mapLoadEvent.skuToken).toEqual(skuToken);
            expect(mapLoadEvent.sdkIdentifier).toEqual('mapbox-gl-js');
            expect(mapLoadEvent.sdkVersion).toEqual(version);
            expect(!!mapLoadEvent.userId).toBeTruthy();
            expect(!!mapLoadEvent.created).toBeTruthy();
        });

        test('does not POST when mapboxgl.ACCESS_TOKEN is not set', () => {
            config.ACCESS_TOKEN = null;

            event.postMapLoadEvent(1, skuToken, null, () => {});
            expect(window.server.requests.length).toEqual(0);
        });

        test('POSTs cn event when API_URL changes to cn endpoint', () => {
            config.API_URL = 'https://api.mapbox.cn';

            event.postMapLoadEvent(1, skuToken);

            const req = window.server.requests[0];
            req.respond(200);

            expect(req.url.indexOf('https://events.mapbox.cn') > -1).toBeTruthy();
        });

        test('POSTs no event when API_URL unavailable', () => {
            config.API_URL = null;
            event.postMapLoadEvent(1, skuToken);
            expect(window.server.requests.length).toEqual(0);
        });

        test('POSTs no event when API_URL is non-standard', () => {
            config.API_URL = "https://api.example.com";
            event.postMapLoadEvent(1, skuToken);
            expect(window.server.requests.length).toEqual(0);
        });

        describe('with LocalStorage available', () => {
            beforeEach(() => {
                vi.stubGlobal('localStorage', {
                    data: {},
                    setItem (id, val) {
                        this.data[id] = String(val);
                    },
                    getItem (id) {
                        return this.data.hasOwnProperty(id) ? this.data[id] : undefined;
                    },
                    removeItem (id) {
                        if (this.hasOwnProperty(id)) delete this[id];
                    }
                });
            });

            test('generates new uuid when previously stored anonId is not a valid uuid', async () => {
                window.localStorage.setItem(`mapbox.eventData.uuid:${config.ACCESS_TOKEN}`, JSON.stringify({
                    anonId: 'anonymous'
                }));

                event.postMapLoadEvent(1, skuToken);
                const req = window.server.requests[0];
                req.respond(200);

                const reqBody = JSON.parse(await req.requestBody)[0];
                expect(reqBody.userId).not.toEqual('anonymous');
            });

            test('does not POST map.load event second time within same calendar day', async () => {
                let now = +Date.now();
                withFixedDate(now, () => event.postMapLoadEvent(1, skuToken));

                //Post second event
                const firstEvent = now;
                now += (60 * 1000); // A bit later
                withFixedDate(now, () => event.postMapLoadEvent(1, skuToken));

                const req = window.server.requests[0];
                req.respond(200);

                expect(window.server.requests.length).toEqual(1);

                const reqBody = JSON.parse(await req.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), firstEvent, 100);
            }
            );

            test('does not POST map.load event second time when clock goes backwards less than a day', async () => {
                let now = +Date.now();
                withFixedDate(now, () => event.postMapLoadEvent(1, skuToken));

                //Post second event
                const firstEvent = now;
                now -= (60 * 1000); // A bit earlier
                withFixedDate(now, () => event.postMapLoadEvent(1, skuToken));

                const req = window.server.requests[0];
                req.respond(200);

                expect(window.server.requests.length).toEqual(1);

                const reqBody = JSON.parse(await req.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), firstEvent, 100);
            }
            );

            test('POSTs map.load event when access token changes', () => {
                config.ACCESS_TOKEN = 'pk.new.*';

                event.postMapLoadEvent(1, skuToken);

                const req = window.server.requests[0];
                req.respond(200);

                expect(req.url).toEqual(`${config.EVENTS_URL}?access_token=pk.new.*`);
            });

            test('uses the same uuid as TurnstileEvent', async () => {
                const anonId = uuid();
                window.localStorage.setItem(`mapbox.eventData.uuid:${config.ACCESS_TOKEN}`, anonId);
                turnstileEvent.postTurnstileEvent(mapboxTileURLs);
                event.postMapLoadEvent(1, skuToken);

                const turnstileReq = window.server.requests[0];
                turnstileReq.respond(200);
                const mapLoadReq = window.server.requests[1];
                mapLoadReq.respond(200);
                const turnstileBody = JSON.parse(await turnstileReq.requestBody)[0];
                const loadBody = JSON.parse(await mapLoadReq.requestBody)[0];

                expect(turnstileBody.userId).toEqual(loadBody.userId);
                expect(turnstileBody.userId).toEqual(anonId);
                const turnstileEventData = JSON.parse(window.localStorage.getItem(`mapbox.eventData:${config.ACCESS_TOKEN}`));
                expect(turnstileEventData.lastSuccess).toBeTruthy();
            });
        });

        describe('when LocalStorage is not available', () => {
            test('POSTs map.load event', async () => {
                event.postMapLoadEvent(1, skuToken);

                const req = window.server.requests[0];
                req.respond(200);

                const reqBody = JSON.parse(await req.requestBody)[0];
                expect(req.url).toEqual(`${config.EVENTS_URL}?access_token=key`);
                expect(req.method).toEqual('POST');
                expect(reqBody.event).toEqual('map.load');
                expect(reqBody.sdkVersion).toEqual(version);
                expect(reqBody.userId).toBeTruthy();
            });

            test('does not POST map.load multiple times for the same map instance', async () => {
                const now = Date.now();
                withFixedDate(now, () => event.postMapLoadEvent(1, skuToken));
                withFixedDate(now + 5, () => event.postMapLoadEvent(1, skuToken));

                const req = window.server.requests[0];
                req.respond(200);

                expect(window.server.requests.length).toEqual(1);

                const reqBody = JSON.parse(await req.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), now, 100);
            });

            test('POSTs map.load event when access token changes', async () => {
                config.ACCESS_TOKEN = 'pk.new.*';

                event.postMapLoadEvent(1, skuToken);

                const req = window.server.requests[0];
                req.respond(200);

                const reqBody = JSON.parse(await req.requestBody)[0];
                expect(req.url).toEqual(`${config.EVENTS_URL}?access_token=pk.new.*`);
                expect(req.method).toEqual('POST');
                expect(reqBody.event).toEqual('map.load');
                expect(reqBody.sdkVersion).toEqual(version);
                expect(reqBody.userId).toBeTruthy();
            });

            test('POSTs distinct map.load for multiple maps', async () => {
                event.postMapLoadEvent(1, skuToken);
                const now = +Date.now();
                withFixedDate(now, () => event.postMapLoadEvent(2, skuToken));

                let req = window.server.requests[0];

                await new Promise((resolve) => {
                    setTimeout(async () => {
                        req = window.server.requests[1];

                        const reqBody = JSON.parse(await req.requestBody)[0];
                        expect(req.url).toEqual(`${config.EVENTS_URL}?access_token=key`);
                        expect(req.method).toEqual('POST');
                        expect(reqBody.event).toEqual('map.load');
                        expect(reqBody.sdkVersion).toEqual(version);
                        expect(reqBody.userId).toBeTruthy();
                        equalWithPrecision(new Date(reqBody.created).valueOf(), now, 100);
                        resolve();
                    }, 0);
                });
            });

            test('Queues and POSTs map.load events when triggerred in quick succession by different maps', async () => {
                const now = Date.now();
                withFixedDate(now, () => event.postMapLoadEvent(1, skuToken));
                withFixedDate(now, () => event.postMapLoadEvent(2, skuToken));
                withFixedDate(now, () => event.postMapLoadEvent(3, skuToken));

                const reqOne = window.server.requests[0];
                reqOne.respond(200);
                let reqBody = JSON.parse(await reqOne.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), now, 100);

                const reqTwo = window.server.requests[1];
                reqTwo.respond(200);
                reqBody = JSON.parse(await reqTwo.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), now, 100);

                const reqThree = window.server.requests[2];
                reqThree.respond(200);
                reqBody = JSON.parse(await reqThree.requestBody)[0];
                equalWithPrecision(new Date(reqBody.created).valueOf(), now, 100);
            });
        });
    });

    describe('MapSessionAPI', () => {
        let sessionAPI;
        const skuToken = '1234567890123';
        beforeEach(() => {
            window.useFakeXMLHttpRequest();
            vi.stubGlobal('caches', undefined);
            sessionAPI = new mapbox.MapSessionAPI();
        });

        test('mapbox.getMapSessionAPI', () => {
            expect(mapbox.getMapSessionAPI).toBeTruthy();
        });

        test('contains access token and skuToken', async () => {
            sessionAPI.getSession(1, skuToken, () => {});

            await new Promise((resolve) => {
                setTimeout(() => {
                    const requestURL = new URL(window.server.requests[0].url);
                    const urlParam = new URLSearchParams(requestURL.search);
                    expect(urlParam.get('sku')).toEqual(skuToken);
                    expect(urlParam.get('access_token')).toEqual(config.ACCESS_TOKEN);
                    resolve();
                }, 0);
            });
        });

        test('no API is sent when API_URL unavailable', async () => {
            config.API_URL = null;
            sessionAPI.getSession(1, skuToken, () => {});

            await new Promise((resolve) => {
                setTimeout(() => {
                    expect(window.server.requests.length).toEqual(0);
                    resolve();
                }, 0);
            });
        });

        test('send a new request when access token changes', async () => {
            config.ACCESS_TOKEN = 'pk.new.*';
            sessionAPI.getSession(1, skuToken, () => {});

            await new Promise(resolve => {
                const req = window.server.requests[0];
                expect(req.url).toEqual(
                    `${config.API_URL + config.SESSION_PATH}?sku=${skuToken}&access_token=pk.new.*`
                );
                expect(req.method).toEqual('GET');
                resolve();
            });
        });
    });
});
