'use strict';

var jsdom = require('jsdom');
module.exports = jsdom.jsdom().defaultView;
