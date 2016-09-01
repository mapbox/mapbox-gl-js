'use strict';

var jsdom = require('jsdom');

var window = jsdom.jsdom().defaultView;

window.requestAnimationFrame = function(callback) { return setImmediate(callback, 0); };
window.cancelAnimationFrame = clearImmediate;

window.devicePixelRatio = 1;

module.exports = window;
