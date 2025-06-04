import assert from 'assert';
import {RGBAImage} from '../util/image';
import {register} from '../util/web_worker_transfer';
import potpack from 'potpack';
import {ImageId} from '../style-spec/expression/types/image_id';
import {ImageVariant} from '../style-spec/expression/types/image_variant';

import type {StyleImage, StyleImageMap} from '../style/style_image';
import type ImageManager from './image_manager';
import type Texture from './texture';
import type {SpritePosition} from '../util/image';
import type {LUT} from "../util/lut";
import type {StringifiedImageVariant} from '../style-spec/expression/types/image_variant';

const ICON_PADDING: number = 1;
const PATTERN_PADDING: number = 2;
export {ICON_PADDING, PATTERN_PADDING};

type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

type ImagePositionScale = {
    x: number;
    y: number;
}

export type ImagePositionMap = Map<StringifiedImageVariant, ImagePosition>;

export class ImagePosition implements SpritePosition {
    paddedRect: Rect;
    pixelRatio: number;
    version: number;
    stretchY: Array<[number, number]> | null | undefined;
    stretchX: Array<[number, number]> | null | undefined;
    content: [number, number, number, number] | null | undefined;
    padding: number;
    sdf: boolean;
    usvg: boolean;
    scale: ImagePositionScale;

    static getImagePositionScale(imageVariant: ImageVariant | undefined, usvg: boolean, pixelRatio: number): ImagePositionScale {
        if (usvg && imageVariant && imageVariant.options && imageVariant.options.transform) {
            const transform = imageVariant.options.transform;
            return {
                x: transform.a,
                y: transform.d
            };
        } else {
            return {
                x: pixelRatio,
                y: pixelRatio
            };
        }
    }

    constructor(paddedRect: Rect, image: StyleImage, padding: number, imageVariant?: ImageVariant) {
        this.paddedRect = paddedRect;
        const {
            pixelRatio,
            version,
            stretchX,
            stretchY,
            content,
            sdf,
            usvg,
        } = image;

        this.pixelRatio = pixelRatio;
        this.stretchX = stretchX;
        this.stretchY = stretchY;
        this.content = content;
        this.version = version;
        this.padding = padding;
        this.sdf = sdf;
        this.usvg = usvg;
        this.scale = ImagePosition.getImagePositionScale(imageVariant, usvg, pixelRatio);
    }

    get tl(): [number, number] {
        return [
            this.paddedRect.x + this.padding,
            this.paddedRect.y + this.padding
        ];
    }

    get br(): [number, number] {
        return [
            this.paddedRect.x + this.paddedRect.w - this.padding,
            this.paddedRect.y + this.paddedRect.h - this.padding
        ];
    }

    get displaySize(): [number, number] {
        return [
            (this.paddedRect.w - this.padding * 2) / this.scale.x,
            (this.paddedRect.h - this.padding * 2) / this.scale.y
        ];
    }
}

function getImageBin(image: StyleImage, padding: number, scale: [number, number] = [1, 1]) {
    // If it's a vector image, we set it's size as the natural one scaled
    const imageWidth = image.data ? image.data.width : image.width * scale[0];
    const imageHeight = image.data ? image.data.height : image.height * scale[1];
    return {
        x: 0,
        y: 0,
        w: imageWidth + 2 * padding,
        h: imageHeight + 2 * padding,
    };
}

export function getImagePosition(id: StringifiedImageVariant, src: StyleImage, padding: number) {
    const imageVariant = ImageVariant.parse(id);
    const bin = getImageBin(src, padding, [imageVariant.options.transform.a, imageVariant.options.transform.d]);
    return {bin, imagePosition: new ImagePosition(bin, src, padding, imageVariant), imageVariant};
}

export default class ImageAtlas {
    image: RGBAImage;
    iconPositions: ImagePositionMap;
    patternPositions: ImagePositionMap;
    haveRenderCallbacks: ImageId[];
    uploaded: boolean | null | undefined;
    lut: LUT | null;

    constructor(icons: StyleImageMap<StringifiedImageVariant>, patterns: StyleImageMap<StringifiedImageVariant>, lut: LUT | null) {
        const iconPositions: ImagePositionMap = new Map();
        const patternPositions: ImagePositionMap = new Map();
        this.haveRenderCallbacks = [];

        const bins = [];

        this.addImages(icons, iconPositions, ICON_PADDING, bins);
        this.addImages(patterns, patternPositions, PATTERN_PADDING, bins);

        const {w, h} = potpack(bins);
        const image = new RGBAImage({width: w || 1, height: h || 1});

        for (const [id, src] of icons.entries()) {
            const bin = iconPositions.get(id).paddedRect;
            // For SDF icons, we override the RGB channels with white.
            // This is because we read the red channel in the shader and RGB channels will get alpha-premultiplied on upload.
            const overrideRGB = src.sdf;
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x: bin.x + ICON_PADDING, y: bin.y + ICON_PADDING}, src.data, lut, overrideRGB);
        }

        for (const [id, src] of patterns.entries()) {
            const patternPosition = patternPositions.get(id);
            const bin = patternPosition.paddedRect;
            let padding = patternPosition.padding;
            const x = bin.x + padding,
                y = bin.y + padding,
                w = src.data.width,
                h = src.data.height;

            assert(padding > 1);
            padding = padding > 1 ? padding - 1 : padding;

            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x, y}, src.data, lut);
            // Add wrapped padding on each side of the image.
            // Leave one pixel transparent to avoid bleeding to neighbouring images
            RGBAImage.copy(src.data, image, {x: 0, y: h - padding}, {x, y: y - padding}, {width: w, height: padding}, lut); // T
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x, y: y + h}, {width: w, height: padding}, lut); // B
            RGBAImage.copy(src.data, image, {x: w - padding, y: 0}, {x: x - padding, y}, {width: padding, height: h}, lut); // L
            RGBAImage.copy(src.data, image, {x: 0,     y: 0}, {x: x + w, y}, {width: padding, height: h}, lut); // R
            // Fill corners
            RGBAImage.copy(src.data, image, {x: w - padding, y: h - padding}, {x: x - padding, y: y - padding}, {width: padding, height: padding}, lut); // TL
            RGBAImage.copy(src.data, image, {x: 0, y: h - padding}, {x: x + w, y: y - padding}, {width: padding, height: padding}, lut); // TR
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x: x + w, y: y + h}, {width: padding, height: padding}, lut); // BL
            RGBAImage.copy(src.data, image, {x: w - padding, y: 0}, {x: x - padding, y: y + h}, {width: padding, height: padding}, lut); // BR
        }

        this.lut = lut;
        this.image = image;
        this.iconPositions = iconPositions;
        this.patternPositions = patternPositions;
    }

    addImages(images: StyleImageMap<StringifiedImageVariant>, positions: ImagePositionMap, padding: number, bins: Array<Rect>) {
        for (const [id, src] of images.entries()) {
            const {bin, imagePosition, imageVariant} = getImagePosition(id, src, padding);
            positions.set(id, imagePosition);
            bins.push(bin);

            if (src.hasRenderCallback) {
                this.haveRenderCallbacks.push(imageVariant.id);
            }
        }
    }

    patchUpdatedImages(imageManager: ImageManager, texture: Texture, scope: string) {
        this.haveRenderCallbacks = this.haveRenderCallbacks.filter(id => imageManager.hasImage(id, scope));
        imageManager.dispatchRenderCallbacks(this.haveRenderCallbacks, scope);

        for (const imageId of imageManager.getUpdatedImages(scope)) {
            for (const id of this.iconPositions.keys()) {
                const imageVariant = ImageVariant.parse(id);
                if (ImageId.isEqual(imageVariant.id, imageId)) {
                    const image = imageManager.getImage(imageId, scope);
                    this.patchUpdatedImage(this.iconPositions.get(id), image, texture);
                }
            }

            for (const id of this.patternPositions.keys()) {
                const imageVariant = ImageVariant.parse(id);
                if (ImageId.isEqual(imageVariant.id, imageId)) {
                    const image = imageManager.getImage(imageId, scope);
                    this.patchUpdatedImage(this.patternPositions.get(id), image, texture);
                }
            }
        }
    }

    patchUpdatedImage(position: ImagePosition | null | undefined, image: StyleImage | null | undefined, texture: Texture) {
        if (!position || !image) return;

        if (position.version === image.version) return;

        position.version = image.version;
        const [x, y] = position.tl;
        const overrideRGBWithWhite = position.sdf;
        if (this.lut || overrideRGBWithWhite) {
            const size = {width: image.data.width, height: image.data.height};
            const imageToUpload = new RGBAImage(size);
            RGBAImage.copy(image.data, imageToUpload, {x: 0, y: 0}, {x: 0, y: 0}, size, this.lut, overrideRGBWithWhite);
            texture.update(imageToUpload, {position: {x, y}});
        } else {
            texture.update(image.data, {position: {x, y}});
        }
    }

}

register(ImagePosition, 'ImagePosition');
register(ImageAtlas, 'ImageAtlas');
