// @flow

import {SDF_SCALE} from '../render/glyph_manager.js';
import {AlphaImage} from '../util/image.js';
import {register} from '../util/web_worker_transfer.js';
import potpack from 'potpack';

import type {GlyphMetrics, StyleGlyph} from '../style/style_glyph.js';

const glyphPadding = 1;
/*
    The glyph padding is just to prevent sampling errors at the boundaries between
    glyphs in the atlas texture, and for that purpose there's no need to make it
    bigger with high-res SDFs. However, layout is done based on the glyph size
    including this padding, so scaling this padding is the easiest way to keep
    layout exactly the same as the SDF_SCALE changes.
*/
const localGlyphPadding = glyphPadding * SDF_SCALE;

export type Rect = {
    x: number,
    y: number,
    w: number,
    h: number
};

export type GlyphPosition = {
    rect: Rect,
    metrics: GlyphMetrics
};

export type GlyphPositions = {[_: string]: {[_: number]: GlyphPosition } }

export default class GlyphAtlas {
    image: AlphaImage;
    positions: GlyphPositions;

    constructor(stacks: {[_: string]: {[_: number]: ?StyleGlyph } }) {
        const positions = {};
        const bins = [];

        for (const stack in stacks) {
            const glyphs = stacks[stack];
            const stackPositions = positions[stack] = {};

            for (const id in glyphs) {
                const src = glyphs[+id];
                if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;

                const padding = src.metrics.localGlyph ? localGlyphPadding : glyphPadding;
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

        const {w, h} = potpack(bins);
        const image = new AlphaImage({width: w || 1, height: h || 1});

        for (const stack in stacks) {
            const glyphs = stacks[stack];

            for (const id in glyphs) {
                const src = glyphs[+id];
                if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;
                const bin = positions[stack][id].rect;
                const padding = src.metrics.localGlyph ? localGlyphPadding : glyphPadding;
                AlphaImage.copy(src.bitmap, image, {x: 0, y: 0}, {x: bin.x + padding, y: bin.y + padding}, src.bitmap);
            }
        }

        this.image = image;
        this.positions = positions;
    }
}

register('GlyphAtlas', GlyphAtlas);
