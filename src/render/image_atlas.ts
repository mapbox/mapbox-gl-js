import {RGBAImage} from '../util/image';
import {register} from '../util/web_worker_transfer';
import potpack from 'potpack';

import type {StyleImage} from '../style/style_image';
import type ImageManager from './image_manager';
import type Texture from './texture';
import type {SpritePosition} from '../util/image';
import type {LUT} from "../util/lut";

const IMAGE_PADDING: number = 1;
export {IMAGE_PADDING};

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

    constructor(paddedRect: Rect, {
        pixelRatio,
        version,
        stretchX,
        stretchY,
        content,
    }: StyleImage) {
        this.paddedRect = paddedRect;
        this.pixelRatio = pixelRatio;
        this.stretchX = stretchX;
        this.stretchY = stretchY;
        this.content = content;
        this.version = version;
    }

    get tl(): [number, number] {
        return [
            this.paddedRect.x + IMAGE_PADDING,
            this.paddedRect.y + IMAGE_PADDING
        ];
    }

    get br(): [number, number] {
        return [
            this.paddedRect.x + this.paddedRect.w - IMAGE_PADDING,
            this.paddedRect.y + this.paddedRect.h - IMAGE_PADDING
        ];
    }

    get displaySize(): [number, number] {
        return [
            (this.paddedRect.w - IMAGE_PADDING * 2) / this.pixelRatio,
            (this.paddedRect.h - IMAGE_PADDING * 2) / this.pixelRatio
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

        this.addImages(icons, iconPositions, bins);
        this.addImages(patterns, patternPositions, bins);

        const {w, h} = potpack(bins);
        const image = new RGBAImage({width: w || 1, height: h || 1});

        for (const id in icons) {
            const src = icons[id];
            const bin = iconPositions[id].paddedRect;
            // For SDF icons, we override the RGB channels with white.
            // This is because we read the red channel in the shader and RGB channels will get alpha-premultiplied on upload.
            const overrideRGB = src.sdf;
            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x: bin.x + IMAGE_PADDING, y: bin.y + IMAGE_PADDING}, src.data, lut, overrideRGB);
        }

        for (const id in patterns) {
            const src = patterns[id];
            const bin = patternPositions[id].paddedRect;
            const x = bin.x + IMAGE_PADDING,
                y = bin.y + IMAGE_PADDING,
                w = src.data.width,
                h = src.data.height;

            RGBAImage.copy(src.data, image, {x: 0, y: 0}, {x, y}, src.data, lut);
            // Add 1 pixel wrapped padding on each side of the image.
            RGBAImage.copy(src.data, image, {x: 0, y: h - 1}, {x, y: y - 1}, {width: w, height: 1}, lut); // T
            RGBAImage.copy(src.data, image, {x: 0, y:     0}, {x, y: y + h}, {width: w, height: 1}, lut); // B
            RGBAImage.copy(src.data, image, {x: w - 1, y: 0}, {x: x - 1, y}, {width: 1, height: h}, lut); // L
            RGBAImage.copy(src.data, image, {x: 0,     y: 0}, {x: x + w, y}, {width: 1, height: h}, lut); // R
        }

        this.image = image;
        this.iconPositions = iconPositions;
        this.patternPositions = patternPositions;
    }

    addImages(images: {
        [_: string]: StyleImage;
    }, positions: {
        [_: string]: ImagePosition;
    }, bins: Array<Rect>) {
        for (const id in images) {
            const src = images[id];
            const bin = {
                x: 0,
                y: 0,
                w: src.data.width + 2 * IMAGE_PADDING,
                h: src.data.height + 2 * IMAGE_PADDING,
            };
            bins.push(bin);
            positions[id] = new ImagePosition(bin, src);

            if (src.hasRenderCallback) {
                this.haveRenderCallbacks.push(id);
            }
        }
    }

    patchUpdatedImages(imageManager: ImageManager, texture: Texture, scope: string) {
        this.haveRenderCallbacks = this.haveRenderCallbacks.filter(id => imageManager.hasImage(id, scope));
        imageManager.dispatchRenderCallbacks(this.haveRenderCallbacks, scope);
        for (const name in imageManager.getUpdatedImages(scope)) {
            this.patchUpdatedImage(this.iconPositions[name], imageManager.getImage(name, scope), texture);
            this.patchUpdatedImage(this.patternPositions[name], imageManager.getImage(name, scope), texture);
        }
    }

    patchUpdatedImage(position: ImagePosition | null | undefined, image: StyleImage | null | undefined, texture: Texture) {
        if (!position || !image) return;

        if (position.version === image.version) return;

        position.version = image.version;
        const [x, y] = position.tl;
        const hasPattern = !!Object.keys(this.patternPositions).length;
        texture.update(image.data, {useMipmap: hasPattern}, {x, y});
    }

}

register(ImagePosition, 'ImagePosition');
register(ImageAtlas, 'ImageAtlas');
