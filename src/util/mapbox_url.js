// @flow
import config from './config.js';

export function isMapboxHTTPURL(url: string): boolean {
    return config.API_URL_REGEX.test(url);
}

export function isMapboxURL(url: string): boolean {
    return url.indexOf('mapbox:') === 0;
}

export function isMapboxHTTPCDNURL(url: string): boolean {
    return config.API_CDN_URL_REGEX.test(url);
}

export function isMapboxHTTPSpriteURL(url: string): boolean {
    return config.API_SPRITE_REGEX.test(url);
}

export function isMapboxHTTPStyleURL(url: string): boolean {
    return config.API_STYLE_REGEX.test(url) && !isMapboxHTTPSpriteURL(url);
}

export function isMapboxHTTPTileJSONURL(url: string): boolean {
    return config.API_TILEJSON_REGEX.test(url);
}

export function isMapboxHTTPFontsURL(url: string): boolean {
    return config.API_FONTS_REGEX.test(url);
}

export function hasCacheDefeatingSku(url: string): boolean {
    return url.indexOf('sku=') > 0 && isMapboxHTTPURL(url);
}
