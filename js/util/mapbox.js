'use strict';

const config = require('./config');
const browser = require('./browser');

const help = 'See https://www.mapbox.com/developers/api/#access-tokens';

function makeAPIURL(path, accessToken) {
    const url = config.API_URL + path;
    if (!config.REQUIRE_ACCESS_TOKEN) return url;

    accessToken = accessToken || config.ACCESS_TOKEN;
    if (!accessToken)
        throw new Error(`An API access token is required to use Mapbox GL. ${help}`);
    if (accessToken[0] === 's')
        throw new Error(`Use a public access token (pk.*) with Mapbox GL, not a secret access token (sk.*). ${help}`);

    return addParam(url, `access_token=${accessToken}`);
}

function addParam(url, param) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + param;
}

function isMapboxURL(url) {
    return url.indexOf('mapbox:') === 0;
}

exports.isMapboxURL = isMapboxURL;

exports.normalizeStyleURL = function(url, accessToken) {
    if (!isMapboxURL(url)) return url;
    return makeAPIURL(url.replace('mapbox://styles', '/styles/v1'), accessToken);
};

exports.normalizeGlyphsURL = function(url, accessToken) {
    if (!isMapboxURL(url)) return url;
    return makeAPIURL(url.replace('mapbox://fonts', '/fonts/v1'), accessToken);
};

const mapboxSourceRe = /mapbox:\/\/([^?]+)/;

exports.normalizeSourceURL = function(url, accessToken) {
    if (!isMapboxURL(url)) return url;

    url = makeAPIURL(url.replace(mapboxSourceRe, '/v4/$1.json'), accessToken);
    // TileJSON requests need a secure flag appended to their URLs so
    // that the server knows to send SSL-ified resource references.
    return addParam(url, 'secure');
};

const beforeParamsRe = /([^?]+)/;
const mapboxSpritesRe = /mapbox:\/\/sprites\/([^?]+)/;

exports.normalizeSpriteURL = function(url, format, extension, accessToken) {
    if (!isMapboxURL(url))
        return url.replace(beforeParamsRe, `$1${format}${extension}`);

    const path = url.replace(mapboxSpritesRe, `/styles/v1/$1/sprite${format}${extension}`);
    return makeAPIURL(path, accessToken);
};

const imageExtensionRe = /(\.(png|jpg)\d*)(?=$|\?)/;
const tempAccessTokenRe = /([?&]access_token=)tk\.[^&]+/;

exports.normalizeTileURL = function(tileURL, sourceURL, tileSize) {
    if (!sourceURL || !isMapboxURL(sourceURL)) return tileURL;

    // The v4 mapbox tile API supports 512x512 image tiles only when @2x
    // is appended to the tile URL. If `tileSize: 512` is specified for
    // a Mapbox raster source force the @2x suffix even if a non hidpi device.
    const suffix = browser.devicePixelRatio >= 2 || tileSize === 512 ? '@2x' : '';
    const extension = browser.supportsWebp ? '.webp' : '$1';
    return tileURL
        .replace(imageExtensionRe, `${suffix}${extension}`)
        .replace(tempAccessTokenRe, `$1${config.ACCESS_TOKEN}`);
};
