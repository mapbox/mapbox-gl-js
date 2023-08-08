// @flow

import assert from 'assert';

import {register} from './web_worker_transfer.js';

export type Size = interface {
    width: number,
    height: number,
};

export interface SpritePosition {
    +tl: [number, number],
    +br: [number, number],
    +pixelRatio?: number
}
export type SpritePositions = {[_: string]: SpritePosition};

type Point = {
    x: number,
    y: number
};

function createImage<T: AlphaImage | RGBAImage>(image: T, {width, height}: Size, channels: number, data?: Uint8Array | Uint8ClampedArray): T {
    if (!data) {
        data = new Uint8Array(width * height * channels);
    } else if (data instanceof Uint8ClampedArray) {
        data = new Uint8Array(data.buffer);
    } else if (data.length !== width * height * channels) {
        throw new RangeError('mismatched image size');
    }
    image.width = width;
    image.height = height;
    image.data = data;
    return image;
}

function resizeImage<T: AlphaImage | RGBAImage>(image: T, newImage: T, channels: number) {
    const {width, height} = newImage;
    if (width === image.width && height === image.height) {
        return;
    }

    copyImage(image, newImage, {x: 0, y: 0}, {x: 0, y: 0}, {
        width: Math.min(image.width, width),
        height: Math.min(image.height, height)
    }, channels);

    image.width = width;
    image.height = height;
    image.data = newImage.data;
}

function copyImage<T: RGBAImage | AlphaImage>(srcImg: T | ImageData, dstImg: T, srcPt: Point, dstPt: Point, size: Size, channels: number): T {
    if (size.width === 0 || size.height === 0) {
        return dstImg;
    }

    if (size.width > srcImg.width ||
        size.height > srcImg.height ||
        srcPt.x > srcImg.width - size.width ||
        srcPt.y > srcImg.height - size.height) {
        throw new RangeError('out of range source coordinates for image copy');
    }

    if (size.width > dstImg.width ||
        size.height > dstImg.height ||
        dstPt.x > dstImg.width - size.width ||
        dstPt.y > dstImg.height - size.height) {
        throw new RangeError('out of range destination coordinates for image copy');
    }

    const srcData = srcImg.data;
    const dstData = dstImg.data;

    assert(srcData !== dstData);

    for (let y = 0; y < size.height; y++) {
        const srcOffset = ((srcPt.y + y) * srcImg.width + srcPt.x) * channels;
        const dstOffset = ((dstPt.y + y) * dstImg.width + dstPt.x) * channels;
        for (let i = 0; i < size.width * channels; i++) {
            dstData[dstOffset + i] = srcData[srcOffset + i];
        }
    }
    return dstImg;
}

export class AlphaImage {
    width: number;
    height: number;
    data: Uint8Array;

    constructor(size: Size, data?: Uint8Array | Uint8ClampedArray) {
        createImage(this, size, 1, data);
    }

    resize(size: Size) {
        resizeImage(this, new AlphaImage(size), 1);
    }

    clone(): AlphaImage {
        return new AlphaImage({width: this.width, height: this.height}, new Uint8Array(this.data));
    }

    static copy(srcImg: AlphaImage, dstImg: AlphaImage, srcPt: Point, dstPt: Point, size: Size) {
        copyImage(srcImg, dstImg, srcPt, dstPt, size, 1);
    }
}

// Not premultiplied, because ImageData is not premultiplied.
// UNPACK_PREMULTIPLY_ALPHA_WEBGL must be used when uploading to a texture.
export class RGBAImage {
    width: number;
    height: number;

    // data must be a Uint8Array instead of Uint8ClampedArray because texImage2D does not
    // support Uint8ClampedArray in all browsers
    data: Uint8Array;

    constructor(size: Size, data?: Uint8Array | Uint8ClampedArray) {
        createImage(this, size, 4, data);
    }

    resize(size: Size) {
        resizeImage(this, new RGBAImage(size), 4);
    }

    replace(data: Uint8Array | Uint8ClampedArray, copy?: boolean) {
        if (copy) {
            this.data.set(data);
        } else if (data instanceof Uint8ClampedArray) {
            this.data = new Uint8Array(data.buffer);
        } else {
            this.data = data;
        }
    }

    clone(): RGBAImage {
        return new RGBAImage({width: this.width, height: this.height}, new Uint8Array(this.data));
    }

    static copy(srcImg: RGBAImage | ImageData, dstImg: RGBAImage, srcPt: Point, dstPt: Point, size: Size) {
        copyImage(srcImg, dstImg, srcPt, dstPt, size, 4);
    }
}

export class Float32Image {
    width: number;
    height: number;

    data: Float32Array;

    constructor(size: Size, data: Uint8Array | Float32Array) {
        this.width = size.width;
        this.height = size.height;

        if (data instanceof Uint8Array) {
            this.data = new Float32Array(data.buffer);
        } else {
            this.data = data;
        }
    }
}

register(AlphaImage, 'AlphaImage');
register(RGBAImage, 'RGBAImage');
