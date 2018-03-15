import {PNG} from 'pngjs';
import Map from '../src/ui/map';
import config from '../src/util/config';
import window from '../src/util/window';
import browser from '../src/util/browser';
import {plugin as rtlTextPlugin} from '../src/source/rtl_text_plugin';
import rtlText from '@mapbox/mapbox-gl-rtl-text';
import fs from 'fs';
import path from 'path';

rtlTextPlugin['applyArabicShaping'] = rtlText.applyArabicShaping;
rtlTextPlugin['processBidirectionalText'] = rtlText.processBidirectionalText;

module.exports = function(style, options, _callback) {
    let wasCallbackCalled = false;

    const timeout = setTimeout(() => {
        callback(new Error('Test timed out'));
    }, options.timeout || 20000);

    function callback() {
        if (!wasCallbackCalled) {
            clearTimeout(timeout);
            wasCallbackCalled = true;
            _callback.apply(this, arguments);
        }
    }

    window.devicePixelRatio = options.pixelRatio;

    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: options.width});
    Object.defineProperty(container, 'offsetHeight', {value: options.height});

    // We are self-hosting test files.
    config.REQUIRE_ACCESS_TOKEN = false;

    const map = new Map({
        container: container,
        style: style,
        classes: options.classes,
        interactive: false,
        attributionControl: false,
        preserveDrawingBuffer: true,
        axonometric: options.axonometric || false,
        skew: options.skew || [0, 0],
        fadeDuration: options.fadeDuration || 0
    });

    // Configure the map to never stop the render loop
    map.repaint = true;

    let now = 0;
    browser.now = function() {
        return now;
    };

    if (options.debug) map.showTileBoundaries = true;
    if (options.showOverdrawInspector) map.showOverdrawInspector = true;

    const gl = map.painter.context.gl;

    map.once('load', () => {
        if (options.collisionDebug) {
            map.showCollisionBoxes = true;
            if (options.operations) {
                options.operations.push(["wait"]);
            } else {
                options.operations = [["wait"]];
            }
        }
        applyOperations(map, options.operations, () => {
            const viewport = gl.getParameter(gl.VIEWPORT);
            const w = viewport[2];
            const h = viewport[3];

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
            delete map.painter.context.gl;

            callback(null, data, results.map((feature) => {
                feature = feature.toJSON();
                delete feature.layer;
                return feature;
            }));

        });
    });

    function applyOperations(map, operations, callback) {
        const operation = operations && operations[0];
        if (!operations || operations.length === 0) {
            callback();

        } else if (operation[0] === 'wait') {
            if (operation.length > 1) {
                now += operation[1];
                map._render();
                applyOperations(map, operations.slice(1), callback);

            } else {
                const wait = function() {
                    if (map.loaded()) {
                        applyOperations(map, operations.slice(1), callback);
                    } else {
                        map.once('render', wait);
                    }
                };
                wait();
            }

        } else if (operation[0] === 'sleep') {
            // Prefer "wait", which renders until the map is loaded
            // Use "sleep" when you need to test something that sidesteps the "loaded" logic
            setTimeout(() => {
                applyOperations(map, operations.slice(1), callback);
            }, operation[1]);
        } else if (operation[0] === 'addImage') {
            const {data, width, height} = PNG.sync.read(fs.readFileSync(path.join(__dirname, './integration', operation[2])));
            map.addImage(operation[1], {width, height, data: new Uint8Array(data)}, operation[3] || {});
            applyOperations(map, operations.slice(1), callback);

        } else {
            map[operation[0]].apply(map, operation.slice(1));
            applyOperations(map, operations.slice(1), callback);
        }
    }
};
