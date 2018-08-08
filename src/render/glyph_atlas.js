// @flow

import ShelfPack from '@mapbox/shelf-pack';

import { AlphaImage } from '../util/image';
import { register } from '../util/web_worker_transfer';

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

export default class GlyphAtlas {
    image: AlphaImage;
    positions: { [string]: { [number]: GlyphPosition } };

    constructor(stacks: { [string]: { [number]: ?StyleGlyph } }) {
        const positions = {};
        const pack = new ShelfPack(0, 0, {autoResize: true});
        const bins = [];

        for (const stack in stacks) {
            const glyphs = stacks[stack];
            const stackPositions = positions[stack] = {};

            for (const id in glyphs) {
                const src = glyphs[+id];
                if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;

                const bin = {
                    x: 0,
                    y: 0,
                    w: src.bitmap.width + 2 * padding,
                    h: src.bitmap.height + 2 * padding
                };
                bins.push(bin);
                stackPositions[id] = {rect: bin, metrics: src.metrics};
            }
        }

        pack.pack(bins, {inPlace: true});

        const image = new AlphaImage({width: pack.w, height: pack.h});

        for (const stack in stacks) {
            const glyphs = stacks[stack];

            for (const id in glyphs) {
                const src = glyphs[+id];
                if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;
                const bin = positions[stack][id].rect;
                AlphaImage.copy(src.bitmap, image, {x: 0, y: 0}, {x: bin.x + padding, y: bin.y + padding}, src.bitmap);
            }
        }

        this.image = image;
        this.positions = positions;
    }
}

register('GlyphAtlas', GlyphAtlas);
