'use strict';

var VectorTilePoint = require('./vectortilepoint.js');

/*
 * Construct a new vector tile feature given a buffer.
 *
 * @param {object} buffer
 * @param {number} [end]
 * @param {extent}
 * @param {object} keys
 * @param {object} values
 */
module.exports = VectorTileFeature;
function VectorTileFeature(buffer, end, extent, keys, values) {
    // Public
    this._extent = extent;
    this._type = 0;

    // Private
    this._buffer = buffer;
    this._geometry = -1;

    if (typeof end === 'undefined') {
        end = buffer.length;
    }

    var val, tag;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            this._id = buffer.readVarint();
        } else if (tag == 2) {
            var tag_end = buffer.pos + buffer.readVarint();
            while (buffer.pos < tag_end) {
                var key = keys[buffer.readVarint()];
                var value = values[buffer.readVarint()];
                this[key] = value;
            }
        } else if (tag == 3) {
            this._type = buffer.readVarint();
        } else if (tag == 4) {
            this._geometry = buffer.pos;
            buffer.skip(val);
        } else {
            buffer.skip(val);
        }
    }
}

VectorTileFeature.Unknown = 0;
VectorTileFeature.Point = 1;
VectorTileFeature.LineString = 2;
VectorTileFeature.Polygon = 3;


VectorTileFeature.mapping = [];
VectorTileFeature.mapping[VectorTileFeature.Point] = 'point';
VectorTileFeature.mapping[VectorTileFeature.LineString] = 'line';
VectorTileFeature.mapping[VectorTileFeature.Polygon] = 'fill';


VectorTileFeature.prototype.loadGeometry = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint();
    var end = buffer.pos + bytes;
    var cmd = 1, length = 0, x = 0, y = 0;

    var lines = [];
    var line = null;

    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd == 1 || cmd == 2) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();

            if (cmd == 1) {
                // moveTo
                if (line) {
                    lines.push(line);
                }
                line = [];
            }

            line.push(new VectorTilePoint(x, y));
        } else if (cmd == 7) {
            // closePolygon
            line.push(line[0]);
        } else {
            throw new Error('unknown command ' + cmd);
        }
    }

    if (line) {
        lines.push(line);
    }

    return lines;
};

VectorTileFeature.prototype.bbox = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint();
    var end = buffer.pos + bytes;
    var cmd = 1, length = 0, x = 0, y = 0;

    var x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;

    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd == 1 || cmd == 2) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();
            if (x < x1) x1 = x;
            if (x > x2) x2 = x;
            if (y < y1) y1 = y;
            if (y > y2) y2 = y;
        } else if (cmd != 7) {
            throw new Error('unknown command ' + cmd);
        }
    }

    return { x1: x1, y1: y1, x2: x2, y2: y2 };
};
