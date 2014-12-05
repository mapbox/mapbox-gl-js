'use strict';

module.exports = function() {
    if (process.browser) {
        return document.createElement('canvas')
            .getContext("experimental-webgl", {
                antialias: false,
                alpha: true,
                stencil: true,
                depth: false
            });
    } else {
        return require('gl').createContext(512, 512);
    }
};
