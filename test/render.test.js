'use strict';

var Map = require('../js/ui/map');
var browser = require('../js/util/browser');
var suite = require('mapbox-gl-test-suite').render;

var tests;

if (process.argv[1] === __filename && process.argv.length > 2) {
    tests = process.argv.slice(2);
}

suite.run('js', {tests: tests}, function(style, options, callback) {
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

    var gl = map.painter.gl;

    map.once('load', function() {
        var w = options.width * browser.devicePixelRatio,
            h = options.height * browser.devicePixelRatio;

        var pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        var data = new Buffer(pixels);

        map.remove();
        gl.destroy();

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

        callback(null, data);
    });
});
