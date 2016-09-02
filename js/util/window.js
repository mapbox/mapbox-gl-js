'use strict';

var jsdom = require('jsdom');
var gl = require('gl');

var window = jsdom.jsdom(undefined, {
    // Send jsdom console output to the node console object.
    virtualConsole: jsdom.createVirtualConsole().sendTo(console)
}).defaultView;

window.requestAnimationFrame = function(callback) { return setImmediate(callback, 0); };
window.cancelAnimationFrame = clearImmediate;

window.devicePixelRatio = 1;

window.HTMLCanvasElement.prototype.getContext = function(type, attributes) {
    if (!this._webGLContext) {
        this._webGLContext = gl(this.width, this.height, attributes);
    }
    return this._webGLContext;
};

// Stub some CSSOM-related properties that jsdom doesn't implement.
Object.defineProperties(window.HTMLElement.prototype, {
    clientLeft: {
        get: function() { return 0; }
    },
    clientTop: {
        get: function() { return 0; }
    }
});

module.exports = window;
