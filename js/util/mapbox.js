'use strict';

var config = require('./config');
var browser = require('./browser');
var url = require('url');
var querystring = require('querystring');

function normalizeURL(inputUrl, pathPrefix, accessToken) {
    accessToken = accessToken || config.ACCESS_TOKEN;

    if (!accessToken && config.REQUIRE_ACCESS_TOKEN) {
        throw new Error('An API access token is required to use Mapbox GL. ' +
            'See https://www.mapbox.com/developers/api/#access-tokens');
    }

    var httpsUrl = inputUrl.replace(/^mapbox:\/\//, config.API_URL + pathPrefix);
    httpsUrl += httpsUrl.indexOf('?') !== -1 ? '&access_token=' : '?access_token=';

    if (config.REQUIRE_ACCESS_TOKEN) {
        if (accessToken[0] === 's') {
            throw new Error('Use a public access token (pk.*) with Mapbox GL JS, not a secret access token (sk.*). ' +
                'See https://www.mapbox.com/developers/api/#access-tokens');
        }

        httpsUrl += accessToken;
    }

    return httpsUrl;
}

module.exports.normalizeStyleURL = function(inputUrl, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\/styles\//))
        return inputUrl;

    var urlObject = url.parse(inputUrl, true);
    var formattedQuery = '';

    if (Object.getOwnPropertyNames(urlObject.query).length !== 0) {
        formattedQuery = '?' + querystring.stringify(urlObject.query);
    }

    var parsedUrl = url.format(urlObject.protocol + '/' + urlObject.pathname + formattedQuery);

    return normalizeURL(parsedUrl, '/styles/v1/', accessToken);
};

module.exports.normalizeSourceURL = function(inputUrl, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\//))
        return inputUrl;

    var inputUrlJson = inputUrl + '.json';
    var urlObject = url.parse(inputUrlJson);

    urlObject.pathname = urlObject.hostname;

    var parsedUrl = url.format(urlObject.protocol + '//' + urlObject.pathname);
    // TileJSON requests need a secure flag appended to their URLs so
    // that the server knows to send SSL-ified resource references.
    return normalizeURL(parsedUrl, '/v4/', accessToken) + '&secure';
};

module.exports.normalizeGlyphsURL = function(inputUrl, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\//))
        return inputUrl;

    var urlObject = url.parse(inputUrl, true);

    var formattedQuery = '';

    if (Object.getOwnPropertyNames(urlObject.query).length !== 0) {
        formattedQuery = '?' + querystring.stringify(urlObject.query);
    }

    var parsedUrl = decodeURI(urlObject.protocol + '/' + urlObject.pathname + formattedQuery);

    return normalizeURL(parsedUrl, '/fonts/v1/', accessToken);
};

module.exports.normalizeSpriteURL = function(inputUrl, format, ext, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\/sprites\//))
        return inputUrl + format + ext;

    var urlObject = url.parse(inputUrl, true);

    var formattedQuery = '';

    urlObject.pathname = urlObject.pathname + '/sprite' + format + ext;

    if (Object.getOwnPropertyNames(urlObject.query).length !== 0) {
        formattedQuery = '?' + querystring.stringify(urlObject.query);
    }

    var parsedUrl = decodeURI(urlObject.protocol + '/' + urlObject.pathname + formattedQuery);

    return normalizeURL(parsedUrl, '/styles/v1/', accessToken);
};

module.exports.normalizeTileURL = function(inputUrl, sourceUrl, tileSize) {
    if (!sourceUrl || !sourceUrl.match(/^mapbox:\/\//))
        return inputUrl;

    // The v4 mapbox tile API supports 512x512 image tiles only when @2x
    // is appended to the tile URL. If `tileSize: 512` is specified for
    // a Mapbox raster source force the @2x suffix even if a non hidpi
    // device.
    var httpsUrl = inputUrl.replace(/([?&]access_token=)tk\.[^&]+/, '$1' + config.ACCESS_TOKEN);
    var extension = browser.supportsWebp ? 'webp' : '$1';
    return httpsUrl.replace(/\.((?:png|jpg)\d*)(?=$|\?)/, browser.devicePixelRatio >= 2 || tileSize === 512 ? '@2x.' + extension : '.' + extension);
};
