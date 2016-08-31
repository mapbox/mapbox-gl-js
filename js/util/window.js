'use strict';

var jsdom = require('jsdom');

var window = jsdom.jsdom().defaultView;

window.requestAnimationFrame = function(callback) { return setTimeout(callback, 0); };
window.cancelAnimationFrame = clearTimeout;

window.devicePixelRatio = 1;

module.exports = window;
