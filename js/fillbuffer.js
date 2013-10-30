module.exports = FillBuffer;
function FillBuffer(fillBuffer) {

    if (!fillBuffer) {
        this.array = new ArrayBuffer(8192);
        this.length = 8192;
        this.pos = 0; // byte index already written
        this.itemSize = 6; // bytes per triangle (3 * unsigned short == 6 bytes)

        this.triangles = new Uint16Array(this.array);

    } else {
        for (var prop in fillBuffer) {
            this[prop] = fillBuffer[prop];
        }
    }
}

FillBuffer.prototype = {
    get index() {
        return this.pos / this.itemSize;
    }
};

FillBuffer.prototype.bind = function(gl) {
    if (!this.buffer) {
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.array.slice(0, this.pos), gl.STATIC_DRAW);
    } else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
    }
};

// increase the buffer size by at least /required/ bytes.
FillBuffer.prototype.resize = function(required) {
    if (this.length < this.pos + required) {
        while (this.length < this.pos + required) this.length += 8192;
        this.array = new ArrayBuffer(this.length);
        var triangles = new Uint16Array(this.array);
        triangles.set(this.triangles);
        this.triangles = triangles;
    }
};

FillBuffer.prototype.add = function(a, b, c) {
    this.resize(this.itemSize);
    this.triangles[this.pos / 2 + 0] = a;
    this.triangles[this.pos / 2 + 1] = b;
    this.triangles[this.pos / 2 + 2] = c;
    this.pos += this.itemSize;
};

FillBuffer.prototype.addDegenerate = function() {
    this.add(16383, 16383, 0, 0, 1, 1);
};
