
const ShelfPack = require('@mapbox/shelf-pack');
const browser = require('../util/browser');
const util = require('../util/util');
const window = require('../util/window');
const Evented = require('../util/evented');
const padding = 1;

// This wants to be a class, but is sent to workers, so must be a plain JSON blob.
function spriteAtlasElement(image) {
    const textureRect = {
        x: image.rect.x + padding,
        y: image.rect.y + padding,
        w: image.rect.w - padding * 2,
        h: image.rect.h - padding * 2
    };
    return {
        sdf: image.sdf,
        pixelRatio: image.pixelRatio,
        isNativePixelRatio: image.pixelRatio === browser.devicePixelRatio,
        textureRect: textureRect,

        // Redundant calculated members.
        tl: [
            textureRect.x,
            textureRect.y
        ],
        br: [
            textureRect.x + textureRect.w,
            textureRect.y + textureRect.h
        ],
        displaySize: [
            textureRect.w / image.pixelRatio,
            textureRect.h / image.pixelRatio
        ]
    };
}

// The SpriteAtlas class is responsible for turning a sprite and assorted
// other images added at runtime into a texture that can be consumed by WebGL.
class SpriteAtlas extends Evented {

    constructor(width, height) {
        super();
        this.images = {};
        this.data = false;
        this.texture = 0; // WebGL ID
        this.filter = 0; // WebGL ID
        this.width = Math.ceil(width * browser.devicePixelRatio);
        this.height = Math.ceil(height * browser.devicePixelRatio);
        this.shelfPack = new ShelfPack(this.width, this.height);
        this.dirty = true;
    }

    getPixelSize() {
        return [
            this.width,
            this.height
        ];
    }

    allocateImage(pixelWidth, pixelHeight) {
        const width = pixelWidth + 2 * padding;
        const height = pixelHeight + 2 * padding;

        const rect = this.shelfPack.packOne(width, height);
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
            pixelRatio = 1;
        } else {
            width = options.width;
            height = options.height;
            pixelRatio = options.pixelRatio || 1;
        }

        if (ArrayBuffer.isView(pixels)) {
            pixels = new Uint32Array(pixels.buffer);
        }

        if (!(pixels instanceof Uint32Array)) {
            return this.fire('error', {error: new Error('Image provided in an invalid format. Supported formats are HTMLImageElement and ArrayBufferView.')});
        }

        if (this.images[name]) {
            return this.fire('error', {error: new Error('An image with this name already exists.')});
        }

        const rect = this.allocateImage(width, height);
        if (!rect) {
            return this.fire('error', {error: new Error('There is not enough space to add this image.')});
        }

        this.images[name] = {
            rect,
            width,
            height,
            pixelRatio,
            sdf: false
        };

        this.copy(pixels, width, rect, {x: 0, y: 0, width, height}, false);

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

    // Return metrics for an icon image.
    getIcon(name) {
        return this._getImage(name, false);
    }

    // Return metrics for repeating pattern image.
    getPattern(name) {
        return this._getImage(name, true);
    }

    _getImage(name, wrap) {
        if (this.images[name]) {
            return spriteAtlasElement(this.images[name]);
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
            width: pos.width,
            height: pos.height,
            sdf: pos.sdf,
            pixelRatio: pos.pixelRatio
        };
        this.images[name] = image;

        if (!this.sprite.imgData) return null;
        const srcImg = new Uint32Array(this.sprite.imgData.buffer);
        this.copy(srcImg, this.sprite.width, rect, pos, wrap);

        return spriteAtlasElement(image);
    }

    allocate() {
        if (!this.data) {
            this.data = new Uint32Array(this.width * this.height);
            for (let i = 0; i < this.data.length; i++) {
                this.data[i] = 0;
            }
        }
    }

    // Copy some portion of srcImage into `SpriteAtlas#data`
    copy(srcImg, srcImgWidth, dstPos, srcPos, wrap) {
        this.allocate();
        const dstImg = this.data;

        copyBitmap(
            /* source buffer */  srcImg,
            /* source stride */  srcImgWidth,
            /* source x */       srcPos.x,
            /* source y */       srcPos.y,
            /* dest buffer */    dstImg,
            /* dest stride */    this.getPixelSize()[0],
            /* dest x */         dstPos.x + padding,
            /* dest y */         dstPos.y + padding,
            /* icon dimension */ srcPos.width,
            /* icon dimension */ srcPos.height,
            /* wrap */           wrap
        );

        // Indicates that `SpriteAtlas#data` has changed and needs to be
        // reuploaded into the GL texture specified by `SpriteAtlas#texture`.
        this.dirty = true;
    }

    setSprite(sprite) {
        if (sprite && this.canvas) {
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        }
        this.sprite = sprite;
    }

    addIcons(icons, callback) {
        const result = {};
        for (const icon of icons) {
            result[icon] = this.getIcon(icon);
        }
        callback(null, result);
    }

    bind(gl, linear) {
        let first = false;
        if (!this.texture) {
            this.texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
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
                    this.width, // GLsizei width
                    this.height, // GLsizei height
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
                    this.width, // long width
                    this.height, // long height
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
