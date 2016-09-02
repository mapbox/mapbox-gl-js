'use strict';

var gl = require('gl');

module.exports = function(canvas, attributes) {
    if (canvas._webGLContext)
        return canvas._webGLContext;
    canvas._webGLContext = gl(canvas.width, canvas.height, attributes);
    return canvas._webGLContext;
};
