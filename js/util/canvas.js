'use strict';

var WebGLRenderingContext = require('webgl-mock/src/WebGLRenderingContext');

var browser = require('./browser');

module.exports = Canvas;

function Canvas(parent, container) {
    this.context = new WebGLRenderingContext({
        width: ((container && container.offsetWidth) || 512) * browser.devicePixelRatio,
        height: ((container && container.offsetHeight) || 512) * browser.devicePixelRatio
    });

    setTimeout(parent._contextRestored.bind(parent), 0);
}

Canvas.prototype.resize = function() {};

Canvas.prototype.getWebGLContext = function() {
    return this.context;
};

Canvas.prototype.getElement = function() {};
