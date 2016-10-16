'use strict';

var jsdom = require('jsdom');
var gl = require('gl');
var sinon = require('sinon');
var util = require('./util');

function restore() {

    // Remove previous window from module.exports
    var previousWindow = module.exports;
    if (previousWindow.close) previousWindow.close();
    for (var key in previousWindow) if (previousWindow.hasOwnProperty(key)) delete previousWindow[key];

    // Create new window and inject into module.exports
    var window = jsdom.jsdom(undefined, {
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

    window.HTMLCanvasElement.prototype.getContext = function(type, attributes) {
        if (!this._webGLContext) {
            this._webGLContext = gl(this.width, this.height, attributes);
        }
        return this._webGLContext;
    };

    window.useFakeXMLHttpRequest = function() {
        sinon.xhr.supportsCORS = true;
        window.server = sinon.fakeServer.create();
        window.XMLHttpRequest = window.server.xhr;
    };

    window.URL.revokeObjectURL = function () {};

    window.restore = restore;

    return window;
}

module.exports = restore();
