'use strict';

var config = require('./config');
var browser = require('./browser');
var url = require('url');
var querystring = require('querystring');

function normalizeURL(mapboxURL, pathPrefix, accessToken) {
    accessToken = accessToken || config.ACCESS_TOKEN;

    if (!accessToken && config.REQUIRE_ACCESS_TOKEN) {
        throw new Error('An API access token is required to use Mapbox GL. ' +
            'See https://www.mapbox.com/developers/api/#access-tokens');
    }

    var httpsURL = mapboxURL.replace(/^mapbox:\/\//, config.API_URL + pathPrefix);
    httpsURL += httpsURL.indexOf('?') !== -1 ? '&access_token=' : '?access_token=';

    if (config.REQUIRE_ACCESS_TOKEN) {
        if (accessToken[0] === 's') {
            throw new Error('Use a public access token (pk.*) with Mapbox GL JS, not a secret access token (sk.*). ' +
                'See https://www.mapbox.com/developers/api/#access-tokens');
        }

        httpsURL += accessToken;
    }

    return httpsURL;
}

module.exports.normalizeStyleURL = function(styleURL, accessToken) {
    var urlObject = url.parse(styleURL, true);

    if (urlObject.protocol !== 'mapbox:')
        return styleURL;

    var urlObject = url.parse(styleURL, true);
    var formattedQuery = '';

    if (Object.keys(urlObject.query).length !== 0) {
        formattedQuery = '?' + querystring.stringify(urlObject.query);
    }

    var parsedURL = urlObject.protocol + '/' + urlObject.pathname + formattedQuery;

    return normalizeURL(parsedURL, '/styles/v1/', accessToken);
};

module.exports.normalizeSourceURL = function(sourceURL, accessToken) {
    var sourceURLJson = sourceURL + '.json';

    var urlObject = url.parse(sourceURLJson);

    if (urlObject.protocol !== 'mapbox:')
        return sourceURL;

    urlObject.pathname = urlObject.hostname;

    var parsedURL = url.format(urlObject.protocol + '//' + urlObject.pathname);
    // TileJSON requests need a secure flag appended to their URLs so
    // that the server knows to send SSL-ified resource references.
    return normalizeURL(parsedURL, '/v4/', accessToken) + '&secure';
};

module.exports.normalizeGlyphsURL = function(glyphsURL, accessToken) {
    if (!glyphsURL.match(/^mapbox:\/\//))
        return glyphsURL;

    var splitAlongQueryURL = glyphsURL.split('?');
    var user = splitAlongQueryURL[0].split('/')[3];
    var queryString = splitAlongQueryURL[1] ? '?' + splitAlongQueryURL[1] : '';

    return normalizeURL('mapbox://' + user + '/{fontstack}/{range}.pbf' + queryString, '/fonts/v1/', accessToken);
};

module.exports.normalizeSpriteURL = function(spriteURL, format, ext, accessToken) {
    var urlObject = url.parse(spriteURL, true);

    if (urlObject.protocol !== 'mapbox:')
        return spriteURL + format + ext;

    var formattedQuery = '';

    urlObject.pathname = urlObject.pathname + '/sprite' + format + ext;

    if (Object.keys(urlObject.query).length !== 0) {
        formattedQuery = '?' + querystring.stringify(urlObject.query);
    }

    var parsedURL = urlObject.protocol + '/' + urlObject.pathname + formattedQuery;

    return normalizeURL(parsedURL, '/styles/v1/', accessToken);
};

module.exports.normalizeTileURL = function(tileURL, sourceURL, tileSize) {
    if (!sourceURL || !sourceURL.match(/^mapbox:\/\//))
        return tileURL;

    // The v4 mapbox tile API supports 512x512 image tiles only when @2x
    // is appended to the tile URL. If `tileSize: 512` is specified for
    // a Mapbox raster source force the @2x suffix even if a non hidpi
    // device.
    var httpsURL = tileURL.replace(/([?&]access_token=)tk\.[^&]+/, '$1' + config.ACCESS_TOKEN);
    var extension = browser.supportsWebp ? 'webp' : '$1';
    return httpsURL.replace(/\.((?:png|jpg)\d*)(?=$|\?)/, browser.devicePixelRatio >= 2 || tileSize === 512 ? '@2x.' + extension : '.' + extension);
};
