'use strict';

var util = require('../util');
var isSupported = require('mapbox-gl-js-supported');
var config = require('../config');
var MockWebGLRenderingContext = require('webgl-mock/src/WebGLRenderingContext');

module.exports = Canvas;

function Canvas(parent, container) {
    this.canvas = document.createElement('canvas');

    if (parent && container) {
        this.canvas.style.position = 'absolute';
        this.canvas.classList.add('mapboxgl-canvas');
        this.canvas.addEventListener('webglcontextlost', parent._contextLost.bind(parent), false);
        this.canvas.addEventListener('webglcontextrestored', parent._contextRestored.bind(parent), false);
        this.canvas.setAttribute('tabindex', 0);
        container.appendChild(this.canvas);
    }

    if (config.MOCK_GL) {
        var gl = new MockWebGLRenderingContext(this.canvas);
        gl.getExtension = function (extention) {
            // disable VAO
            if (extention === 'OES_vertex_array_object') {
                return undefined;
            }
            return MockWebGLRenderingContext.prototype.getExtension.apply(this, arguments);
        };
        this.getWebGLContext = function () {
            return gl;
        };
    }
}

Canvas.prototype.resize = function(width, height) {
    var pixelRatio = window.devicePixelRatio || 1;

    // Request the required canvas size taking the pixelratio into account.
    this.canvas.width = pixelRatio * width;
    this.canvas.height = pixelRatio * height;

    // Maintain the same canvas size, potentially downscaling it for HiDPI displays
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
};

Canvas.prototype.getWebGLContext = function(attributes) {
    attributes = util.extend({}, attributes, isSupported.webGLContextAttributes);

    return this.canvas.getContext('webgl', attributes) ||
        this.canvas.getContext('experimental-webgl', attributes);
};

Canvas.prototype.getElement = function() {
    return this.canvas;
};
