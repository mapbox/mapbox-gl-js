import {describe, test, beforeEach, expect} from "../../util/vitest.js";
import {
    isMapboxHTTPURL,
    isMapboxHTTPCDNURL,
    isMapboxHTTPStyleURL,
    isMapboxHTTPTileJSONURL,
    isMapboxHTTPSpriteURL,
    isMapboxHTTPFontsURL
} from '../../../src/util/mapbox_url.js';
import config from '../../../src/util/config.js';

describe("mapbox", () => {
    beforeEach(() => {
        config.ACCESS_TOKEN = 'key';
        config.REQUIRE_ACCESS_TOKEN = true;
        config.API_URL = 'https://api.mapbox.com';
    });

    test('.isMapboxHTTPURL', () => {
        expect(isMapboxHTTPURL('http://mapbox.com')).toBeTruthy();
        expect(isMapboxHTTPURL('https://mapbox.com')).toBeTruthy();
        expect(isMapboxHTTPURL('https://mapbox.com/')).toBeTruthy();
        expect(isMapboxHTTPURL('https://mapbox.com?')).toBeTruthy();
        expect(isMapboxHTTPURL('https://api.mapbox.com/tiles')).toBeTruthy();
        expect(isMapboxHTTPURL('https://api.mapbox.cn/tiles')).toBeTruthy();
        expect(isMapboxHTTPURL('http://a.tiles.mapbox.cn/tiles')).toBeTruthy();
        expect(isMapboxHTTPURL('http://example.com/mapbox.com')).toBeFalsy();
    });

    test('.isMapboxHTTPStyleURL', () => {
        expect(
            isMapboxHTTPStyleURL('https://api.mapbox.com/styles/v1/mapbox/streets-v11')
        ).toBeTruthy();
        expect(
            isMapboxHTTPStyleURL('https://api.mapbox.com/styles/v52/mapbox/streets-v11')
        ).toBeTruthy();
        expect(
            isMapboxHTTPStyleURL('https://api.mapbox.com/styles/v1/mapbox/streets-v11?')
        ).toBeTruthy();
        expect(
            isMapboxHTTPStyleURL('https://api.mapbox.cn/styles/v1/mapbox/streets-v11')
        ).toBeTruthy();
        expect(
            isMapboxHTTPStyleURL('https://api.mapbox.com/styles/v1/mapbox/streets-v11/sprite@2x.json')
        ).toBeFalsy();
        expect(isMapboxHTTPStyleURL('http://example.com/mapbox.com')).toBeFalsy();
    });

    test('.isMapboxHTTPTileJSONURL', () => {
        expect(
            isMapboxHTTPTileJSONURL('https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPTileJSONURL('https://api.mapbox.com/v52/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPTileJSONURL('https://api.mapbox.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json?access_token=pk.eyJ1Ijoi')
        ).toBeTruthy();
        expect(
            isMapboxHTTPTileJSONURL('https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPTileJSONURL('https://api.mapbox.cn/v4/mapbox.mapbox-streets-v8.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPTileJSONURL('http://a.tiles.mapbox.cn/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPTileJSONURL('http://example.com/v4/mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2.json')
        ).toBeFalsy();
    });

    test('.isMapboxHTTPCDNURL', () => {
        expect(
            isMapboxHTTPCDNURL('https://api.mapbox.com/mapbox-gl-js/v2.11.0/mapbox-gl.js')
        ).toBeTruthy();
        expect(
            isMapboxHTTPCDNURL('https://api.mapbox.com/mapbox-gl-js/v2.11.0/mapbox-gl.css')
        ).toBeTruthy();
        expect(
            isMapboxHTTPCDNURL('https://api.mapbox.com/mapbox-gl-js/v2.11.0-beta.1/mapbox-gl.js')
        ).toBeTruthy();
        expect(
            isMapboxHTTPCDNURL('https://api.mapbox.cn/mapbox-gl-js/v2.11.0/mapbox-gl.js')
        ).toBeTruthy();
        expect(
            isMapboxHTTPCDNURL('https://api.mapbox.com/other-project/v2.11.0/mapbox-gl.js')
        ).toBeFalsy();
        expect(
            isMapboxHTTPCDNURL('https://api.mapbox.cn/v4/mapbox.mapbox-streets-v8.json')
        ).toBeFalsy();
        expect(
            isMapboxHTTPCDNURL('http://example.com/mapbox-gl-js/v2.11.0/mapbox-gl.js')
        ).toBeFalsy();
    });

    test('.isMapboxHTTPSpriteURL', () => {
        expect(
            isMapboxHTTPSpriteURL('https://api.mapbox.com/styles/v1/mapbox/streets-v11/sprite@2x.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPSpriteURL('https://api.mapbox.com/styles/v52/mapbox/streets-v11/sprite@2x.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPSpriteURL('https://api.mapbox.com/styles/v1/mapbox/streets-v11/sprite@2.5x.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPSpriteURL('https://api.mapbox.com/styles/v1/mapbox/streets-v11/sprite@2x.json?access_token=pk.eyJ1Ijoi')
        ).toBeTruthy();
        expect(
            isMapboxHTTPSpriteURL('https://api.mapbox.com/styles/v1/user/style/sprite.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPSpriteURL('https://api.mapbox.com/styles/v1/user/style/sprite@2x.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPSpriteURL('https://api.mapbox.cn/styles/v1/mapbox/streets-v11/sprite@2x.json')
        ).toBeTruthy();
        expect(
            isMapboxHTTPSpriteURL('http://example.com/mapbox.com/styles/v1/user/style/sprite@2x.json')
        ).toBeFalsy();
        expect(
            isMapboxHTTPSpriteURL('http://example.com/mapbox.com/sprite@2x.json')
        ).toBeFalsy();
        expect(
            isMapboxHTTPSpriteURL('http://example.com/mapbox.com/images@2x.json')
        ).toBeFalsy();
        expect(
            isMapboxHTTPSpriteURL('https://api.mapbox.com/styles/v1/mapbox/streets-v11')
        ).toBeFalsy();
    });

    test('.isMapboxHTTPFontsURL', () => {
        expect(
            isMapboxHTTPFontsURL('https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/8192-8447.pbf')
        ).toBeTruthy();
        expect(
            isMapboxHTTPFontsURL('https://api.mapbox.com/fonts/v52/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/8192-8447.pbf')
        ).toBeTruthy();
        expect(
            isMapboxHTTPFontsURL('https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/0-255.pbf')
        ).toBeTruthy();
        expect(
            isMapboxHTTPFontsURL('https://api.mapbox.com/fonts/v1/mapbox/DIN%20Offc%20Pro%20Medium,Arial%20Unicode%20MS%20Regular/0-255.pbf?access_token=pk.eyJ1Ijoi')
        ).toBeTruthy();
        expect(
            isMapboxHTTPFontsURL('https://api.mapbox.com/fonts/v1/mapbox/font1,font2/0-255.pbf')
        ).toBeTruthy();
        expect(
            isMapboxHTTPFontsURL('https://api.mapbox.cn/fonts/v1/mapbox/font1,font2/0-255.pbf')
        ).toBeTruthy();
        expect(isMapboxHTTPFontsURL('https://example.com/file.pbf')).toBeFalsy();
        expect(
            isMapboxHTTPFontsURL('https://api.mapbox.com/styles/v1/mapbox/streets-v11')
        ).toBeFalsy();
    });
});
