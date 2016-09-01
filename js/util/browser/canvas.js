'use strict';

var util = require('../util');
var isSupported = require('mapbox-gl-supported');
var window = require('./window');

module.exports = Canvas;

function Canvas(map, container) {
    this.canvas = window.document.createElement('canvas');

    if (map && container) {
        this.canvas.style.position = 'absolute';
        this.canvas.classList.add('mapboxgl-canvas');
        this.canvas.addEventListener('webglcontextlost', map._contextLost.bind(map), false);
        this.canvas.addEventListener('webglcontextrestored', map._contextRestored.bind(map), false);
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

Canvas.prototype.getWebGLContext = function(attributes) {
    attributes = util.extend({}, attributes, isSupported.webGLContextAttributes);

    return this.canvas.getContext('webgl', attributes) ||
        this.canvas.getContext('experimental-webgl', attributes);
};

Canvas.prototype.getElement = function() {
    return this.canvas;
};
