// @flow

const ShelfPack = require('@mapbox/shelf-pack');
const {AlphaImage} = require('../util/image');

import type {GlyphMetrics, StyleGlyph} from '../style/style_glyph';

const padding = 1;

type Rect = {
    x: number,
    y: number,
    w: number,
    h: number
};

export type GlyphPosition = {
    rect: Rect,
    metrics: GlyphMetrics
};

export type GlyphAtlas = {
    image: AlphaImage,
    positions: {[string]: {[number]: GlyphPosition}}
};

function makeGlyphAtlas(stacks: {[string]: {[number]: ?StyleGlyph}}): GlyphAtlas {
    const image = AlphaImage.create({width: 0, height: 0});
    const positions = {};

    const pack = new ShelfPack(0, 0, {autoResize: true});

    for (const stack in stacks) {
        const glyphs = stacks[stack];
        const stackPositions = positions[stack] = {};

        for (const id in glyphs) {
            const src = glyphs[+id];
            if (src && src.bitmap.width !== 0 && src.bitmap.height !== 0) {
                const bin = pack.packOne(
                    src.bitmap.width + 2 * padding,
                    src.bitmap.height + 2 * padding);

                AlphaImage.resize(image, {
                    width: pack.w,
                    height: pack.h
                });

                AlphaImage.copy(
                    src.bitmap,
                    image,
                    { x: 0, y: 0 },
                    {
                        x: bin.x + padding,
                        y: bin.y + padding
                    },
                    src.bitmap);

                stackPositions[id] = { rect: bin, metrics: src.metrics };
            }
        }
    }

    pack.shrink();
    AlphaImage.resize(image, {
        width: pack.w,
        height: pack.h
    });

    return {image, positions};
}

module.exports = {
    makeGlyphAtlas
};
