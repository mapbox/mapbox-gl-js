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
    // console.log('------------')
    // console.log(inputUrl);
    // console.log('------------')
    var httpsUrl = inputUrl.replace(/^mapbox:\/\//, config.API_URL + pathPrefix);
    httpsUrl += httpsUrl.indexOf('?') !== -1 ? '&access_token=' : '?access_token=';
    // console.log('========')
    // console.log(httpsUrl);
    // console.log('========')
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

    // var formattedQuery = '?' + querystring.stringify(urlObject.query);
    var parsedUrl = urlObject.protocol + '/' + urlObject.pathname + formattedQuery;
    // https://api.mapbox.com/styles/v1/user/style
    // mapbox://user/style/draft?fresh=true
    // console.log(urlObject)
    // console.log('^^^^^^^^^^^')
    // console.log(parsedUrl)
    // console.log('^^^^^^^^^^^')
    // THE OLD return normalizeURL('mapbox://' + user + '/' + style + draft, '/styles/v1/', accessToken);
    return normalizeURL(parsedUrl, '/styles/v1/', accessToken);
};

module.exports.normalizeSourceURL = function(inputUrl, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\//))
        return inputUrl;

    var inputUrlJson = inputUrl + '.json';
    var urlObject = url.parse(inputUrlJson);

    urlObject.pathname = urlObject.hostname;
    // THE OLD return normalizeURL(url + '.json', '/v4/', accessToken) + '&secure';
    // console.log(urlObject)
    // console.log('^^^^^^^^^^^')
    var parsedUrl = urlObject.protocol + '//' + urlObject.pathname;
    // TileJSON requests need a secure flag appended to their URLs so
    // that the server knows to send SSL-ified resource references.
    return normalizeURL(parsedUrl, '/v4/', accessToken) + '&secure';
};

module.exports.normalizeGlyphsURL = function(inputUrl, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\//))
        return inputUrl;

    var parsedUrl = url.parse(inputUrl, true);
    // THE OLD return normalizeURL('mapbox://' + user + '/{fontstack}/{range}.pbf', '/fonts/v1/', accessToken);
    return normalizeURL(parsedUrl, '/fonts/v1', accessToken);
};

module.exports.normalizeSpriteURL = function(inputUrl, format, ext, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\/sprites\//))
        return inputUrl + format + ext;

    var parsedUrl = url.parse(inputUrl, true);

    parsedUrl.pathname = parsedUrl.pathname + '/sprite' + format + ext;
    //THE OLD return normalizeURL('mapbox://' + user + '/' + style + draft + '/sprite' + format + ext, '/styles/v1/', accessToken);

    return normalizeURL(parsedUrl, '/styles/v1', accessToken);
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
