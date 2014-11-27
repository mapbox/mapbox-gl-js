'use strict';

var BinPack = require('./bin_pack');

module.exports = SpriteAtlas;
function SpriteAtlas(width, height) {
    this.width = width;
    this.height = height;

    this.bin = new BinPack(width, height);
    this.images = {};
    this.data = false;
    this.texture = 0; // WebGL ID
    this.filter = 0; // WebGL ID
    this.buffer = 1; // const
    this.pixelRatio = 1;
    this.dirty = true;
}

SpriteAtlas.prototype = {
    get debug() {
        return 'canvas' in this;
    },
    set debug(value) {
        if (value && !this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = this.width * this.pixelRatio;
            this.canvas.height = this.height * this.pixelRatio;
            this.canvas.style.width = this.width + 'px';
            this.canvas.style.width = this.width + 'px';
            document.body.appendChild(this.canvas);
            this.ctx = this.canvas.getContext('2d');
        } else if (!value && this.canvas) {
            this.canvas.parentNode.removeChild(this.canvas);
            delete this.ctx;
            delete this.canvas;
        }
    }
};

SpriteAtlas.prototype.resize = function(newRatio) {
    if (this.pixelRatio == newRatio) return false;

    var oldRatio = this.pixelRatio;
    this.pixelRatio = newRatio;

    if (this.canvas) {
        this.canvas.width = this.width * this.pixelRatio;
        this.canvas.height = this.height * this.pixelRatio;
    }

    if (this.data) {
        var old_data = this.data;

        this.data = false;
        this.allocate();

        var oldWidth = this.width * oldRatio;
        var oldHeight = this.height * oldRatio;
        var newWidth = this.width * newRatio;
        var newHeight = this.height * newRatio;

        // Basic image scaling. TODO: Replace this with better image scaling.
        var newImage = this.data;
        var oldImage = old_data;

        for (var y = 0; y < newHeight; y++) {
            var old_yoffset = Math.floor((y * oldHeight) / newHeight) * oldWidth;
            var new_yoffset = y * newWidth;
            for (var x = 0; x < newWidth; x++) {
                var old_x = Math.floor((x * oldWidth) / newWidth);
                newImage[new_yoffset + x] = oldImage[old_yoffset + old_x];
            }
        }

        old_data = null;
        this.dirty = true;
    }

    return this.dirty;
};

SpriteAtlas.prototype.allocateImage = function(pixel_width, pixel_height) {
    var pack_width = pixel_width + this.buffer * 2;
    var pack_height = pixel_height + this.buffer * 2;

    // Increase to next number divisible by 4, but at least 1.
    // This is so we can scale down the texture coordinates and pack them
    // into 2 bytes rather than 4 bytes.
    pack_width += (4 - pack_width % 4);
    pack_height += (4 - pack_height % 4);

    // We have to allocate a new area in the bin, and store an empty image in it.
    // Add a 1px border around every image.
    var rect = this.bin.allocate(pack_width, pack_height);
    if (rect.w === 0) {
        return rect;
    }

    rect.x += this.buffer;
    rect.y += this.buffer;
    rect.w = pixel_width;
    rect.h = pixel_height;

    return rect;
};

SpriteAtlas.prototype.getImage = function(name) {
    if (this.images[name]) {
        return this.images[name];
    }

    if (!this.sprite) {
        return null;
    }

    var pos = this.sprite.getSpritePosition(name);
    if (!pos.width || !pos.height) {
        return null;
    }

    var rect = this.allocateImage(pos.width / pos.pixelRatio, pos.height / pos.pixelRatio);
    if (rect.w === 0) {
        return rect;
    }

    rect.sdf = pos.sdf;
    this.images[name] = rect;

    this.copy(rect, pos);

    return rect;
};


SpriteAtlas.prototype.allocate = function() {
    if (!this.data) {
        var w = Math.floor(this.width * this.pixelRatio);
        var h = Math.floor(this.height * this.pixelRatio);
        this.data = new Uint32Array(w * h);
        for (var i = 0; i < this.data.length; i++) {
            this.data[i] = 0;
        }
    }
};

function copy_bitmap(src, src_stride, src_x, src_y, dst, dst_stride, dst_x, dst_y, width, height) {
    var src_i = src_y * src_stride + src_x;
    var dst_i = dst_y * dst_stride + dst_x;
    for (var y = 0; y < height; y++, src_i += src_stride, dst_i += dst_stride) {
        for (var x = 0; x < width; x++) {
            dst[dst_i + x] = src[src_i + x];
        }
    }
}


SpriteAtlas.prototype.copy = function(dst, src) {
    // if (!sprite->raster) return;
    var src_img = new Uint32Array(this.sprite.img.data.buffer);
    // if (!src_img) return;

    this.allocate();
    var dst_img = this.data;

    copy_bitmap(
        /* source buffer */  src_img,
        /* source stride */  this.sprite.img.width,
        /* source x */       src.x,
        /* source y */       src.y,
        /* dest buffer */    dst_img,
        /* dest stride */    this.width * this.pixelRatio,
        /* dest x */         dst.x * this.pixelRatio,
        /* dest y */         dst.y * this.pixelRatio,
        /* icon dimension */ src.width,
        /* icon dimension */ src.height
    );

    this.dirty = true;
};

SpriteAtlas.prototype.setSprite = function(sprite) {
    this.sprite = sprite;
};

SpriteAtlas.prototype.addIcons = function(icons, callback) {
    for (var i = 0; i < icons.length; i++) {
        this.getImage(icons[i]);
    }

    callback(null, this.images);
};

SpriteAtlas.prototype.bind = function(gl, linear) {
    var first = false;
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        first = true;
    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }

    var filter_val = linear ? gl.LINEAR : gl.NEAREST;
    if (filter_val != this.filter) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter_val);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter_val);
        this.filter = filter_val;
    }

    if (this.dirty) {
        this.allocate();

        if (first) {
            gl.texImage2D(
                gl.TEXTURE_2D, // enum target
                0, // ind level
                gl.RGBA, // ind internalformat
                this.width * this.pixelRatio, // GLsizei width
                this.height * this.pixelRatio, // GLsizei height
                0, // ind border
                gl.RGBA, // enum format
                gl.UNSIGNED_BYTE, // enum type
                new Uint8Array(this.data.buffer) // Object data
            );
        } else {
            gl.texSubImage2D(
                gl.TEXTURE_2D, // enum target
                0, // int level
                0, // int xoffset
                0, // int yoffset
                this.width * this.pixelRatio, // long width
                this.height * this.pixelRatio, // long height
                gl.RGBA, // enum format
                gl.UNSIGNED_BYTE, // enum type
                new Uint8Array(this.data.buffer) // Object pixels
            );
        }

        this.dirty = false;

        // DEBUG
        if (this.ctx) {
            var data = this.ctx.getImageData(0, 0, this.width * this.pixelRatio, this.height * this.pixelRatio);
            data.data.set(new Uint8ClampedArray(this.data.buffer));
            this.ctx.putImageData(data, 0, 0);

            this.ctx.strokeStyle = 'red';
            for (var k = 0; k < this.bin.free.length; k++) {
                var free = this.bin.free[k];
                this.ctx.strokeRect(free.x * this.pixelRatio, free.y * this.pixelRatio, free.w * this.pixelRatio, free.h * this.pixelRatio);
            }
        }
        // END DEBUG
    }
};
