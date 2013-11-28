'use strict';

var VectorTilePoint = require('./vectortilepoint.js');
var util = require('../util/util.js');

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

var sq2 = util.distance_squared;


// Code from http://stackoverflow.com/a/1501725/331379.
function sqr(x) { return x * x; }
function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y); }
function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  if (t < 0) return dist2(p, v);
  if (t > 1) return dist2(p, w);
  return dist2(p, { x: v.x + t * (w.x - v.x),
                    y: v.y + t * (w.y - v.y) });
}

function lineContainsPoint(rings, p, radius) {
    var r = radius * radius;

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var j = 1; j < ring.length; j++) {
            // Find line segments that have a distance <= radius^2 to p
            // In that case, we treat the line as "containing point p".
            var v = ring[j-1], w = ring[j];
            if (distToSegmentSquared(p, v, w) < r) return true;
        }
    }
    return false;
}

function polyContainsPoint(rings, p) {
    var vert = rings[0];
    if (rings.length > 1) {
        // Convert the rings to a single 0,0 separated list.
        var O = { x: 0, y: 0 };
        vert = [O];
        for (var k = 0; k < rings.length; k++) {
            vert.push.apply(vert, rings[k]);
            vert.push(O);
        }
    }

    // Point in polygon test from
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    var c = false;
    for (var i = 0, j = vert.length - 1; i < vert.length; j = i++) {
        if (((vert[i].y > p.y) != (vert[j].y > p.y)) &&
            (p.x < (vert[j].x - vert[i].x) * (p.y - vert[i].y) / (vert[j].y - vert[i].y) + vert[i].x)) {
            c = !c;
        }
    }
    return c;
}

function pointContainsPoint(rings, p, radius) {
    var r = radius * radius;

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var j = 0; j < ring.length; j++) {
            if (util.distance_squared(ring[j], p) <= r) return true;
        }
    }
    return false;
}

VectorTileFeature.prototype.contains = function(p, radius) {
    var rings = this.loadGeometry();
    if (this._type === VectorTileFeature.Point) {
        return pointContainsPoint(rings, p, radius);
    } else if (this._type === VectorTileFeature.LineString) {
        return lineContainsPoint(rings, p, radius);
    } else if (this._type === VectorTileFeature.Polygon) {
        return polyContainsPoint(rings, p) ? true : lineContainsPoint(rings, p, radius);
    } else {
        return false;
    }
};
