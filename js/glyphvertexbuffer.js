function GlyphVertexBuffer(buffer) {
    if (!buffer) {
        this.pos = 0; // byte index already written
        this.itemSize = 16; // bytes per element
        this.length = 2048 * this.itemSize;
        this.array = new ArrayBuffer(this.length);

        this.coords = new Int16Array(this.array);
        this.offset = new Int16Array(this.array);
        this.texture = new Uint16Array(this.array);
        this.angle = new Float32Array(this.array);
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
        this.texture = new Uint16Array(this.array);
        this.angle = new Float32Array(this.array);
    }
};

GlyphVertexBuffer.prototype.add = function(x, y, ox, oy, tx, ty, angle) {
    this.resize(this.itemSize);
    this.coords[this.pos / 2 + 0] = x;
    this.coords[this.pos / 2 + 1] = y;
    this.offset[this.pos / 2 + 2] = Math.round(ox * 64); // use 1/64 pixels for placement
    this.offset[this.pos / 2 + 3] = Math.round(oy * 64);
    this.texture[this.pos / 2 + 4] = Math.floor(tx / 4);
    this.texture[this.pos / 2 + 5] = Math.floor(ty / 4);
    this.angle[this.pos / 4 + 3] = angle;
    this.pos += this.itemSize;
};
