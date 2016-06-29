'use strict';
var util = require('../util/util');
var ajax = require('../util/ajax');
var browser = require('../util/browser');
var normalizeURL = require('../util/mapbox').normalizeSourceURL;

module.exports = function(options, callback) {
    var loaded = function(err, tileJSON) {
        if (err) {
            return callback(err);
        }

        var result = util.pick(tileJSON, ['tiles', 'minzoom', 'maxzoom', 'attribution']);

        if (tileJSON.vector_layers) {
            result.vectorLayers = tileJSON.vector_layers;
            result.vectorLayerIds = result.vectorLayers.map(function(layer) { return layer.id; });
        }

        callback(null, result);
    };

    if (options.url) {
        ajax.getJSON(normalizeURL(options.url), loaded);
    } else {
        browser.frame(loaded.bind(null, null, options));
    }
};

