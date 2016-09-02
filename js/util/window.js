'use strict';

var jsdom = require('jsdom');
var gl = require('gl');
var sinon = require('sinon');
var util = require('./util');

var window = module.exports;

function restore() {

    var window = jsdom.jsdom(undefined, {
        // Send jsdom console output to the node console object.
        virtualConsole: jsdom.createVirtualConsole().sendTo(console)
    }).defaultView;

    for (var key in window) if (window.hasOwnProperty(key)) delete window[key];
    util.extend(window, jsdom.jsdom().defaultView);

    window.requestAnimationFrame = function(callback) {
        return setImmediate(callback, 0);
    };

    window.cancelAnimationFrame = clearImmediate;

    window.devicePixelRatio = 1;

    sinon.xhr.supportsCORS = true;
    window.server = sinon.fakeServer.create();
    window.XMLHttpRequest = window.server.xhr;

    window.restore = restore;

    // Stub some CSSOM-related properties that jsdom doesn't implement.
    Object.defineProperties(window.HTMLElement.prototype, {
        clientLeft: {
            get: function() { return 0; }
        },
        clientTop: {
            get: function() { return 0; }
        }
    });

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

    window.restore = restore;

}

restore();
