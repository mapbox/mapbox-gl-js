'use strict';

const ajax =  require('../src/util/ajax');
const sinon = require('sinon');
const request = require('request');
const PNG = require('pngjs').PNG;
const Map = require('../src/ui/map');
const window = require('../src/util/window');
const browser = require('../src/util/browser');
const rtlTextPlugin = require('../src/source/rtl_text_plugin');
const rtlText = require('@mapbox/mapbox-gl-rtl-text');
const fs = require('fs');
const path = require('path');

rtlTextPlugin['applyArabicShaping'] = rtlText.applyArabicShaping;
rtlTextPlugin['processBidirectionalText'] = rtlText.processBidirectionalText;

module.exports = function(style, options, _callback) {
    let wasCallbackCalled = false;
    function callback() {
        if (!wasCallbackCalled) {
            wasCallbackCalled = true;
            _callback.apply(this, arguments);
        }
    }

    window.devicePixelRatio = options.pixelRatio;

    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: options.width});
    Object.defineProperty(container, 'offsetHeight', {value: options.height});

    const map = new Map({
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
    if (options.showOverdrawInspector) map.showOverdrawInspector = true;

    const gl = map.painter.gl;

    map.once('load', () => {
        if (options.collisionDebug) {
            map.showCollisionBoxes = true;
            options.operations = [["wait"]];
        }
        applyOperations(map, options.operations, () => {
            const w = options.width * window.devicePixelRatio;
            const h = options.height * window.devicePixelRatio;

            const pixels = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            const data = new Buffer(pixels);

            // Flip the scanlines.
            const stride = w * 4;
            const tmp = new Buffer(stride);
            for (let i = 0, j = h - 1; i < j; i++, j--) {
                const start = i * stride;
                const end = j * stride;
                data.copy(tmp, 0, start, start + stride);
                data.copy(data, start, end, end + stride);
                tmp.copy(data, end);
            }

            const results = options.queryGeometry ?
                map.queryRenderedFeatures(options.queryGeometry, options.queryOptions || {}) :
                [];

            map.remove();
            gl.getExtension('STACKGL_destroy_context').destroy();
            delete map.painter.gl;

            callback(null, data, results.map((feature) => {
                feature = feature.toJSON();
                delete feature.layer;
                return feature;
            }));

        });
    });
};

function applyOperations(map, operations, callback) {
    const operation = operations && operations[0];
    if (!operations || operations.length === 0) {
        callback();

    } else if (operation[0] === 'wait') {
        const wait = function() {
            if (map.loaded()) {
                applyOperations(map, operations.slice(1), callback);
            } else {
                map.once('render', wait);
            }
        };
        wait();

    } else if (operation[0] === 'addImage') {
        const img = PNG.sync.read(fs.readFileSync(path.join(__dirname, './integration', operation[2])));
        const pixelRatio = operation.length > 3 ? operation[3] : 1;
        map.addImage(operation[1], img.data, {height: img.height, width: img.width, pixelRatio: pixelRatio});
        applyOperations(map, operations.slice(1), callback);

    } else {
        map[operation[0]].apply(map, operation.slice(1));
        applyOperations(map, operations.slice(1), callback);
    }
}

const cache = {};

function cached(data, callback) {
    setImmediate(() => {
        callback(null, data);
    });
}

sinon.stub(ajax, 'getJSON').callsFake((url, callback) => {
    if (cache[url]) return cached(cache[url], callback);
    return request(url, (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            let data;
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

sinon.stub(ajax, 'getArrayBuffer').callsFake((url, callback) => {
    if (cache[url]) return cached(cache[url], callback);
    return request({url: url, encoding: null}, (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            cache[url] = {data: body};
            callback(null, {data: body});
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
});

sinon.stub(ajax, 'getImage').callsFake((url, callback) => {
    if (cache[url]) return cached(cache[url], callback);
    return request({url: url, encoding: null}, (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            new PNG().parse(body, (err, png) => {
                if (err) return callback(err);
                cache[url] = png;
                callback(null, png);
            });
        } else {
            callback(error || new Error(response.statusCode));
        }
    });
});

sinon.stub(browser, 'getImageData').callsFake((img) => {
    return new Uint8Array(img.data);
});

// Hack: since node doesn't have any good video codec modules, just grab a png with
// the first frame and fake the video API.
sinon.stub(ajax, 'getVideo').callsFake((urls, callback) => {
    return request({url: urls[0], encoding: null}, (error, response, body) => {
        if (!error && response.statusCode >= 200 && response.statusCode < 300) {
            new PNG().parse(body, (err, png) => {
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
