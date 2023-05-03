// @flow

import window from '../util/window.js';

import type Context from '../gl/context.js';
import type {RGBAImage, AlphaImage} from '../util/image.js';

export type TextureFormat =
    | $PropertyType<WebGLRenderingContext, 'RGBA'>
    | $PropertyType<WebGLRenderingContext, 'ALPHA'>
    | $PropertyType<WebGLRenderingContext, 'DEPTH_COMPONENT'>;
export type TextureFilter =
    | $PropertyType<WebGLRenderingContext, 'LINEAR'>
    | $PropertyType<WebGLRenderingContext, 'NEAREST_MIPMAP_NEAREST'>
    | $PropertyType<WebGLRenderingContext, 'LINEAR_MIPMAP_NEAREST'>
    | $PropertyType<WebGLRenderingContext, 'NEAREST_MIPMAP_LINEAR'>
    | $PropertyType<WebGLRenderingContext, 'LINEAR_MIPMAP_LINEAR'>
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
    minFilter: ?TextureFilter;
    magFilter: ?TextureFilter;
    wrapS: ?TextureWrap;
    wrapT: ?TextureWrap;
    useMipmap: boolean;

    constructor(context: Context, image: TextureImage, format: TextureFormat, options: ?{ premultiply?: boolean, useMipmap?: boolean }) {
        this.context = context;
        this.format = format;
        this.texture = ((context.gl.createTexture(): any): WebGLTexture);
        this.update(image, options);
    }

    update(image: TextureImage, options: ?{premultiply?: boolean, useMipmap?: boolean}, position?: { x: number, y: number }) {
        const {width, height} = image;
        const {context} = this;
        const {gl} = context;
        const {HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, ImageData, ImageBitmap} = window;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        context.pixelStoreUnpackFlipY.set(false);
        context.pixelStoreUnpack.set(1);
        context.pixelStoreUnpackPremultiplyAlpha.set(this.format === gl.RGBA && (!options || options.premultiply !== false));

        if (!position && (!this.size || this.size[0] !== width || this.size[1] !== height)) {
            this.size = [width, height];

            if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData || (ImageBitmap && image instanceof ImageBitmap)) {
                let baseFormat = this.format;
                // $FlowFixMe[prop-missing] - Flow cannot check for gl.R8
                if (context.isWebGL2 && this.format === gl.R8) {
                    // $FlowFixMe[prop-missing] - Flow cannot check for gl.RED
                    baseFormat = gl.RED;
                }
                gl.texImage2D(gl.TEXTURE_2D, 0, this.format, baseFormat, gl.UNSIGNED_BYTE, image);
            } else {
                let internalFormat = this.format;
                let type = gl.UNSIGNED_BYTE;

                if (this.format === gl.DEPTH_COMPONENT) {
                    // $FlowFixMe[incompatible-type]
                    internalFormat = gl.DEPTH_COMPONENT16;
                    // $FlowFixMe[incompatible-type]
                    type = gl.UNSIGNED_SHORT;
                }

                // $FlowFixMe prop-missing - Flow can't refine image type here
                gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, this.format, type, image.data);
            }
        } else {
            const {x, y} = position || {x: 0, y: 0};
            if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData || (ImageBitmap && image instanceof ImageBitmap)) {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, image);
            } else {
                // $FlowFixMe prop-missing - Flow can't refine image type here
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

        if (filter !== this.minFilter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
                this.useMipmap ? (filter === gl.NEAREST ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_NEAREST) : filter
            );
            this.minFilter = filter;
        }

        if (wrap !== this.wrapS) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
            this.wrapS = wrap;
        }
    }

    bindExtraParam(minFilter: TextureFilter, magFilter: TextureFilter, wrapS: TextureWrap, wrapT: TextureWrap) {
        const {context} = this;
        const {gl} = context;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (magFilter !== this.magFilter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
            this.magFilter = magFilter;
        }
        if (minFilter !== this.minFilter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
                this.useMipmap ? (minFilter === gl.NEAREST ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_NEAREST) : minFilter
            );
            this.minFilter = minFilter;
        }

        if (wrapS !== this.wrapS) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
            this.wrapS = wrapS;
        }

        if (wrapT !== this.wrapT) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
            this.wrapT = wrapT;
        }
    }

    isSizePowerOfTwo(): boolean {
        return this.size[0] === this.size[1] && (Math.log(this.size[0]) / Math.LN2) % 1 === 0;
    }

    destroy() {
        const {gl} = this.context;
        gl.deleteTexture(this.texture);
        this.texture = (null: any);
    }
}

export default Texture;
