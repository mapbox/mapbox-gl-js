'use strict';

var jsdom = require('jsdom');
var gl = require('gl');

var window = jsdom.jsdom().defaultView;

window.requestAnimationFrame = function(callback) { return setImmediate(callback, 0); };
window.cancelAnimationFrame = clearImmediate;

window.devicePixelRatio = 1;

window.HTMLCanvasElement.prototype.getContext = function(type, attributes) {
    if (!this._webGLContext) {
        this._webGLContext = gl(this.width, this.height, attributes);
    }
    return this._webGLContext;
};

module.exports = window;
