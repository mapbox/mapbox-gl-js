// @flow

import window from '../util/window.js';
const {HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, ImageData, ImageBitmap} = window;

import type Context from '../gl/context.js';
import type {RGBAImage, AlphaImage} from '../util/image.js';

export type TextureFormat =
    | $PropertyType<WebGLRenderingContext, 'RGBA'>
    | $PropertyType<WebGLRenderingContext, 'ALPHA'>;
export type TextureFilter =
    | $PropertyType<WebGLRenderingContext, 'LINEAR'>
    | $PropertyType<WebGLRenderingContext, 'LINEAR_MIPMAP_NEAREST'>
    | $PropertyType<WebGLRenderingContext, 'NEAREST'>;
export type TextureWrap =
    | $PropertyType<WebGLRenderingContext, 'REPEAT'>
    | $PropertyType<WebGLRenderingContext, 'CLAMP_TO_EDGE'>
    | $PropertyType<WebGLRenderingContext, 'MIRRORED_REPEAT'>;

type EmptyImage = {
    width: number,
    height: number,
    data: null
}

export type TextureImage =
    | RGBAImage
    | AlphaImage
    | HTMLImageElement
    | HTMLCanvasElement
    | HTMLVideoElement
    | ImageData
    | EmptyImage
    | ImageBitmap;

class Texture {
    context: Context;
    size: [number, number];
    texture: WebGLTexture;
    format: TextureFormat;
    filter: ?TextureFilter;
    wrap: ?TextureWrap;
    useMipmap: boolean;

    constructor(context: Context, image: TextureImage, format: TextureFormat, options: ?{ premultiply?: boolean, useMipmap?: boolean }) {
        this.context = context;
        this.format = format;
        this.texture = context.gl.createTexture();
        this.update(image, options);
    }

    update(image: TextureImage, options: ?{premultiply?: boolean, useMipmap?: boolean}, position?: { x: number, y: number }) {
        const {width, height} = image;
        const {context} = this;
        const {gl} = context;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        context.pixelStoreUnpackFlipY.set(false);
        context.pixelStoreUnpack.set(1);
        context.pixelStoreUnpackPremultiplyAlpha.set(this.format === gl.RGBA && (!options || options.premultiply !== false));

        if (!position && (!this.size || this.size[0] !== width || this.size[1] !== height)) {
            this.size = [width, height];

            if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData || (ImageBitmap && image instanceof ImageBitmap)) {
                gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, gl.UNSIGNED_BYTE, image);
            } else {
                gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, gl.UNSIGNED_BYTE, image.data);
            }

        } else {
            const {x, y} = position || {x: 0, y: 0};
            if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData || (ImageBitmap && image instanceof ImageBitmap)) {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, image);
            } else {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
            }
        }

        this.useMipmap = Boolean(options && options.useMipmap && this.isSizePowerOfTwo());
        if (this.useMipmap) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
    }

    bind(filter: TextureFilter, wrap: TextureWrap) {
        const {context} = this;
        const {gl} = context;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (filter !== this.filter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
                this.useMipmap ? (filter === gl.NEAREST ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_NEAREST) : filter
            );
            this.filter = filter;
        }

        if (wrap !== this.wrap) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
            this.wrap = wrap;
        }
    }

    isSizePowerOfTwo() {
        return this.size[0] === this.size[1] && (Math.log(this.size[0]) / Math.LN2) % 1 === 0;
    }

    destroy() {
        const {gl} = this.context;
        gl.deleteTexture(this.texture);
        this.texture = (null: any);
    }
}

export default Texture;
