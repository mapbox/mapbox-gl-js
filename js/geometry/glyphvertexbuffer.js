'use strict';

module.exports = GlyphVertexBuffer;
function GlyphVertexBuffer(buffer) {
    if (!buffer) {
        this.pos = 0; // byte index already written
        this.itemSize = 16; // bytes per element
        this.length = 2048 * this.itemSize;
        this.array = new ArrayBuffer(this.length);

        this.coords = new Int16Array(this.array);
        this.offset = new Int16Array(this.array);
        this.texture = new Uint8Array(this.array);
        this.zoom = new Uint8Array(this.array);
        this.angle = new Uint8Array(this.array);
    } else {
        for (var prop in buffer) {
            this[prop] = buffer[prop];
        }
    }
}

GlyphVertexBuffer.prototype = {
    get index() {
        return this.pos / this.itemSize;
    }
};

GlyphVertexBuffer.prototype.bind = function(gl) {
    if (!this.buffer) {
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.array.slice(0, this.pos), gl.STATIC_DRAW);
    } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    }
};

// increase the buffer size by at least /required/ bytes.
GlyphVertexBuffer.prototype.resize = function(required) {
    if (this.length < this.pos + required) {
        while (this.length < this.pos + required) this.length += 2048 * this.itemSize;
        this.array = new ArrayBuffer(this.length);
        var coords = new Int16Array(this.array);
        coords.set(this.coords);
        this.coords = coords;
        this.offset = new Int16Array(this.array);
        this.texture = new Uint8Array(this.array);
        this.zoom = new Uint8Array(this.array);
        this.angle = new Uint8Array(this.array);
    }
};

// Converts the 0..2pi to an int16 range
GlyphVertexBuffer.angleFactor = 128 / Math.PI;

GlyphVertexBuffer.prototype.add = function(x, y, ox, oy, tx, ty, angle, minzoom, range, maxzoom, labelminzoom) {
    var pos = this.pos,
        halfPos = pos / 2,
        angleFactor = GlyphVertexBuffer.angleFactor;

    this.resize(this.itemSize);

    this.coords[halfPos + 0] = x;
    this.coords[halfPos + 1] = y;
    this.offset[halfPos + 2] = Math.round(ox * 64); // use 1/64 pixels for placement
    this.offset[halfPos + 3] = Math.round(oy * 64);
    this.texture[pos + 8] = Math.floor(tx / 4);
    this.texture[pos + 9] = Math.floor(ty / 4);
    this.zoom[pos + 10] = Math.floor((labelminzoom || 0) * 10);
    this.zoom[pos + 11] = Math.floor((minzoom || 0) * 10); // 1/10 zoom levels: z16 == 160.
    this.zoom[pos + 12] = Math.floor(Math.min(maxzoom || 25, 25) * 10); // 1/10 zoom levels: z16 == 160.
    this.angle[pos + 13] = Math.round(angle * angleFactor) % 256;
    this.angle[pos + 14] = Math.round(range[0] * angleFactor) % 256;
    this.angle[pos + 15] = Math.round(range[1] * angleFactor) % 256;

    this.pos += this.itemSize;
};
