'use strict';

var VectorTileFeature = require('./vectortilefeature.js');

module.exports = VectorTileLayer;
function VectorTileLayer(buffer, end) {
    // Public
    this.version = 1;
    this.name = null;
    this.extent = 4096;
    this.length = 0;
    this.shaping = {};
    this.faces = [];

    // Private
    this._buffer = buffer;
    this._keys = [];
    this._values = [];
    this._features = [];

    var stack_index = [];
    var labels = [];

    var val, tag;
    if (typeof end === 'undefined') end = buffer.length;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;
        if (tag == 15) {
            this.version = buffer.readVarint();
        } else if (tag == 1) {
            this.name = buffer.readString();
        } else if (tag == 5) {
            this.extent = buffer.readVarint();
        } else if (tag == 2) {
            this.length++;
            this._features.push(buffer.pos);
            buffer.skip(val);
        } else if (tag == 3) {
            this._keys.push(buffer.readString());
        } else if (tag == 4) {
            this._values.push(this.readFeatureValue());
        } else if (tag == 7) {
            this.faces.push(buffer.readString());
        } else if (tag == 8) {
            labels.push(this.readLabel());
        } else if (tag == 9) {
            stack_index.push(buffer.readString());
        } else {
            console.warn('skipping layer tag ' + tag);
            buffer.skip(val);
        }
    }

    // Build index of [stack][text] => shaping information
    var shaping = this.shaping;
    for (var i = 0; i < labels.length; i++) {
        var label = labels[i];
        var text = this._values[label.text];
        var stack = stack_index[label.stack];

        if (!(stack in shaping)) shaping[stack] = {};
        shaping[stack][text] = label.glyphs;
    }
}

VectorTileLayer.prototype.readFeatureValue = function() {
    var buffer = this._buffer;
    var value = null;

    var bytes = buffer.readVarint();
    var val, tag;
    var end = buffer.pos + bytes;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            value = buffer.readString();
        } else if (tag == 2) {
            throw new Error('read float');
        } else if (tag == 3) {
            value = buffer.readDouble();
        } else if (tag == 4) {
            value = buffer.readVarint();
        } else if (tag == 5) {
            throw new Error('read uint');
        } else if (tag == 6) {
            value = buffer.readSVarint();
        } else if (tag == 7) {
            value = Boolean(buffer.readVarint());
        } else {
            buffer.skip(val);
        }
    }

    return value;
};

VectorTileLayer.prototype.readLabel = function() {
    var label = { glyphs: [] };
    var faces, glyphs, x, y;

    var buffer = this._buffer;
    var bytes = buffer.readVarint();
    var val, tag;
    var end = buffer.pos + bytes;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            label.text = buffer.readVarint();
        } else if (tag == 2) {
            label.stack = buffer.readVarint();
        } else if (tag == 3) {
            faces = buffer.readPacked('Varint');
        } else if (tag == 4) {
            glyphs = buffer.readPacked('Varint');
        } else if (tag == 5) {
            x = buffer.readPacked('Varint');
        } else if (tag == 6) {
            y = buffer.readPacked('Varint');
        } else {
            buffer.skip(val);
        }
    }

    if (glyphs) {
        for (var i = 0; i < glyphs.length; i++) {
            label.glyphs.push({ face: faces[i], glyph: glyphs[i], x: x[i], y: y[i] });
        }
    }

    return label;
};

/*
 * Return feature `i` from this layer as a `VectorTileFeature`
 *
 * @param {number} i
 * @returns {VectorTileFeature}
 */
VectorTileLayer.prototype.feature = function(i) {
    if (i < 0 || i >= this._features.length) {
        throw new Error('feature index out of bounds');
    }

    this._buffer.pos = this._features[i];
    var end = this._buffer.readVarint() + this._buffer.pos;
    return new VectorTileFeature(this._buffer, end, this.extent, this._keys, this._values);
};
