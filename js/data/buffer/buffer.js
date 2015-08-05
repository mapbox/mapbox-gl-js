'use strict';

// a simple wrapper around a single arraybuffer

module.exports = Buffer;

function Buffer(buffer) {
    if (!buffer) {
        this.array = new ArrayBuffer(this.defaultLength);
        this.length = this.defaultLength;
        this.setupViews();

    } else {
        // we only recreate buffers after receiving them from workers for binding to gl,
        // so we only need these 2 properties
        this.array = buffer.array;
        this.pos = buffer.pos;
    }
}

Buffer.prototype = {
    pos: 0,
    itemSize: 4, // bytes in one item
    defaultLength: 8192, // initial buffer size
    arrayType: 'ARRAY_BUFFER', // gl buffer type

    get index() {
        return this.pos / this.itemSize;
    },

    setupViews: function() {
        // set up views for each type to add data of different types to the same buffer
        this.ubytes = new Uint8Array(this.array);
        this.bytes = new Int8Array(this.array);
        this.ushorts = new Uint16Array(this.array);
        this.shorts = new Int16Array(this.array);
    },

    // binds the buffer to a webgl context
    bind: function(gl) {
        var type = gl[this.arrayType];
        if (!this.buffer) {
            this.buffer = gl.createBuffer();
            gl.bindBuffer(type, this.buffer);
            gl.bufferData(type, this.array.slice(0, this.pos), gl.STATIC_DRAW);

            // dump array buffer once it's bound to gl
            this.array = null;
        } else {
            gl.bindBuffer(type, this.buffer);
        }
    },

    destroy: function(gl) {
        if (this.buffer) {
            gl.deleteBuffer(this.buffer);
        }
    },

    // increase the buffer size by 50% if a new item doesn't fit
    resize: function() {
        if (this.length < this.pos + this.itemSize) {

            while (this.length < this.pos + this.itemSize) {
                // increase the length by 50% but keep it even
                this.length = Math.round(this.length * 1.5 / 2) * 2;
            }

            // array buffers can't be resized, so we create a new one and reset all bytes there
            this.array = new ArrayBuffer(this.length);

            var ubytes = new Uint8Array(this.array);
            ubytes.set(this.ubytes);

            this.setupViews();
        }
    }
};
