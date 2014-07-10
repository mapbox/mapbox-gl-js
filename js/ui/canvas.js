'use strict';

// Stub implementation for headless rendering with node. The browser implementation
// is in js/browser/ui/canvas.js.

var GL = require('gl');

module.exports = Canvas;

function Canvas() {
    this.context = GL.createContext(512, 512);
}

Canvas.prototype.resize = function(width, height) {
};

Canvas.prototype.getWebGLContext = function() {
    return this.context;
};
