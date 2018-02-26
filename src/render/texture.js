// @flow

import { HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, ImageData } from '../util/window';

import type Context from '../gl/context';
import type {RGBAImage, AlphaImage} from '../util/image';

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
    | EmptyImage;

class Texture {
    context: Context;
    size: Array<number>;
    texture: WebGLTexture;
    format: TextureFormat;
    filter: ?TextureFilter;
    wrap: ?TextureWrap;

    constructor(context: Context, image: TextureImage, format: TextureFormat, premultiply: ?boolean) {
        this.context = context;

        const {width, height} = image;
        this.size = [width, height];
        this.format = format;

        this.texture = context.gl.createTexture();
        this.update(image, premultiply);
    }

    update(image: TextureImage, premultiply: ?boolean) {
        const {width, height} = image;
        this.size = [width, height];

        const {context} = this;
        const {gl} = context;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        context.pixelStoreUnpack.set(1);

        if (this.format === gl.RGBA && premultiply !== false) {
            context.pixelStoreUnpackPremultiplyAlpha.set(true);
        }

        if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData) {
            gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, gl.UNSIGNED_BYTE, image);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, gl.UNSIGNED_BYTE, image.data);
        }
    }

    bind(filter: TextureFilter, wrap: TextureWrap, minFilter: ?TextureFilter) {
        const {context} = this;
        const {gl} = context;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        if (filter !== this.filter) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter || filter);
            this.filter = filter;
        }

        if (wrap !== this.wrap) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
            this.wrap = wrap;
        }
    }

    destroy() {
        const {gl} = this.context;
        gl.deleteTexture(this.texture);
        this.texture = (null: any);
    }
}

export default Texture;
