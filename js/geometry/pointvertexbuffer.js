'use strict';

module.exports = PointVertexBuffer;
function PointVertexBuffer(buffer) {
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

PointVertexBuffer.prototype = {
    get index() {
        return this.pos / this.itemSize;
    }
};

PointVertexBuffer.prototype.bind = function(gl) {
    if (!this.buffer) {
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.array.slice(0, this.pos), gl.STATIC_DRAW);
    } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    }
};

// increase the buffer size by at least /required/ bytes.
PointVertexBuffer.prototype.resize = function(required) {
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
PointVertexBuffer.angleFactor = 128 / Math.PI;

PointVertexBuffer.prototype.add = function(x, y, angle, pointminzoom, angleRange) {
    this.resize(this.itemSize);
    this.coords[this.pos / 2 + 0] = x;
    this.coords[this.pos / 2 + 1] = y;
    /*
    this.offset[this.pos / 2 + 2] = Math.round(ox * 64); // use 1/64 pixels for placement
    this.offset[this.pos / 2 + 3] = Math.round(oy * 64);
    this.texture[this.pos + 8] = Math.floor(tx / 4);
    this.texture[this.pos + 9] = Math.floor(ty / 4);
    */
    angle = (angle + Math.PI * 2) % (Math.PI * 2);
    this.zoom[this.pos + 10] = Math.floor((pointminzoom || 0) * 10);
    this.angle[this.pos + 13] = Math.floor(angle * PointVertexBuffer.angleFactor) % 256;
    this.angle[this.pos + 14] = Math.floor(angleRange[0] * PointVertexBuffer.angleFactor) % 256;
    this.angle[this.pos + 15] = Math.floor(angleRange[1] * PointVertexBuffer.angleFactor) % 256;
    this.pos += this.itemSize;
};
