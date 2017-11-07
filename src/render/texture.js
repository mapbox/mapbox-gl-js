// @flow

const {HTMLImageElement, HTMLCanvasElement, HTMLVideoElement, ImageData} = require('../util/window');

import type {RGBAImage, AlphaImage} from '../util/image';
import type {ImageTextureSource} from '../source/image_source';

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

export type TextureImage =
    | RGBAImage
    | AlphaImage
    | ImageTextureSource;

class Texture {
    gl: WebGLRenderingContext;
    size: Array<number>;
    texture: WebGLTexture;
    format: TextureFormat;
    filter: ?TextureFilter;
    wrap: ?TextureWrap;

    constructor(gl: WebGLRenderingContext, image: TextureImage, format: TextureFormat) {
        this.gl = gl;

        const {width, height} = image;
        this.size = [width, height];
        this.format = format;

        this.texture = gl.createTexture();
        this.update(image);
    }

    update(image: TextureImage) {
        const {width, height} = image;
        this.size = [width, height];

        const {gl} = this;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        if (this.format === gl.RGBA) {
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, (true: any));
        }

        if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData) {
            gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, gl.UNSIGNED_BYTE, image);
        } else {
            gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, gl.UNSIGNED_BYTE, image.data);
        }
    }

    bind(filter: TextureFilter, wrap: TextureWrap, minFilter: ?TextureFilter) {
        const {gl} = this;
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
        const {gl} = this;
        gl.deleteTexture(this.texture);
        this.texture = (null: any);
    }
}

module.exports = Texture;
