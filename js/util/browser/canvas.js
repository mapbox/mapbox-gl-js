'use strict';

var util = require('../util');

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

var requiredContextAttributes = {
    antialias: false,
    alpha: true,
    stencil: true,
    depth: false
};

Canvas.prototype.getWebGLContext = function(attributes) {
    attributes = util.extend({}, attributes, requiredContextAttributes);

    return this.canvas.getContext('webgl', attributes) ||
        this.canvas.getContext('experimental-webgl', attributes);
};

Canvas.prototype.supportsWebGLContext = function(failIfMajorPerformanceCaveat) {
    var attributes = util.extend({
        failIfMajorPerformanceCaveat: failIfMajorPerformanceCaveat
    }, requiredContextAttributes);

    if ('probablySupportsContext' in this.canvas) {
        return this.canvas.probablySupportsContext('webgl', attributes) ||
            this.canvas.probablySupportsContext('experimental-webgl', attributes);
    } else if ('supportsContext' in this.canvas) {
        return this.canvas.supportsContext('webgl', attributes) ||
            this.canvas.supportsContext('experimental-webgl', attributes);
    }

    return !!window.WebGLRenderingContext && !!this.getWebGLContext(failIfMajorPerformanceCaveat);
};

Canvas.prototype.getElement = function() {
    return this.canvas;
};
