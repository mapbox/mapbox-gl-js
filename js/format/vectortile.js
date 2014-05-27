'use strict';

var VectorTileLayer = require('./vectortilelayer');

module.exports = VectorTile;
function VectorTile(buffer, end) {
    // Public
    this.layers = {};

    // Private
    this._buffer = buffer;

    var val, tag;
    if (typeof end === 'undefined') end = buffer.length;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;
        if (tag == 3) {
            var layer = this.readLayer();
            if (layer.length) {
                this.layers[layer.name] = layer;
            }
        } else {
            // console.warn('skipping tile tag ' + tag);
            buffer.skip(val);
        }
    }
}

VectorTile.prototype.readLayer = function() {
    var buffer = this._buffer;

    var bytes = buffer.readVarint();
    var end = buffer.pos + bytes;
    var layer = new VectorTileLayer(buffer, end);
    buffer.pos = end;
    return layer;
};
