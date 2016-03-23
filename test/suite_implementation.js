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

        var results = options.queryGeometry ?
            map.queryRenderedFeatures(options.queryGeometry, options) :
            [];

        map.remove();
        gl.destroy();

        callback(null, data, results.map(prepareFeatures));

        function prepareFeatures(r) {
            delete r.layer;
            r.geometry = null;
            return JSON.parse(JSON.stringify(r));
        }
    });
};
