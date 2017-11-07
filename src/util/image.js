// @flow

const assert = require('assert');

export type Size = {
    width: number,
    height: number
};

type Point = {
    x: number,
    y: number
};

function createImage({width, height}: Size, channels: number, data?: Uint8Array) {
    if (!data) {
        data = new Uint8Array(width * height * channels);
    } else if (data.length !== width * height * channels) {
        throw new RangeError('mismatched image size');
    }
    return { width, height, data };
}

function resizeImage(image: *, {width, height}: Size, channels: number) {
    if (width === image.width && height === image.height) {
        return image;
    }

    const newImage = createImage({width, height}, channels);

    copyImage(image, newImage, {x: 0, y: 0}, {x: 0, y: 0}, {
        width: Math.min(image.width, width),
        height: Math.min(image.height, height)
    }, channels);

    image.width = width;
    image.height = height;
    image.data = newImage.data;
}

function copyImage(srcImg: *, dstImg: *, srcPt: Point, dstPt: Point, size: Size, channels: number) {
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

// These "classes" are really just a combination of type (for the properties)
// and namespace (for the static methods). In reality, the type at runtime is
// a plain old object; we can't use instance methods because these values are
// transferred to and from workers.
class AlphaImage {
    width: number;
    height: number;
    data: Uint8Array;

    static create(size: Size, data?: Uint8Array) {
        return ((createImage(size, 1, data): any): AlphaImage);
    }

    static resize(image: AlphaImage, size: Size) {
        resizeImage(image, size, 1);
    }

    static copy(srcImg: AlphaImage, dstImg: AlphaImage, srcPt: Point, dstPt: Point, size: Size) {
        copyImage(srcImg, dstImg, srcPt, dstPt, size, 1);
    }
}

// Not premultiplied, because ImageData is not premultiplied.
// UNPACK_PREMULTIPLY_ALPHA_WEBGL must be used when uploading to a texture.
class RGBAImage {
    width: number;
    height: number;
    data: Uint8Array;

    static create(size: Size, data?: Uint8Array) {
        return ((createImage(size, 4, data): any): RGBAImage);
    }

    static resize(image: RGBAImage, size: Size) {
        resizeImage(image, size, 4);
    }

    static copy(srcImg: RGBAImage | ImageData, dstImg: RGBAImage, srcPt: Point, dstPt: Point, size: Size) {
        copyImage(srcImg, dstImg, srcPt, dstPt, size, 4);
    }
}

module.exports = {
    AlphaImage,
    RGBAImage
};
