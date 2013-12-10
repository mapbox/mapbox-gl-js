'use strict';

if (typeof window === 'undefined') {
    require('./worker/worker.js');
} else {
    exports.Map = require('./ui/map.js');
    exports.Layer = require('./ui/datasource.js');
    exports.Style = require('./style/style.js');
    exports.StyleDeclaration = require('./style/styledeclaration.js');
    exports.Tile = require('./ui/tile.js');
    exports.evented = require('./lib/evented.js');
    exports.chroma = require('./lib/chroma.js');
    exports.util = require('./util/util.js');
    exports.assert = require('./util/assert.js');
}
