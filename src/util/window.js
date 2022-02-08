// @flow strict

// This file is intended for use in the Mapbox GL JS test suite
// It implements a JSDOM window object for use in Node environments
// In a browser environment, this file is replaced with ./src/util/browser/window.js
// when Rollup builds the main bundle
// See package.json#browser

import jsdom from 'jsdom';

import gl from 'gl';
import sinon from 'sinon';

import type {Window} from '../types/window.js';
import type {JSDOM} from 'jsdom';

const {window: _window} = (new jsdom.JSDOM('', {
    virtualConsole: new jsdom.VirtualConsole().sendTo(console)
}): JSDOM);

restore();

export default _window;

function restore(): Window {
    // Remove previous window from exported object
    const previousWindow = _window;
    if (previousWindow.close) previousWindow.close();
    for (const key in previousWindow) {
        if (previousWindow.hasOwnProperty(key)) {
            delete previousWindow[key];
        }
    }

    // Create new window and inject into exported object
    const {window} = new jsdom.JSDOM('', {
        // Send jsdom console output to the node console object.
        virtualConsole: new jsdom.VirtualConsole().sendTo(console)
    });

    // Delete local and session storage from JSDOM and stub them out with a warning log
    // Accessing these properties during extend() produces an error in Node environments
    // See https://github.com/mapbox/mapbox-gl-js/pull/7455 for discussion
    delete window.localStorage;
    delete window.sessionStorage;
    window.localStorage = window.sessionStorage = () => console.log('Local and session storage not available in Node. Use a stub implementation if needed for testing.');

    window.devicePixelRatio = 1;

    window.requestAnimationFrame = function(callback) {
        return setImmediate(callback, 0);
    };
    window.cancelAnimationFrame = clearImmediate;

    // Add webgl context with the supplied GL
    const originalGetContext = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = function (type, attributes) {
        if (type === 'webgl') {
            if (!this._webGLContext) {
                this._webGLContext = gl(this.width, this.height, attributes);
            }
            return this._webGLContext;
        }
        // Fallback to existing HTMLCanvasElement getContext behaviour
        return originalGetContext.call(this, type, attributes);
    };

    window.useFakeHTMLCanvasGetContext = function() {
        this.HTMLCanvasElement.prototype.getContext = function() { return '2d'; };
    };

    window.useFakeXMLHttpRequest = function() {
        sinon.xhr.supportsCORS = true;
        this.server = sinon.fakeServer.create();
        this.XMLHttpRequest = this.server.xhr;
    };

    window.URL.revokeObjectURL = function () {};

    window.fakeWorkerPresence = function() {
        global.WorkerGlobalScope = function() {};
        global.self = new global.WorkerGlobalScope();
    };
    window.clearFakeWorkerPresence = function() {
        global.WorkerGlobalScope = undefined;
        global.self = undefined;
    };

    window.restore = restore;

    window.performance.getEntriesByName = function() {};
    window.performance.mark = function() {};
    window.performance.measure = function() {};
    window.performance.clearMarks = function() {};
    window.performance.clearMeasures = function() {};

    window.ImageData = window.ImageData || function() { return false; };
    window.ImageBitmap = window.ImageBitmap || function() { return false; };
    window.WebGLFramebuffer = window.WebGLFramebuffer || Object;
    Object.assign(_window, window); // eslint-disable-line no-restricted-properties

    return window;
}
