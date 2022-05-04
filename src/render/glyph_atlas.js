// @flow

import {SDF_SCALE} from '../render/glyph_manager.js';
import {AlphaImage} from '../util/image.js';
import {register} from '../util/web_worker_transfer.js';
import potpack from 'potpack';

import type {StyleGlyph} from '../style/style_glyph.js';

const glyphPadding = 1;
/*
    The glyph padding is just to prevent sampling errors at the boundaries between
    glyphs in the atlas texture, and for that purpose there's no need to make it
    bigger with high-res SDFs. However, layout is done based on the glyph size
    including this padding, so scaling this padding is the easiest way to keep
    layout exactly the same as the SDF_SCALE changes.
*/
const localGlyphPadding = glyphPadding * SDF_SCALE;

export type GlyphRect = {
    x: number,
    y: number,
    w: number,
    h: number
};
// {glyphID: glyphRect}
export type GlyphPositionMap = { [_: number]: GlyphRect };

// {fontStack: glyphPoistionMap}
export type GlyphPositions = { [_: string]: GlyphPositionMap };

export default class GlyphAtlas {
    image: AlphaImage;
    positions: GlyphPositions;
    constructor(stacks: {[_: string]: {glyphs: {[_: number]: ?StyleGlyph }, ascender?: number, descender?: number }}) {
        const positions = {};
        const bins = [];

        for (const stack in stacks) {
            const glyphData = stacks[stack];
            const glyphPositionMap = positions[stack] = {};

            for (const id in glyphData.glyphs) {
                const src = glyphData.glyphs[+id];
                if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;

                const padding = src.metrics.localGlyph ? localGlyphPadding : glyphPadding;
                const bin = {
                    x: 0,
                    y: 0,
                    w: src.bitmap.width + 2 * padding,
                    h: src.bitmap.height + 2 * padding
                };
                bins.push(bin);
                glyphPositionMap[id] = bin;
            }
        }

        const {w, h} = potpack(bins);
        const image = new AlphaImage({width: w || 1, height: h || 1});

        for (const stack in stacks) {
            const glyphData = stacks[stack];

            for (const id in glyphData.glyphs) {
                const src = glyphData.glyphs[+id];
                if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue;
                const bin = positions[stack][id];
                const padding = src.metrics.localGlyph ? localGlyphPadding : glyphPadding;
                AlphaImage.copy(src.bitmap, image, {x: 0, y: 0}, {x: bin.x + padding, y: bin.y + padding}, src.bitmap);
            }
        }

        this.image = image;
        this.positions = positions;
    }
}

register(GlyphAtlas, 'GlyphAtlas');
