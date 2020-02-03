// @flow

import type {RGBAImage} from '../util/image';
import type {TextureImage, TextureFormat} from './texture';

class TextureCubemap {
    context: Context;
    size: [number, number];
    cubemap: WebGLTexture;
    format: TextureFormat;

    constructor(context: Context, faces: [ImageBitmap], format: TextureFormat) {
        const {gl} = context;

        this.context = context;
        this.format = format;
        this.texture = context.gl.createTexture();
        
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.texture);

        context.pixelStoreUnpackFlipY.set(false);
        context.pixelStoreUnpack.set(1);
        context.pixelStoreUnpackPremultiplyAlpha.set(false);

        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, this.format, this.format, gl.UNSIGNED_BYTE, faces[0]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, this.format, this.format, gl.UNSIGNED_BYTE, faces[1]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, this.format, this.format, gl.UNSIGNED_BYTE, faces[2]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, this.format, this.format, gl.UNSIGNED_BYTE, faces[3]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, this.format, this.format, gl.UNSIGNED_BYTE, faces[4]);
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, this.format, this.format, gl.UNSIGNED_BYTE, faces[5]);

        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);

        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }

    bind(context: Context) {
        const {gl} = context;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(target, this.texture);
    }
}

export default TextureCubemap;