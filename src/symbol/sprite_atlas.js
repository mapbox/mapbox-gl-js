'use strict';

const ShelfPack = require('@mapbox/shelf-pack');
const browser = require('../util/browser');
const util = require('../util/util');
const window = require('../util/window');
const Evented = require('../util/evented');

// The SpriteAtlas class is responsible for turning a sprite and assorted
// other images added at runtime into a texture that can be consumed by WebGL.
class SpriteAtlas extends Evented {

    constructor(width, height) {
        super();

        this.width = width;
        this.height = height;

        this.shelfPack = new ShelfPack(width, height);
        this.images = {};
        this.data = false;
        this.texture = 0; // WebGL ID
        this.filter = 0; // WebGL ID
        this.pixelRatio = 1;
        this.dirty = true;
    }

    allocateImage(pixelWidth, pixelHeight) {
        pixelWidth = pixelWidth / this.pixelRatio;
        pixelHeight = pixelHeight / this.pixelRatio;

        // Increase to next number divisible by 4, but at least 1.
        // This is so we can scale down the texture coordinates and pack them
        // into 2 bytes rather than 4 bytes.
        // Pad icons to prevent them from polluting neighbours during linear interpolation
        const padding = 2;
        const packWidth = pixelWidth + padding + (4 - (pixelWidth + padding) % 4);
        const packHeight = pixelHeight + padding + (4 - (pixelHeight + padding) % 4);// + 4;

        const rect = this.shelfPack.packOne(packWidth, packHeight);
        if (!rect) {
            util.warnOnce('SpriteAtlas out of space.');
            return null;
        }

        return rect;
    }

    addImage(name, pixels, options) {
        let width, height, pixelRatio;
        if (pixels instanceof window.HTMLImageElement) {
            width = pixels.width;
            height = pixels.height;
            pixels = browser.getImageData(pixels);
            pixelRatio = this.pixelRatio;
        } else {
            width = options.width;
            height = options.height;
            pixelRatio = options.pixelRatio || this.pixelRatio;
        }

        if (ArrayBuffer.isView(pixels)) {
            pixels = new Uint32Array(pixels.buffer);
        }

        if (!(pixels instanceof Uint32Array)) {
            return this.fire('error', {error: new Error('Image provided in an invalid format. Supported formats are HTMLImageElement, ImageData, and ArrayBufferView.')});
        }

        if (this.images[name]) {
            return this.fire('error', {error: new Error('An image with this name already exists.')});
        }

        const rect = this.allocateImage(width, height);
        if (!rect) {
            return this.fire('error', {error: new Error('There is not enough space to add this image.')});
        }

        const image = {
            rect,
            width: width / pixelRatio,
            height: height / pixelRatio,
            sdf: false,
            pixelRatio: 1
        };
        this.images[name] = image;

        this.copy(pixels, width, rect, {pixelRatio, x: 0, y: 0, width, height}, false);

        this.fire('data', {dataType: 'style'});
    }

    removeImage(name) {
        const image = this.images[name];
        delete this.images[name];

        if (!image) {
            return this.fire('error', {error: new Error('No image with this name exists.')});
        }

        this.shelfPack.unref(image.rect);
        this.fire('data', {dataType: 'style'});
    }

    getImage(name, wrap) {
        if (this.images[name]) {
            return this.images[name];
        }

        if (!this.sprite) {
            return null;
        }

        const pos = this.sprite.getSpritePosition(name);
        if (!pos.width || !pos.height) {
            return null;
        }

        const rect = this.allocateImage(pos.width, pos.height);
        if (!rect) {
            return null;
        }

        const image = {
            rect,
            width: pos.width / pos.pixelRatio,
            height: pos.height / pos.pixelRatio,
            sdf: pos.sdf,
            pixelRatio: pos.pixelRatio / this.pixelRatio
        };
        this.images[name] = image;

        if (!this.sprite.imgData) return null;
        const srcImg = new Uint32Array(this.sprite.imgData.buffer);
        this.copy(srcImg, this.sprite.width, rect, pos, wrap);

        return image;
    }

    // Return position of a repeating fill pattern.
    getPosition(name, repeating) {
        const image = this.getImage(name, repeating);
        const rect = image && image.rect;

        if (!rect) {
            return null;
        }

        const width = image.width * image.pixelRatio;
        const height = image.height * image.pixelRatio;
        const padding = 1;

        return {
            size: [image.width, image.height],
            tl: [(rect.x + padding)         / this.width, (rect.y + padding)          / this.height],
            br: [(rect.x + padding + width) / this.width, (rect.y + padding + height) / this.height]
        };
    }

    allocate() {
        if (!this.data) {
            const w = Math.floor(this.width * this.pixelRatio);
            const h = Math.floor(this.height * this.pixelRatio);
            this.data = new Uint32Array(w * h);
            for (let i = 0; i < this.data.length; i++) {
                this.data[i] = 0;
            }
        }
    }

    // Copy some portion of srcImage into `SpriteAtlas#data`
    copy(srcImg, srcImgWidth, dstPos, srcPos, wrap) {
        this.allocate();
        const dstImg = this.data;

        const padding = 1;

        copyBitmap(
            /* source buffer */  srcImg,
            /* source stride */  srcImgWidth,
            /* source x */       srcPos.x,
            /* source y */       srcPos.y,
            /* dest buffer */    dstImg,
            /* dest stride */    this.width * this.pixelRatio,
            /* dest x */         (dstPos.x + padding) * this.pixelRatio,
            /* dest y */         (dstPos.y + padding) * this.pixelRatio,
            /* icon dimension */ srcPos.width,
            /* icon dimension */ srcPos.height,
            /* wrap */           wrap
        );

        // Indicates that `SpriteAtlas#data` has changed and needs to be
        // reuploaded into the GL texture specified by `SpriteAtlas#texture`.
        this.dirty = true;
    }

    setSprite(sprite) {
        if (sprite) {
            this.pixelRatio = browser.devicePixelRatio > 1 ? 2 : 1;

            if (this.canvas) {
                this.canvas.width = this.width * this.pixelRatio;
                this.canvas.height = this.height * this.pixelRatio;
            }
        }
        this.sprite = sprite;
    }

    addIcons(icons, callback) {
        for (let i = 0; i < icons.length; i++) {
            this.getImage(icons[i]);
        }

        callback(null, this.images);
    }

    bind(gl, linear) {
        let first = false;
        if (!this.texture) {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            first = true;
        } else {
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
        }

        const filterVal = linear ? gl.LINEAR : gl.NEAREST;
        if (filterVal !== this.filter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterVal);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterVal);
            this.filter = filterVal;
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
        }
    }
}

module.exports = SpriteAtlas;

function copyBitmap(src, srcStride, srcX, srcY, dst, dstStride, dstX, dstY, width, height, wrap) {
    let srcI = srcY * srcStride + srcX;
    let dstI = dstY * dstStride + dstX;
    let x, y;

    if (wrap) {
        // add 1 pixel wrapped padding on each side of the image
        dstI -= dstStride;
        for (y = -1; y <= height; y++, dstI += dstStride) {
            srcI = ((y + height) % height + srcY) * srcStride + srcX;
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
