// @flow

import ShelfPack from '@mapbox/shelf-pack';

import { RGBAImage } from '../util/image';

import type {StyleImage} from '../style/style_image';

const padding = 1;

type Rect = {
    x: number,
    y: number,
    w: number,
    h: number
};

export type ImagePosition = {
    pixelRatio: number,
    textureRect: Rect,
    tl: [number, number],
    br: [number, number],
    displaySize: [number, number]
};

// This wants to be a class, but is sent to workers, so must be a plain JSON blob.
function imagePosition(rect: Rect, {pixelRatio}: StyleImage): ImagePosition {
    const textureRect = {
        x: rect.x + padding,
        y: rect.y + padding,
        w: rect.w - padding * 2,
        h: rect.h - padding * 2
    };
    return {
        pixelRatio,
        textureRect,

        // Redundant calculated members.
        tl: [
            textureRect.x,
            textureRect.y
        ],
        br: [
            textureRect.x + textureRect.w,
            textureRect.y + textureRect.h
        ],
        displaySize: [
            textureRect.w / pixelRatio,
            textureRect.h / pixelRatio
        ]
    };
}

export type ImageAtlas = {
    image: RGBAImage,
    positions: {[string]: ImagePosition}
};

function makeImageAtlas(images: {[string]: StyleImage}): ImageAtlas {
    const image = new RGBAImage({width: 0, height: 0});
    const positions = {};

    const pack = new ShelfPack(0, 0, {autoResize: true});

    for (const id in images) {
        const src = images[id];

        const bin = pack.packOne(
            src.data.width + 2 * padding,
            src.data.height + 2 * padding);

        image.resize({
            width: pack.w,
            height: pack.h
        });

        RGBAImage.copy(
            src.data,
            image,
            { x: 0, y: 0 },
            {
                x: bin.x + padding,
                y: bin.y + padding
            },
            src.data);

        positions[id] = imagePosition(bin, src);
    }

    pack.shrink();
    image.resize({
        width: pack.w,
        height: pack.h
    });

    return {image, positions};
}

const exported = {
    imagePosition,
    makeImageAtlas
};

export default exported;
export { imagePosition, makeImageAtlas };
