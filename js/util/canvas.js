'use strict';

var gl = require('gl');
var window = require('./window');

module.exports = Canvas;

function Canvas(map) {
    var requiredContextAttributes = {
        antialias: false,
        alpha: true,
        stencil: true,
        depth: true,
        preserveDrawingBuffer: true
    };

    this.context = gl(
        map.getContainer().offsetWidth * window.devicePixelRatio,
        map.getContainer().offsetHeight * window.devicePixelRatio,
        requiredContextAttributes
    );
}

Canvas.prototype.resize = function() {};

Canvas.prototype.getWebGLContext = function() {
    return this.context;
};

Canvas.prototype.getElement = function() {};
