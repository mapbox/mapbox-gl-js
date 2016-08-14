'use strict';

var ShelfPack = require('shelf-pack');
var browser = require('../util/browser');
var util = require('../util/util');

var SIZE_GROWTH_RATE = 2;
var DEFAULT_SIZE = 128;
var MAX_SIZE = 1024;

module.exports = SpriteAtlas;


function SpriteAtlas() {
    this.width = DEFAULT_SIZE;
    this.height = DEFAULT_SIZE;
    this.binpacker = new ShelfPack(this.width, this.height);

    this.images = {};
    this.texture = 0;
    this.pixelRatio = browser.devicePixelRatio > 1 ? 2 : 1;
    this.dirty = true;
    this.sprite = null;
    this.gl = null;

    var w = Math.floor(this.width * this.pixelRatio);
    var h = Math.floor(this.height * this.pixelRatio);
    this.data = new Uint32Array(w * h);
}


function copyBitmap(src, srcStride, srcX, srcY, dst, dstStride, dstX, dstY, width, height, wrap) {
    var srcI = srcY * srcStride + srcX;
    var dstI = dstY * dstStride + dstX;
    var x, y;

    if (wrap) {
        // add 1 pixel wrapped padding on each side of the image
        dstI -= dstStride;
        for (y = -1; y <= height; y++, srcI = ((y + height) % height + srcY) * srcStride + srcX, dstI += dstStride) {
            for (x = -1; x <= width; x++) {
                dst[dstI + x] = src[srcI + ((x + width) % width)];
            }
        }

    } else {
        for (y = 0; y < height; y++, srcI += srcStride, dstI += dstStride) {
            for (x = 0; x < width; x++) {
                dst[dstI + x] = src[srcI + x];
            }
        }
    }
}


SpriteAtlas.prototype.allocateImage = function(pixelWidth, pixelHeight) {
    pixelWidth = pixelWidth / this.pixelRatio;
    pixelHeight = pixelHeight / this.pixelRatio;

    // Increase to next number divisible by 4, but at least 1.
    // This is so we can scale down the texture coordinates and pack them
    // into 2 bytes rather than 4 bytes.
    // Pad icons to prevent them from polluting neighbours during linear interpolation
    var padding = 2;
    var packWidth = pixelWidth + padding + (4 - (pixelWidth + padding) % 4);
    var packHeight = pixelHeight + padding + (4 - (pixelHeight + padding) % 4);// + 4;

    var bin = this.binpacker.packOne(packWidth, packHeight);
    if (!bin) {
        this.resize();
        bin = this.binpacker.packOne(packWidth, packHeight);
    }
    if (!bin) {
        util.warnOnce('SpriteAtlas out of space');
        return null;
    }

    return bin;
};


SpriteAtlas.prototype.getImage = function(name, wrap) {
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

    var bin = this.allocateImage(pos.width, pos.height);
    if (!bin) {
        return null;
    }

    var image = new AtlasImage(bin, pos.width / pos.pixelRatio, pos.height / pos.pixelRatio, pos.sdf, pos.pixelRatio / this.pixelRatio);
    this.images[name] = image;

    this.copy(bin, pos, wrap);
    return image;
};


// Return position of a repeating fill pattern.
SpriteAtlas.prototype.getPosition = function(name, repeating) {
    var image = this.getImage(name, repeating);
    var bin = image && image.bin;

    if (!bin) {
        return null;
    }

    var width = image.width * image.pixelRatio;
    var height = image.height * image.pixelRatio;
    var padding = 1;

    return {
        size: [image.width, image.height],
        tl: [(bin.x + padding)         / this.width, (bin.y + padding)          / this.height],
        br: [(bin.x + padding + width) / this.width, (bin.y + padding + height) / this.height]
    };
};


SpriteAtlas.prototype.copy = function(dst, src, wrap) {
    if (!this.sprite.img.data) return;

    var srcImg = new Uint32Array(this.sprite.img.data.buffer);
    var dstImg = this.data;
    var padding = 1;

    copyBitmap(
        /* source buffer */  srcImg,
        /* source stride */  this.sprite.img.width,
        /* source x */       src.x,
        /* source y */       src.y,
        /* dest buffer */    dstImg,
        /* dest stride */    this.width * this.pixelRatio,
        /* dest x */         (dst.x + padding) * this.pixelRatio,
        /* dest y */         (dst.y + padding) * this.pixelRatio,
        /* icon dimension */ src.width,
        /* icon dimension */ src.height,
        /* wrap */           wrap
    );

    this.dirty = true;
};


SpriteAtlas.prototype.setSprite = function(sprite) {
    if (sprite) {
        this.pixelRatio = browser.devicePixelRatio > 1 ? 2 : 1;

        if (this.canvas) {
            this.canvas.width = this.width * this.pixelRatio;
            this.canvas.height = this.height * this.pixelRatio;
        }
    }
    this.sprite = sprite;
};


SpriteAtlas.prototype.addIcons = function(icons, callback) {
    for (var i = 0; i < icons.length; i++) {
        this.getImage(icons[i]);
    }

    callback(null, this.images);
};


SpriteAtlas.prototype.resize = function() {
    var prevWidth = this.width;
    var prevHeight = this.height;

    if (prevWidth >= MAX_SIZE || prevHeight >= MAX_SIZE) return;

    if (this.texture) {
        if (this.gl) {
            this.gl.deleteTexture(this.texture);
        }
        this.texture = null;
    }

    this.width *= SIZE_GROWTH_RATE;
    this.height *= SIZE_GROWTH_RATE;
    this.binpacker.resize(this.width, this.height);

    var w0 = Math.floor(prevWidth * this.pixelRatio);
    var h0 = Math.floor(prevHeight * this.pixelRatio);
    var w = Math.floor(this.width * this.pixelRatio);
    var h = Math.floor(this.height * this.pixelRatio);
    var buf = new Uint32Array(w * h);

    copyBitmap(
        /* source buffer */  this.data,
        /* source stride */  w0,
        /* source x */       0,
        /* source y */       0,
        /* dest buffer */    buf,
        /* dest stride */    w,
        /* dest x */         0,
        /* dest y */         0,
        /* icon dimension */ w0,
        /* icon dimension */ h0,
        /* wrap */           false
    );

    this.data = buf;
    this.dirty = true;
};


SpriteAtlas.prototype.bind = function(gl, isLinear) {
    this.gl = gl;
    var filterVal = isLinear ? gl.LINEAR : gl.NEAREST;

    if (!this.texture) {
        var w = Math.floor(this.width * this.pixelRatio);
        var h = Math.floor(this.height * this.pixelRatio);
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterVal);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterVal);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(this.data.buffer));
    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterVal);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterVal);
    }
};


SpriteAtlas.prototype.updateTexture = function(gl, isLinear) {
    this.bind(gl, isLinear);
    if (this.dirty) {
        var w = Math.floor(this.width * this.pixelRatio);
        var h = Math.floor(this.height * this.pixelRatio);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(this.data.buffer));
        this.dirty = false;
    }
};


function AtlasImage(bin, width, height, sdf, pixelRatio) {
    this.rect = bin;
    this.width = width;
    this.height = height;
    this.sdf = sdf;
    this.pixelRatio = pixelRatio;
}
