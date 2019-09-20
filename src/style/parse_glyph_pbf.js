// @flow

import {AlphaImage} from '../util/image.js';

import Protobuf from 'pbf';
const border = 3;

import type {StyleGlyph} from './style_glyph.js';

let count = 0;
let ascender = 0.0;
let descender = 0.0;

function readFontstacks(tag: number, glyphs: Array<StyleGlyph>, pbf: Protobuf) {
    if (tag === 1) {
        count = 0;
        ascender = 0.0;
        descender = 0.0;
        pbf.readMessage(readFontstack, glyphs);
        for (let i = glyphs.length - count; i <= glyphs.length - 1; ++i) {
            glyphs[i].metrics.ascender = ascender;
            glyphs[i].metrics.descender = descender;
        }
    }
}

function readFontstack(tag: number, glyphs: Array<StyleGlyph>, pbf: Protobuf) {
    if (tag === 3) {
        const {id, bitmap, width, height, left, top, advance} = pbf.readMessage(readGlyph, {});
        glyphs.push({
            id,
            bitmap: new AlphaImage({
                width: width + 2 * border,
                height: height + 2 * border
            }, bitmap),
            metrics: {width, height, left, top, advance, ascender, descender}
        });
        ++count;
    } else if (tag === 4) {
        ascender = pbf.readDouble();
    } else if (tag === 5) {
        descender = pbf.readDouble();
    }
}

function readGlyph(tag: number, glyph: Object, pbf: Protobuf) {
    if (tag === 1) glyph.id = pbf.readVarint();
    else if (tag === 2) glyph.bitmap = pbf.readBytes();
    else if (tag === 3) glyph.width = pbf.readVarint();
    else if (tag === 4) glyph.height = pbf.readVarint();
    else if (tag === 5) glyph.left = pbf.readSVarint();
    else if (tag === 6) glyph.top = pbf.readSVarint();
    else if (tag === 7) glyph.advance = pbf.readVarint();
}

export default function (data: ArrayBuffer | Uint8Array): Array<StyleGlyph> {
    return new Protobuf(data).readFields(readFontstacks, []);
}

export const GLYPH_PBF_BORDER = border;
