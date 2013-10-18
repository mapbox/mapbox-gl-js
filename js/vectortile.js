function VectorTile(buffer, end) {
    // Public
    this.layers = {};
    this.faces = {};

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
        } else if (tag == 4) {
            var face = this.readFace();
            this.faces[face.family + ' ' + face.style] = face;
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

VectorTile.prototype.readFace = function() {
    var buffer = this._buffer;
    var face = { glyphs: {} };

    var bytes = buffer.readVarint();
    var val, tag;
    var end = buffer.pos + bytes;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            face.family = buffer.readString();
        } else if (tag == 2) {
            face.style = buffer.readString();
        } else if (tag == 5) {
            var glyph = this.readGlyph();
            face.glyphs[glyph.id] = glyph;
        } else {
            buffer.skip(val);
        }
    }

    return face;
};


VectorTile.prototype.readGlyph = function() {
    var buffer = this._buffer;
    var glyph = {};

    var bytes = buffer.readVarint();
    var val, tag;
    var end = buffer.pos + bytes;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;

        if (tag == 1) {
            glyph.id = buffer.readVarint();
        } else if (tag == 2) {
            glyph.bitmap = buffer.readBuffer();
        } else if (tag == 3) {
            glyph.width = buffer.readVarint();
        } else if (tag == 4) {
            glyph.height = buffer.readVarint();
        } else if (tag == 5) {
            glyph.left = buffer.readSVarint();
        } else if (tag == 6) {
            glyph.top = buffer.readSVarint();
        } else if (tag == 7) {
            glyph.advance = buffer.readVarint();
        } else {
            buffer.skip(val);
        }
    }

    return glyph;
};

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

    for (var i = 0; i < glyphs.length; i++) {
        label.glyphs.push({ face: faces[i], glyph: glyphs[i], x: x[i], y: y[i] });
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

/*
 * Construct a new vector tile feature given a buffer.
 *
 * @param {object} buffer
 * @param {number} [end]
 * @param {extent}
 * @param {object} keys
 * @param {object} values
 */
function VectorTileFeature(buffer, end, extent, keys, values) {
    // Public
    this.extent = extent;
    this.type = 0;

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
            this.type = buffer.readVarint();
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

function VectorTilePoint(x, y) {
    this.x = x;
    this.y = y;
}

VectorTilePoint.prototype.toString = function() {
    return "Point(" + this.x + ", " + this.y + ")";
};

VectorTileFeature.prototype.loadGeometry = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint();
    var end = buffer.pos + bytes;

    var cmd = 1;
    var length = 0;
    var x = 0, y = 0;

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
