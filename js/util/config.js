'use strict';

var Evented = require('./evented');
var util = require('./util');

var config = util.extend({
    API_URL: 'https://api.mapbox.com',
    REQUIRE_ACCESS_TOKEN: true
}, Evented);

var accessToken;
Object.defineProperty(config, 'ACCESS_TOKEN', {
    get: function() { return accessToken; },
    set: function(token) {
        accessToken = token;
        this.fire('token.change', { token: token });
    }
});

module.exports = config;
