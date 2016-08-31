'use strict';

var gl = require('gl');
var window = require('./window');

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
        ((container && container.offsetWidth) || 512) * window.devicePixelRatio,
        ((container && container.offsetHeight) || 512) * window.devicePixelRatio,
        requiredContextAttributes
    );
}

Canvas.prototype.resize = function() {};

Canvas.prototype.getWebGLContext = function() {
    return this.context;
};

Canvas.prototype.getElement = function() {};
