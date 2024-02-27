// @flow

import type Context from '../gl/context.js';
import type {RGBAImage, AlphaImage} from '../util/image.js';
import {Float32Image} from '../util/image.js';
import assert from 'assert';

export type TextureFormat =
    | $PropertyType<WebGL2RenderingContext, 'RGBA'>
    | $PropertyType<WebGL2RenderingContext, 'DEPTH_COMPONENT'>
    | $PropertyType<WebGL2RenderingContext, 'R8'>
    | $PropertyType<WebGL2RenderingContext, 'R32F'>
    | $PropertyType<WebGL2RenderingContext, 'RED'>;
export type TextureType =
    | $PropertyType<WebGL2RenderingContext, 'UNSIGNED_BYTE'>
    | $PropertyType<WebGL2RenderingContext, 'UNSIGNED_SHORT'>
    | $PropertyType<WebGL2RenderingContext, 'FLOAT'>;
export type TextureFilter =
    | $PropertyType<WebGL2RenderingContext, 'LINEAR'>
    | $PropertyType<WebGL2RenderingContext, 'NEAREST_MIPMAP_NEAREST'>
    | $PropertyType<WebGL2RenderingContext, 'LINEAR_MIPMAP_NEAREST'>
    | $PropertyType<WebGL2RenderingContext, 'NEAREST_MIPMAP_LINEAR'>
    | $PropertyType<WebGL2RenderingContext, 'LINEAR_MIPMAP_LINEAR'>
    | $PropertyType<WebGL2RenderingContext, 'NEAREST'>;
export type TextureWrap =
    | $PropertyType<WebGL2RenderingContext, 'REPEAT'>
    | $PropertyType<WebGL2RenderingContext, 'CLAMP_TO_EDGE'>
    | $PropertyType<WebGL2RenderingContext, 'MIRRORED_REPEAT'>;

type EmptyImage = {
    width: number,
    height: number,
    data: null
}

export type TextureImage =
    | RGBAImage
    | AlphaImage
    | Float32Image
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

    update(image: TextureImage, options: ?{ premultiply?: boolean, useMipmap?: boolean }, position?: { x: number, y: number }) {
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
                let baseFormat = this.format;
                if (this.format === gl.R8) {
                    baseFormat = gl.RED;
                }
                gl.texImage2D(gl.TEXTURE_2D, 0, this.format, baseFormat, gl.UNSIGNED_BYTE, image);
            } else {
                let internalFormat = this.format;
                let format = this.format;
                let type: TextureType = gl.UNSIGNED_BYTE;

                if (this.format === gl.DEPTH_COMPONENT) {
                    // $FlowFixMe[incompatible-type]
                    internalFormat = gl.DEPTH_COMPONENT16;
                    type = gl.UNSIGNED_SHORT;
                }
                if (this.format === gl.R8) {
                    format = gl.RED;
                }
                if (this.format === gl.R32F) {
                    assert(image instanceof Float32Image);
                    type = gl.FLOAT;
                    format = gl.RED;
                }
                // $FlowFixMe prop-missing - Flow can't refine image type here
                gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, image.data);
            }
        } else {
            const {x, y} = position || {x: 0, y: 0};
            if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData || (ImageBitmap && image instanceof ImageBitmap)) {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, image);
            } else {
                let format = this.format;
                let type: TextureType = gl.UNSIGNED_BYTE;

                if (this.format === gl.R32F) {
                    assert(image instanceof Float32Image);

                    format = gl.RED;
                    type = gl.FLOAT;
                }
                // $FlowFixMe prop-missing - Flow can't refine image type here
                gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, format, type, image.data);
            }
        }

        this.useMipmap = Boolean(options && options.useMipmap);
        if (this.useMipmap) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
    }

    bind(filter: TextureFilter, wrap: TextureWrap, ignoreMipMap: boolean = false) {
        const {context} = this;
        const {gl} = context;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (filter !== this.minFilter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
                (this.useMipmap && !ignoreMipMap) ? (filter === gl.NEAREST ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_LINEAR) : filter
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
                this.useMipmap ? (minFilter === gl.NEAREST ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_LINEAR) : minFilter
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

    destroy() {
        const {gl} = this.context;
        gl.deleteTexture(this.texture);
        this.texture = (null: any);
    }
}

export default Texture;
export class UserManagedTexture {
    context: Context;
    texture: WebGLTexture;
    minFilter: ?TextureFilter;
    wrapS: ?TextureWrap;

    constructor(context: Context, texture: WebGLTexture) {
        this.context = context;
        this.texture = texture;
    }

    bind(filter: TextureFilter, wrap: TextureWrap) {
        const {context} = this;
        const {gl} = context;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (filter !== this.minFilter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
            this.minFilter = filter;
        }

        if (wrap !== this.wrapS) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
            this.wrapS = wrap;
        }
    }

}
