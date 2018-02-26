// @flow

import jsdom from 'jsdom';

import gl from 'gl';
import sinon from 'sinon';
import util from './util';

function restore(): Window {
    // Remove previous window from module.exports
    const previousWindow = module.exports;
    if (previousWindow.close) previousWindow.close();
    for (const key in previousWindow) {
        if (previousWindow.hasOwnProperty(key)) {
            delete previousWindow[key];
        }
    }

    // Create new window and inject into module.exports
    const { window } = new jsdom.JSDOM('', {
        // Send jsdom console output to the node console object.
        virtualConsole: new jsdom.VirtualConsole().sendTo(console)
    });

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

    window.restore = restore;

    window.ImageData = window.ImageData || function() { return false; };
    window.ImageBitmap = window.ImageBitmap || function() { return false; };
    window.WebGLFramebuffer = window.WebGLFramebuffer || Object;
    util.extend(module.exports, window);

    return window;
}

export default restore();
