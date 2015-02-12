'use strict';

var request = require('request');
var PNG = require('pngjs').PNG;

exports.getJSON = function(url, callback) {
    return request(url, function(error, response, body) {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            var data;
            try {
                data = JSON.parse(body);
            } catch (err) {
                return callback(err);
            }
            callback(null, data);
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
};

exports.getArrayBuffer = function(url, callback) {
    return request({url: url, encoding: null}, function(error, response, body) {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            var ab = new ArrayBuffer(body.length);
            var view = new Uint8Array(ab);
            for (var i = 0; i < body.length; ++i) {
                view[i] = body[i];
            }
            callback(null, ab);
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
};

exports.getImage = function(url, callback) {
    return request({url: url, encoding: null}, function(error, response, body) {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            new PNG().parse(body, function(err, png) {
                if (err) return callback(err);
                callback(null, {
                    width: png.width,
                    height: png.height,
                    data: png.data,
                    getData: function() { return this.data; }
                });
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
