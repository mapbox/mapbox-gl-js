'use strict';

var Map = require('../js/ui/map');
var browser = require('../js/util/browser');


module.exports = function(style, options, _callback) {
    var wasCallbackCalled = false;
    function callback() {
        if (!wasCallbackCalled) {
            wasCallbackCalled = true;
            _callback.apply(this, arguments);
        }
    }

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

    // Configure the map to never stop the render loop
    map.repaint = true;

    if (options.debug) map.showTileBoundaries = true;
    if (options.collisionDebug) map.showCollisionBoxes = true;
    if (options.showOverdrawInspector) map.showOverdrawInspector = true;

    var gl = map.painter.gl;

    map.on('error', function(event) {
        callback(event.error);
    });

    map.once('load', function() {
        applyOperations(map, options.operations, function() {
            var w = options.width * browser.devicePixelRatio;
            var h = options.height * browser.devicePixelRatio;

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
