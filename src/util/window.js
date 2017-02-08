'use strict';

const jsdom = require('jsdom');
const gl = require('gl');
const sinon = require('sinon');
const util = require('./util');

function restore() {

    // Remove previous window from module.exports
    const previousWindow = module.exports;
    if (previousWindow.close) previousWindow.close();
    for (const key in previousWindow) if (previousWindow.hasOwnProperty(key)) delete previousWindow[key];

    // Create new window and inject into module.exports
    const window = jsdom.jsdom(undefined, {
        // Send jsdom console output to the node console object.
        virtualConsole: jsdom.createVirtualConsole().sendTo(console)
    }).defaultView;
    util.extend(module.exports, window);

    window.devicePixelRatio = 1;

    window.requestAnimationFrame = function(callback) {
        return setImmediate(callback, 0);
    };
    window.cancelAnimationFrame = clearImmediate;

    // Stub some CSSOM-related properties that jsdom doesn't implement.
    window.HTMLElement.prototype.clientLeft = 0;
    window.HTMLElement.prototype.clientTop = 0;

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
        window.HTMLCanvasElement.prototype.getContext = sinon.stub().returns('2d');
    };

    window.useFakeXMLHttpRequest = function() {
        sinon.xhr.supportsCORS = true;
        window.server = sinon.fakeServer.create();
        window.XMLHttpRequest = window.server.xhr;
    };

    window.URL.revokeObjectURL = function () {};

    window.restore = restore;

    window.ImageData = window.ImageData || sinon.stub().returns(false);

    return window;
}

module.exports = restore();
