'use strict';

const config = require('./config');
const browser = require('./browser');
const URL = require('url');
const util = require('./util');

function makeAPIURL(path, query, accessToken) {
    accessToken = accessToken || config.ACCESS_TOKEN;

    if (!accessToken && config.REQUIRE_ACCESS_TOKEN) {
        throw new Error('An API access token is required to use Mapbox GL. ' +
            'See https://www.mapbox.com/developers/api/#access-tokens');
    }

    let url = config.API_URL + path + (query ? `?${query}` : '');

    if (config.REQUIRE_ACCESS_TOKEN) {
        if (accessToken[0] === 's') {
            throw new Error('Use a public access token (pk.*) with Mapbox GL JS, not a secret access token (sk.*). ' +
                'See https://www.mapbox.com/developers/api/#access-tokens');
        }

        url += `${query ? '&' : '?'}access_token=${accessToken}`;
    }

    return url;
}

module.exports.isMapboxURL = function(url) {
    return URL.parse(url).protocol === 'mapbox:';
};

module.exports.normalizeStyleURL = function(url, accessToken) {
    const urlObject = URL.parse(url);

    if (urlObject.protocol !== 'mapbox:') {
        return url;
    } else {
        return makeAPIURL(
            `/styles/v1${urlObject.pathname}`,
            urlObject.query,
            accessToken
        );
    }
};

module.exports.normalizeSourceURL = function(url, accessToken) {
    const urlObject = URL.parse(url);

    if (urlObject.protocol !== 'mapbox:') {
        return url;
    } else {
        // We parse the URL with a regex because the URL module does not handle
        // URLs with commas in the hostname
        const sources = url.match(/mapbox:\/\/([^?]+)/)[1];

        // TileJSON requests need a secure flag appended to their URLs so
        // that the server knows to send SSL-ified resource references.
        return `${makeAPIURL(
            `/v4/${sources}.json`,
            urlObject.query,
            accessToken
        )}&secure`;
    }

};

module.exports.normalizeGlyphsURL = function(url, accessToken) {
    const urlObject = URL.parse(url);

    if (urlObject.protocol !== 'mapbox:') {
        return url;
    } else {
        const user = urlObject.pathname.split('/')[1];
        return makeAPIURL(
            `/fonts/v1/${user}/{fontstack}/{range}.pbf`,
            urlObject.query,
            accessToken
        );
    }
};

module.exports.normalizeSpriteURL = function(url, format, extension, accessToken) {
    const urlObject = URL.parse(url);

    if (urlObject.protocol !== 'mapbox:') {
        urlObject.pathname += format + extension;
        return URL.format(urlObject);
    } else {
        return makeAPIURL(
            `/styles/v1${urlObject.pathname}/sprite${format}${extension}`,
            urlObject.query,
            accessToken
        );
    }
};

module.exports.normalizeTileURL = function(tileURL, sourceURL, tileSize) {
    const tileURLObject = URL.parse(tileURL, true);
    if (!sourceURL) return tileURL;
    const sourceURLObject = URL.parse(sourceURL);
    if (sourceURLObject.protocol !== 'mapbox:') return tileURL;

    // The v4 mapbox tile API supports 512x512 image tiles only when @2x
    // is appended to the tile URL. If `tileSize: 512` is specified for
    // a Mapbox raster source force the @2x suffix even if a non hidpi
    // device.

    const extension = browser.supportsWebp ? '.webp' : '$1';
    const resolution = (browser.devicePixelRatio >= 2 || tileSize === 512) ? '@2x' : '';

    return URL.format({
        protocol: tileURLObject.protocol,
        hostname: tileURLObject.hostname,
        pathname: tileURLObject.pathname.replace(/(\.(?:png|jpg)\d*)/, resolution + extension),
        query: replaceTempAccessToken(tileURLObject.query)
    });
};

function replaceTempAccessToken(query) {
    if (query.access_token && query.access_token.slice(0, 3) === 'tk.') {
        return util.extend({}, query, {
            'access_token': config.ACCESS_TOKEN
        });
    } else {
        return query;
    }
}
