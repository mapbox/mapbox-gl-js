import assert from 'assert';
import {RGBAImage} from '../util/image';
import {register} from '../util/web_worker_transfer';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import potpack from 'potpack';

import type {StyleImage} from '../style/style_image';
import type ImageManager from './image_manager';
import type Texture from './texture';
import type {SpritePosition} from '../util/image';
import type {LUT} from "../util/lut";

const ICON_PADDING: number = 1;
const PATTERN_PADDING: number = 2;
export {ICON_PADDING, PATTERN_PADDING};

type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

export class ImagePosition implements SpritePosition {
    paddedRect: Rect;
    pixelRatio: number;
    version: number;
    stretchY: Array<[number, number]> | null | undefined;
    stretchX: Array<[number, number]> | null | undefined;
    content: [number, number, number, number] | null | undefined;
    padding: number;

    constructor(paddedRect: Rect, {
        pixelRatio,
        version,
        stretchX,
        stretchY,
        content,
    }: StyleImage, padding: number) {
        this.paddedRect = paddedRect;
        this.pixelRatio = pixelRatio;
        this.stretchX = stretchX;
        this.stretchY = stretchY;
        this.content = content;
        this.version = version;
        this.padding = padding;
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
            (this.paddedRect.w - this.padding * 2) / this.pixelRatio,
            (this.paddedRect.h - this.padding * 2) / this.pixelRatio
        ];
    }
}

export default class ImageAtlas {
    image: RGBAImage;
    iconPositions: {
        [_: string]: ImagePosition;
    };
    patternPositions: {
        [_: string]: ImagePosition;
    };
    haveRenderCallbacks: Array<string>;
    uploaded: boolean | null | undefined;

    constructor(icons: {
        [_: string]: StyleImage;
    }, patterns: {
        [_: string]: StyleImage;
    }, lut: LUT | null) {
        const iconPositions: Record<string, any> = {}, patternPositions: Record<string, any> = {};
        this.haveRenderCallbacks = [];

        const bins = [];

        this.addImages(icons, iconPositions, ICON_PADDING, bins);
        this.addImages(patterns, patternPositions, PATTERN_PADDING, bins);

        const {w, h} = potpack(bins);
        const image = new RGBAImage({width: w || 1, height: h || 1});

        for (const id in icons) {
            const src = icons[id];
            const bin = iconPositions[id].paddedRect;
            // For SDF icons, we override the RGB channels with white.
            // This is because we read the red channel in the shader and RGB channels will get alpha-premultiplied on upload.
            const overrideRGB = src.sdf;
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x: bin.x + ICON_PADDING, y: bin.y + ICON_PADDING}, src.data, lut, overrideRGB);
        }

        for (const id in patterns) {
            const src = patterns[id];
            const bin = patternPositions[id].paddedRect;
            let padding = patternPositions[id].padding;
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
            RGBAImage.copy(src.data, image, {x: 0, y:     0}, {x, y: y + h}, {width: w, height: padding}, lut); // B
            RGBAImage.copy(src.data, image, {x: w - padding, y: 0}, {x: x - padding, y}, {width: padding, height: h}, lut); // L
            RGBAImage.copy(src.data, image, {x: 0,     y: 0}, {x: x + w, y}, {width: padding, height: h}, lut); // R
            // Fill corners
            RGBAImage.copy(src.data, image, {x: w - padding, y: h - padding}, {x: x - padding, y: y - padding}, {width: padding, height: padding}, lut); // TL
            RGBAImage.copy(src.data, image, {x: 0, y: h - padding}, {x: x + w, y: y - padding}, {width: padding, height: padding}, lut); // TR
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x: x + w, y: y + h}, {width: padding, height: padding}, lut); // BL
            RGBAImage.copy(src.data, image, {x: w - padding, y: 0}, {x: x - padding, y: y + h}, {width: padding, height: padding}, lut); // BR
        }

        this.image = image;
        this.iconPositions = iconPositions;
        this.patternPositions = patternPositions;
    }

    addImages(images: {
        [_: string]: StyleImage;
    }, positions: {
        [_: string]: ImagePosition;
    }, padding: number,
    bins: Array<Rect>) {
        for (const id in images) {
            const src = images[id];
            const bin = {
                x: 0,
                y: 0,
                w: src.data.width + 2 * padding,
                h: src.data.height + 2 * padding,
            };
            bins.push(bin);
            positions[id] = new ImagePosition(bin, src, padding);

            if (src.hasRenderCallback) {
                this.haveRenderCallbacks.push(id);
            }
        }
    }

    patchUpdatedImages(imageManager: ImageManager, texture: Texture, scope: string) {
        this.haveRenderCallbacks = this.haveRenderCallbacks.filter(id => imageManager.hasImage(id, scope));
        imageManager.dispatchRenderCallbacks(this.haveRenderCallbacks, scope);
        for (const name in imageManager.getUpdatedImages(scope)) {
            const imageKey = ResolvedImage.build(name).getSerializedPrimary();
            this.patchUpdatedImage(this.iconPositions[imageKey], imageManager.getImage(name, scope), texture);
            this.patchUpdatedImage(this.patternPositions[imageKey], imageManager.getImage(name, scope), texture);
        }
    }

    patchUpdatedImage(position: ImagePosition | null | undefined, image: StyleImage | null | undefined, texture: Texture) {
        if (!position || !image) return;

        if (position.version === image.version) return;

        position.version = image.version;
        const [x, y] = position.tl;
        texture.update(image.data, {position: {x, y}});
    }

}

register(ImagePosition, 'ImagePosition');
register(ImageAtlas, 'ImageAtlas');
