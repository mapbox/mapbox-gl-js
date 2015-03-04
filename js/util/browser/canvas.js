'use strict';

module.exports = Canvas;

function Canvas(parent, container) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.classList.add('mapboxgl-canvas');
    if (parent.options.interactive) {
        this.canvas.classList.add('mapboxgl-interactive');
    }
    this.canvas.addEventListener('webglcontextlost', parent._contextLost.bind(parent), false);
    this.canvas.addEventListener('webglcontextrestored', parent._contextRestored.bind(parent), false);
    this.canvas.setAttribute('tabindex', 0);
    container.appendChild(this.canvas);
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

Canvas.prototype.getWebGLContext = function() {
    return this.canvas.getContext("experimental-webgl", {
        antialias: false,
        alpha: true,
        stencil: true,
        depth: false
    });
};

Canvas.prototype.getElement = function() {
    return this.canvas;
};
