function VectorTileFeature(buffer, end, extent, keys, values) {
    this._buffer = buffer;
    this._type = 0;
    this._geometry = -1;
    this._triangulation = -1;
    this.extent = extent;

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
        } else if (tag == 4) {
            this._geometry = buffer.pos;
            buffer.skip(val);
        } else if (tag == 5) {
            this._triangulation = buffer.pos;
            buffer.skip(val);
        } else if (tag == 6) {
            this.vertex_count = buffer.readVarint();
        } else {
            buffer.skip(val);
        }
    }
}

VectorTileFeature.readValue = function(buffer) {
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
}

VectorTileFeature.prototype.geometry = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;
    return buffer.readASMSubarray();
};

VectorTileFeature.prototype.draw = function(context, size) {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var scale = size / this.extent;

    var bytes = buffer.readVarint();
    var end = buffer.pos + bytes;

    var cmd = 1;
    var length = 0;
    var x = 0, y = 0;
    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd != 7) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();

            if (cmd == 1) {
                context.moveTo(x * scale, y * scale);
            } else {
                context.lineTo(x * scale, y * scale);
            }
        } else {
            context.closePath();
        }
    }
};

VectorTileFeature.prototype.coordinates = function() {
    var buffer = this._buffer;
    buffer.pos = this._geometry;

    var bytes = buffer.readVarint();
    var end = buffer.pos + bytes;

    var coordinates = [];

    var cmd = 1;
    var length = 0;
    var x = 0, y = 0;
    while (buffer.pos < end) {
        if (!length) {
            var cmd_length = buffer.readVarint();
            cmd = cmd_length & 0x7;
            length = cmd_length >> 3;
        }

        length--;

        if (cmd != 7) {
            x += buffer.readSVarint();
            y += buffer.readSVarint();
            coordinates.push({ x: x, y: y });
        }
    }

    return coordinates;
};


function realloc(buffer, size) {
    if (!size) size = (buffer.length + 1024) * 2;
    var newBuffer = new buffer.constructor(size);
    newBuffer.set(buffer);
    newBuffer.pos = buffer.pos;
    newBuffer.idx = buffer.idx;
    return newBuffer;
}

VectorTileFeature.prototype.drawNative = function(geometry) {
    var buffer = this._buffer;

    buffer.pos = this._geometry;

    var bytes = buffer.readVarint();
    var end = buffer.pos + bytes;

    var cmd = 1;
    var length = 0;
    var x = 0, y = 0;


    var vertices = geometry.vertices;
    var line = geometry.lineElements;
    var fill = geometry.fillElements;

    var start = vertices.pos / 2;
    var begin = 0;
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

            if (vertices.pos + 2 >= vertices.length) vertices = realloc(vertices);
            vertices[vertices.pos++] = x;
            vertices[vertices.pos++] = y;

            if (cmd == 1) {
                // moveTo
                if (line.pos + 2 >= line.length) line = realloc(line);
                line[line.pos++] = 0;
                line[line.pos++] = vertices.idx;
                begin = vertices.idx;
            } else {
                // lineTo
                if (line.pos + 1 >= line.length) line = realloc(line);
                line[line.pos++] = vertices.idx;
            }

            vertices.idx++;
            if (vertices.idx >= 65536) return;
        } else if (cmd == 7) {
            // closePolygon
            if (line.pos + 2 >= line.length) line = realloc(line);
            line[line.pos++] = begin;
        } else {
            throw new Error('unknown command ' + cmd);
        }
    }

    if (this._triangulation >= 0) {
        buffer.pos = this._triangulation;

        // Duplicate the last coordinate
        if (fill.pos) {
            if (fill.pos + 1 >= fill.length) fill = realloc(fill);
            fill[fill.pos++] = fill[fill.pos - 1];
        }

        bytes = buffer.readVarint();
        end = buffer.pos + bytes;
        var prev = 0;
        while (buffer.pos < end) {
            var index = buffer.readSVarint();
            if (fill.pos + 1 >= fill.length) fill = realloc(fill);
            fill[fill.pos++] = start + index + prev;
            prev += index;
        }
    }

    geometry.vertices = vertices;
    geometry.lineElements = line;
    geometry.fillElements = fill;
};

function VectorTileLayer(buffer, end) {
    this._buffer = buffer;

    this.version = 1;
    this.name = null;
    this.extent = 4096;
    this.length = 0;

    this._keys = [];
    this._values = [];
    this._features = [];

    if (typeof end === 'undefined') {
        end = buffer.length;
    }

    var val, tag;
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
            this._values.push(VectorTileFeature.readValue(buffer));
        } else if (tag == 6) {
            this.vertex_count = buffer.readVarint();
        } else {
            console.warn('skipping', tag);
            buffer.skip(val);
        }
    }
}



VectorTileLayer.prototype.feature = function(i) {
    if (i < 0 || i >= this._features.length) {
        throw new Error('feature index out of bounds');
    }

    this._buffer.pos = this._features[i];
    var end = this._buffer.readVarint() + this._buffer.pos;
    return new VectorTileFeature(this._buffer, end, this.extent, this._keys, this._values);
};

function VectorTile(buffer, end) {
    this._buffer = buffer;
    this.layers = {};

    if (typeof end === 'undefined') {
        end = buffer.length;
    }

    var val, tag;
    while (buffer.pos < end) {
        val = buffer.readVarint();
        tag = val >> 3;
        if (tag == 3) {
            var layer_bytes = buffer.readVarint();
            var layer_end = buffer.pos + layer_bytes;
            var layer = new VectorTileLayer(buffer, layer_end);
            if (layer.length) {
                this.layers[layer.name] = layer;
            }
            buffer.pos = layer_end;
        } else {
            buffer.skip(val);
        }
    }
}

VectorTile.prototype.layer = function(name) {
    if (this.layers[name]) {
        return this.layers[name].list();
    } else {
        return VectorFeatureList.empty;
    }
};

function VectorFeatureList(features) {
    this.list = _(features || []);
}

VectorFeatureList.prototype = {
    get length() {
        return this.list.size();
    },

    add: function(feature) {
        this.list.push(feature);
    },

    filter: function(fn) {
        return new VectorFeatureList(this.list.filter(fn));
    },

    where: function(props) {
        return new VectorFeatureList(this.list.wh(props));
    },

    each: function(fn) {
        this.list.each(fn);
    }
};

VectorFeatureList.empty = new VectorFeatureList([]);

