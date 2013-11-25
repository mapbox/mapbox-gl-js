'use strict';

if (typeof window === 'undefined') {
    require('./worker/worker.js');
} else {
    exports.Map = require('./ui/map.js');
    exports.Style = require('./style/style.js');
    exports.StyleLayer = require('./style/stylelayer.js');
    exports.evented = require('./lib/evented.js');
    exports.chroma = require('./lib/chroma.js');
    exports.util = require('./util/util.js');
}
