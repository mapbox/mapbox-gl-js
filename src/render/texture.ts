import {Float32Image} from '../util/image';
import assert from 'assert';

import type Context from '../gl/context';
import type {RGBAImage, AlphaImage} from '../util/image';

export type TextureFormat = WebGL2RenderingContext['RGBA8' | 'DEPTH_COMPONENT16' | 'DEPTH24_STENCIL8' | 'R8' | 'R32F'];
export type TextureType = WebGL2RenderingContext['UNSIGNED_BYTE' | 'UNSIGNED_SHORT' | 'UNSIGNED_INT_24_8' | 'FLOAT'];
export type TextureFilter = WebGL2RenderingContext['LINEAR' | 'NEAREST_MIPMAP_NEAREST' | 'LINEAR_MIPMAP_NEAREST' | 'NEAREST_MIPMAP_LINEAR' | 'LINEAR_MIPMAP_LINEAR' | 'NEAREST'];
export type TextureWrap = WebGL2RenderingContext['REPEAT' | 'CLAMP_TO_EDGE' | 'MIRRORED_REPEAT'];

function _getLegacyFormat(format: TextureFormat): number {
    switch (format) {
    case WebGL2RenderingContext['RGBA8']: return WebGL2RenderingContext['RGBA'];
    case WebGL2RenderingContext['DEPTH_COMPONENT16']: return WebGL2RenderingContext['DEPTH_COMPONENT'];
    case WebGL2RenderingContext['DEPTH24_STENCIL8']: return WebGL2RenderingContext['DEPTH_STENCIL'];
    case WebGL2RenderingContext['R8']: return WebGL2RenderingContext['RED'];
    case WebGL2RenderingContext['R32F']: return WebGL2RenderingContext['RED'];
    }
}
function _getType(format: TextureFormat): TextureType {
    switch (format) {
    case WebGL2RenderingContext['RGBA8']: return WebGL2RenderingContext['UNSIGNED_BYTE'];
    case WebGL2RenderingContext['DEPTH_COMPONENT16']: return WebGL2RenderingContext['UNSIGNED_SHORT'];
    case WebGL2RenderingContext['DEPTH24_STENCIL8']: return WebGL2RenderingContext['UNSIGNED_INT_24_8'];
    case WebGL2RenderingContext['R8']: return WebGL2RenderingContext['UNSIGNED_BYTE'];
    case WebGL2RenderingContext['R32F']: return WebGL2RenderingContext['FLOAT'];
    }
}

type EmptyImage = {
    width: number;
    height: number;
    data: null;
};

export type TextureImage = RGBAImage | AlphaImage | Float32Image | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData | EmptyImage | ImageBitmap;

class Texture {
    context: Context;
    size: [number, number];
    texture: WebGLTexture;
    format: TextureFormat;
    minFilter: TextureFilter | null | undefined;
    magFilter: TextureFilter | null | undefined;
    wrapS: TextureWrap | null | undefined;
    wrapT: TextureWrap | null | undefined;
    useMipmap: boolean;

    constructor(context: Context, image: TextureImage, format: TextureFormat, options?: {
        useMipmap?: boolean;
        premultiply?: boolean;
    } | null) {
        this.context = context;
        this.format = format;
        this.useMipmap = options && options.useMipmap;
        this.texture = context.gl.createTexture();
        this.update(image, {premultiply: options && options.premultiply});
    }

    update(image: TextureImage, options?: { premultiply?: boolean; position?: {x: number; y: number;} } | null) {
        const srcWidth = (image && image instanceof HTMLVideoElement && image.width === 0) ? image.videoWidth : image.width;
        const srcHeight = (image && image instanceof HTMLVideoElement && image.height === 0) ? image.videoHeight : image.height;
        const {context} = this;
        const {gl} = context;
        const {x, y} = options && options.position ? options.position : {x: 0, y: 0};

        const width = x + srcWidth;
        const height = y + srcHeight;

        if (this.size && (this.size[0] !== width || this.size[1] !== height)) {
            gl.bindTexture(gl.TEXTURE_2D, null);
            gl.deleteTexture(this.texture);
            this.texture = gl.createTexture();
            this.size = null;
        }
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        context.pixelStoreUnpackFlipY.set(false);
        context.pixelStoreUnpack.set(1);
        context.pixelStoreUnpackPremultiplyAlpha.set(this.format === gl.RGBA8 && (!options || options.premultiply !== false));

        const externalImage = image instanceof HTMLImageElement || image instanceof HTMLCanvasElement || image instanceof HTMLVideoElement || image instanceof ImageData || (ImageBitmap && image instanceof ImageBitmap);
        assert(!externalImage || this.format === gl.R8 || this.format === gl.RGBA8, "Texture format needs to be RGBA8 when using external source");

        if (!this.size && width > 0 && height > 0) {
            // from spec for texStorage2D
            const numLevels = this.useMipmap ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1;
            gl.texStorage2D(gl.TEXTURE_2D, numLevels, this.format, width, height);
            this.size = [width, height];
        }

        if (this.size) {
            if (externalImage) {
                gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, _getLegacyFormat(this.format), _getType(this.format), image);
            } else {
                // @ts-expect-error - TS2339 - Property 'data' does not exist on type 'ImageBitmap | RGBAImage | AlphaImage | Float32Image | EmptyImage'.
                const pixels = image.data;
                if (pixels) {
                    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, srcWidth, srcHeight, _getLegacyFormat(this.format), _getType(this.format), pixels);
                }
            }
        }

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
        this.texture = null;
    }
}

export default Texture;
export class Texture3D {
    context: Context;
    size: [number, number, number];
    texture: WebGLTexture;
    format: TextureFormat;
    minFilter: TextureFilter | null | undefined;
    magFilter: TextureFilter | null | undefined;
    wrapS: TextureWrap | null | undefined;
    wrapT: TextureWrap | null | undefined;

    constructor(context: Context, image: TextureImage, size: [number, number, number], format: TextureFormat) {
        this.context = context;
        this.format = format;
        this.size = size;
        this.texture = (context.gl.createTexture());

        const [width, height, depth] = this.size;
        const {gl} = context;

        gl.bindTexture(gl.TEXTURE_3D, this.texture);

        context.pixelStoreUnpackFlipY.set(false);
        context.pixelStoreUnpack.set(1);
        context.pixelStoreUnpackPremultiplyAlpha.set(false);

        assert(this.format !== gl.R32F || image instanceof Float32Image);
        assert(image.width === (image.height * image.height));
        assert(image.height === height);
        assert(image.width === width * depth);

        // @ts-expect-error - TS2339 - Property 'data' does not exist on type 'TextureImage'.
        gl.texImage3D(gl.TEXTURE_3D, 0, this.format, width, height, depth, 0, _getLegacyFormat(this.format), _getType(this.format), image.data);
    }

    bind(filter: TextureFilter, wrap: TextureWrap) {
        const {context} = this;
        const {gl} = context;
        gl.bindTexture(gl.TEXTURE_3D, this.texture);

        if (filter !== this.minFilter) {
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filter);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filter);
            this.minFilter = filter;
        }

        if (wrap !== this.wrapS) {
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, wrap);
            gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, wrap);
            this.wrapS = wrap;
        }
    }

    destroy() {
        const {gl} = this.context;
        gl.deleteTexture(this.texture);
        this.texture = null;
    }
}

export class UserManagedTexture {
    context: Context;
    texture: WebGLTexture;
    minFilter: TextureFilter | null | undefined;
    wrapS: TextureWrap | null | undefined;

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
