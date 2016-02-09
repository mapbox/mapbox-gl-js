'use strict';

var Map = require('../js/ui/map');
var browser = require('../js/util/browser');


module.exports = function(style, options, callback) {
    browser.devicePixelRatio = options.pixelRatio;

    var map = new Map({
        container: {
            offsetWidth: options.width,
            offsetHeight: options.height,
            classList: {
                add: function() {},
                remove: function() {}
            }
        },
        style: style,
        classes: options.classes,
        interactive: false,
        attributionControl: false
    });

    if (options.debug) map.showTileBoundaries = true;
    if (options.collisionDebug) map.showCollisionBoxes = true;

    var gl = map.painter.gl;

    map.once('load', function() {
        var w = options.width * browser.devicePixelRatio,
            h = options.height * browser.devicePixelRatio;

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

        if (options.at) {
            map.featuresAt(options.at, options, done);
        } else if (options.in) {
            map.featuresIn(options.in, options, done);
        } else {
            done(null, []);
        }

        function done(err, results) {
            map.remove();
            gl.destroy();

            if (err) return callback(err);

            results = results.map(function (r) {
                delete r.layer;
                return r;
            });

            callback(null, data, results);
        }

    });
};
