'use strict';

var config = require('./config');
var browser = require('./browser');
var url = require('url');
var querystring = require('querystring');

function normalizeURL(parsedUrl, pathPrefix, accessToken) {
    accessToken = accessToken || config.ACCESS_TOKEN;

    if (!accessToken && config.REQUIRE_ACCESS_TOKEN) {
        throw new Error('An API access token is required to use Mapbox GL. ' +
            'See https://www.mapbox.com/developers/api/#access-tokens');
    }
    // parsedURL is one big object.
    if (parsedUrl.query == null) {
        parsedUrl.query = {};
    }

    parsedUrl.query.access_token = accessToken;
    // then you have one big url object.
    //reconstitute it
    //parsedUrl is: Url {
    // protocol: 'mapbox:',
    // slashes: true,
    // auth: null,
    // host: 'styles',
    // port: null,
    // hostname: 'styles',
    // hash: null,
    // search: '?fresh=true',
    // query: { fresh: 'true', access_token: 'key' },
    // pathname: '/user/style',
    // path: '/user/style?fresh=true',
    // href: 'mapbox://styles/user/style?fresh=true' }
    // console.dir(parsedUrl)
    // console.log('$$$$$$$$$$')
    // console.dir(parsedUrl.query)
    // { fresh: 'true', access_token: 'key' }
    // ?fresh=true&access_token=key
    var formattedQuery= querystring.stringify(parsedUrl.query)
    var httpsUrl = config.API_URL + pathPrefix + parsedUrl.pathname + '?' + formattedQuery
    // url = url.replace(/^mapbox:\/\//, config.API_URL + pathPrefix);
    // console.log('this is the url inside normalizeURL right after the replacing happens')
    // console.log(url)
    // console.log("^^^")
    // url += url.indexOf('?') !== -1 ? '&access_token=' : '?access_token=';
    //https://api.mapbox.com/styles/v1/user/style?fresh=true&access_token=key'
    if (config.REQUIRE_ACCESS_TOKEN) {
        if (accessToken[0] === 's') {
            throw new Error('Use a public access token (pk.*) with Mapbox GL JS, not a secret access token (sk.*). ' +
                'See https://www.mapbox.com/developers/api/#access-tokens');
        }
    }

    return httpsUrl;
}

module.exports.normalizeStyleURL = function(inputUrl, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\/styles\//))
        return inputUrl;

    var parsedUrl = url.parse(inputUrl, true);

    return normalizeURL(parsedUrl, '/styles/v1', accessToken);
};

module.exports.normalizeSourceURL = function(inputUrl, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\//))
        return inputUrl;
    console.log("***********");
    var inputUrlJson = inputUrl + '.json';
    var parsedUrl= url.parse(inputUrlJson)
    // TileJSON requests need a secure flag appended to their URLs so
    // that the server knows to send SSL-ified resource references.
    return normalizeURL(parsedUrl, '/v4/', accessToken) + '&secure';
};

module.exports.normalizeGlyphsURL = function(inputUrl, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\//))
        return inputUrl;

    var parsedUrl = url.parse(inputUrl, true);
    // console.log(parsedUrl);

    return normalizeURL(parsedUrl, '/fonts/v1', accessToken);
};

module.exports.normalizeSpriteURL = function(inputUrl, format, ext, accessToken) {
    if (!inputUrl.match(/^mapbox:\/\/sprites\//))
        return inputUrl + format + ext;

    var parsedUrl = url.parse(inputUrl, true);

    // console.log('parsedURL inside normalizeSprites')
    // console.log(parsedUrl);
    parsedUrl.pathname = parsedUrl.pathname + '/sprite' + format + ext;

    // config.API_URL + pathPrefix + parsedUrl.pathname + '?' + formattedQuery
  //
  //   found: 'https://api.mapbox.com/styles/v1/mapbox/streets-v8/draft?fresh=true%2Fsprite%402x.png&access_token=key'
  // wanted: 'https://api.mapbox.com/styles/v1/mapbox/streets-v8/draft/sprite@2x.png?fresh=true&access_token=key'
    return normalizeURL(parsedUrl, '/styles/v1', accessToken);

    // return normalizeURL('mapbox://' + user + '/' + style + draft + '/sprite' + format + ext, '/styles/v1/', accessToken);
};

module.exports.normalizeTileURL = function(url, sourceUrl, tileSize) {
    if (!sourceUrl || !sourceUrl.match(/^mapbox:\/\//))
        return url;

    // The v4 mapbox tile API supports 512x512 image tiles only when @2x
    // is appended to the tile URL. If `tileSize: 512` is specified for
    // a Mapbox raster source force the @2x suffix even if a non hidpi
    // device.
    url = url.replace(/([?&]access_token=)tk\.[^&]+/, '$1' + config.ACCESS_TOKEN);
    var extension = browser.supportsWebp ? 'webp' : '$1';
    return url.replace(/\.((?:png|jpg)\d*)(?=$|\?)/, browser.devicePixelRatio >= 2 || tileSize === 512 ? '@2x.' + extension : '.' + extension);
};
