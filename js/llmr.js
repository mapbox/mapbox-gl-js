'use strict';

if (typeof window === 'undefined') {
    require('./worker/worker.js');
} else {
    exports.Map = require('./ui/map.js');
    exports.evented = require('./lib/evented.js');
    exports.chroma = require('./lib/chroma.js');
    exports.util = require('./util/util.js');
}
