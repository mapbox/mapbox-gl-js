'use strict';

/*
 * Create a simpler wrapper around a single arraybuffer with two views,
 * `coords` and `extrude`.
 */
module.exports = Buffer;
function Buffer(buffer) {
    if (!buffer) {
        this.array = new ArrayBuffer(this.defaultLength);
        this.length = this.defaultLength;
        this.coords = new this.defaultType(this.array);
        this.setupViews();
    } else {
        for (var prop in buffer) {
            this[prop] = buffer[prop];
        }
    }
}

Buffer.prototype = {
    pos: 0,
    itemSize: 4,
    defaultLength: 8192,
    defaultType: Int16Array,
    arrayType: 'ARRAY_BUFFER',
    get index() { return this.pos / this.itemSize; },

    setupViews: function() {},

    // binds the buffer to a webgl context
    bind: function(gl) {
        if (!this.buffer) {
            this.buffer = gl.createBuffer();
            gl.bindBuffer(gl[this.arrayType], this.buffer);
            gl.bufferData(gl[this.arrayType], this.array.slice(0, this.pos), gl.STATIC_DRAW);
        } else {
            gl.bindBuffer(gl[this.arrayType], this.buffer);
        }
    },

    // increase the buffer size by at least /required/ bytes.
    resize: function(required) {
        if (this.length < this.pos + required) {
            while (this.length < this.pos + required) this.length += this.defaultLength;
            this.array = new ArrayBuffer(this.length);
            var coords = new this.defaultType(this.array);
            coords.set(this.coords);
            this.coords = coords;
            this.setupViews();
        }
    }
};
