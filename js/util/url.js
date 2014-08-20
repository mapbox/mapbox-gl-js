'use strict';

var config = require('./config');

module.exports = function(path, accessToken) {
    accessToken = accessToken || config.ACCESS_TOKEN;

    if (!accessToken && config.REQUIRE_ACCESS_TOKEN) {
        throw new Error('An API access token is required to use Mapbox GL. ' +
            'See https://www.mapbox.com/developers/api/#access-tokens');
    }

    var url = ((typeof document !== 'undefined' && 'https:' === document.location.protocol) ||
        config.FORCE_HTTPS) ? config.HTTPS_URL : config.HTTP_URL;
    url += path;
    url += url.indexOf('?') !== -1 ? '&access_token=' : '?access_token=';

    if (config.REQUIRE_ACCESS_TOKEN) {
        if (accessToken[0] === 's') {
            throw new Error('Use a public access token (pk.*) with Mapbox GL JS, not a secret access token (sk.*). ' +
                'See https://www.mapbox.com/developers/api/#access-tokens');
        }

        url += accessToken;
    }

    return url;
};

module.exports.tileJSON = function(mapID, accessToken) {
    var url = module.exports('/' + mapID + '.json', accessToken);

    // TileJSON requests need a secure flag appended to their URLs so
    // that the server knows to send SSL-ified resource references.
    if (url.indexOf('https') === 0)
        url += '&secure';

    return url;
};
