'use strict';

module.exports = function(canvas, attributes) {
    return canvas.getContext('webgl', attributes) ||
        canvas.getContext('experimental-webgl', attributes);
};
