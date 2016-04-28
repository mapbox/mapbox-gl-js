'use strict';

// Stub implementation for headless rendering with node. The browser implementation
// is in js/browser/ui/canvas.js.

var gl = require('gl');
var browser = require('./browser');

module.exports = Canvas;

function Canvas(parent, container) {
    var requiredContextAttributes = {
        antialias: false,
        alpha: true,
        stencil: true,
        depth: true,
        preserveDrawingBuffer: true
    };

    this.context = gl(
        ((container && container.offsetWidth) || 512) * browser.devicePixelRatio,
        ((container && container.offsetHeight) || 512) * browser.devicePixelRatio,
        requiredContextAttributes);
}

Canvas.prototype.resize = function() {
};

Canvas.prototype.getWebGLContext = function() {
    return this.context;
};

Canvas.prototype.getElement = function() {
};
