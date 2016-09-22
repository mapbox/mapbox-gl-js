'use strict';

var ajax =  require('../js/util/ajax');
var sinon = require('sinon');
var request = require('request');
var PNG = require('pngjs').PNG;
var Map = require('../js/ui/map');
var window = require('../js/util/window');

module.exports = function(style, options, _callback) {
    var wasCallbackCalled = false;
    function callback() {
        if (!wasCallbackCalled) {
            wasCallbackCalled = true;
            _callback.apply(this, arguments);
        }
    }

    window.devicePixelRatio = options.pixelRatio;

    var container = window.document.createElement('div');
    container.offsetHeight = options.height;
    container.offsetWidth = options.width;

    var map = new Map({
        container: container,
        style: style,
        classes: options.classes,
        interactive: false,
        attributionControl: false,
        preserveDrawingBuffer: true
    });

    // Configure the map to never stop the render loop
    map.repaint = true;

    if (options.debug) map.showTileBoundaries = true;
    if (options.collisionDebug) map.showCollisionBoxes = true;
    if (options.showOverdrawInspector) map.showOverdrawInspector = true;

    var gl = map.painter.gl;

    map.once('load', function() {
        applyOperations(map, options.operations, function() {
            var w = options.width * window.devicePixelRatio;
            var h = options.height * window.devicePixelRatio;

            var pixels = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            var data = new Buffer(pixels);

            // Flip the scanlines.
            var stride = w * 4;
            var tmp = new Buffer(stride);
            for (var i = 0, j = h - 1; i < j; i++, j--) {
                var start = i * stride;
                var end = j * stride;
                data.copy(tmp, 0, start, start + stride);
                data.copy(data, start, end, end + stride);
                tmp.copy(data, end);
            }

            var results = options.queryGeometry ?
                map.queryRenderedFeatures(options.queryGeometry, options) :
                [];

            map.remove();
            gl.getExtension('STACKGL_destroy_context').destroy();
            delete map.painter.gl;

            callback(null, data, results.map(function (feature) {
                feature = feature.toJSON();
                delete feature.layer;
                return feature;
            }));

        });
    });
};

function applyOperations(map, operations, callback) {
    var operation = operations && operations[0];
    if (!operations || operations.length === 0) {
        callback();

    } else if (operation[0] === 'wait') {
        var wait = function() {
            if (map.loaded()) {
                applyOperations(map, operations.slice(1), callback);
            } else {
                map.once('render', wait);
            }
        };
        wait();

    } else {
        map[operation[0]].apply(map, operation.slice(1));
        applyOperations(map, operations.slice(1), callback);
    }
}

function fakeImage(png) {
    return {
        width: png.width,
        height: png.height,
        data: png.data.slice(),
        complete: true,
        getData: function() { return this.data; }
    };
}

var cache = {};

function cached(data, callback) {
    setImmediate(function () {
        callback(null, data);
    });
}

sinon.stub(ajax, 'getJSON', function(url, callback) {
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
});

sinon.stub(ajax, 'getArrayBuffer', function(url, callback) {
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
});

sinon.stub(ajax, 'getImage', function(url, callback) {
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
});

// Hack: since node doesn't have any good video codec modules, just grab a png with
// the first frame and fake the video API.
sinon.stub(ajax, 'getVideo', function(urls, callback) {
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
});
