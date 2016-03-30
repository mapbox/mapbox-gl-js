'use strict';

var request = require('request');
var PNG = require('pngjs').PNG;

/**
 * Get JSON data from URL
 *
 * @param {string} url the request URL
 * @param {getJSONCallback} callback function that returns the reponse
 *
 * @callback {getJSONCallback} `this`
 * @param {Object|null} err Error _If any_
 * @param {Array} features Displays a JSON array of features.
 *
 * @example
 * mapboxgl.util.getJSON('style.json', function (err, style) {
 *     if (err) throw err;
 *     map.setStyle(style);
 * });
 */

var cache = {};

function cached(data, callback) {
    setImmediate(function () {
        callback(null, data);
    });
}

exports.getJSON = function(url, callback) {
    if (cache[url]) return cached(cache[url], callback);
    return request(url, function(error, response, body) {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            var data;
            try {
                data = JSON.parse(body);
            } catch (err) {
                return callback(err);
            }
            cache[url] = data;
            callback(null, data);
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
};

exports.getArrayBuffer = function(url, callback) {
    if (cache[url]) return cached(cache[url], callback);
    return request({url: url, encoding: null}, function(error, response, body) {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            var ab = new ArrayBuffer(body.length);
            var view = new Uint8Array(ab);
            for (var i = 0; i < body.length; ++i) {
                view[i] = body[i];
            }
            cache[url] = ab;
            callback(null, ab);
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
};

function fakeImage(png) {
    return {
        width: png.width,
        height: png.height,
        data: png.data.slice(),
        complete: true,
        addEventListener: function() {},
        getData: function() { return this.data; }
    };
}

exports.getImage = function(url, callback) {
    if (cache[url]) return cached(fakeImage(cache[url]), callback);
    return request({url: url, encoding: null}, function(error, response, body) {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            new PNG().parse(body, function(err, png) {
                if (err) return callback(err);
                cache[url] = png;
                callback(null, fakeImage(png));
            });
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
};

// Hack: since node doesn't have any good video codec modules, just grab a png with
// the first frame and fake the video API.
exports.getVideo = function(urls, callback) {
    return request({url: urls[0], encoding: null}, function(error, response, body) {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            new PNG().parse(body, function(err, png) {
                if (err) return callback(err);
                callback(null, {
                    readyState: 4, // HAVE_ENOUGH_DATA
                    addEventListener: function() {},
                    play: function() {},
                    width: png.width,
                    height: png.height,
                    data: png.data
                });
            });
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
};
