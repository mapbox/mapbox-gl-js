import {AlphaImage} from '../util/image';
import Protobuf from 'pbf';
const border = 3;

import type {StyleGlyph, GlyphMetrics} from './style_glyph';

export type GlyphData = {
    glyphs: Array<StyleGlyph>;
    ascender?: number;
    descender?: number;
};

function readFontstacks(tag: number, glyphData: GlyphData, pbf: Protobuf) {
    glyphData.glyphs = [];
    if (tag === 1) {
        pbf.readMessage(readFontstack, glyphData);
    }
}

function readFontstack(tag: number, glyphData: GlyphData, pbf: Protobuf) {
    if (tag === 3) {
        const {id, bitmap, width, height, left, top, advance} = pbf.readMessage(readGlyph, {} as StyleGlyph & GlyphMetrics);
        glyphData.glyphs.push({
            id,
            bitmap: new AlphaImage({
                width: width + 2 * border,
                height: height + 2 * border
            }, bitmap as unknown as Uint8Array),
            metrics: {width, height, left, top, advance}
        });
    } else if (tag === 4) {
        glyphData.ascender = pbf.readSVarint();
    } else if (tag === 5) {
        glyphData.descender = pbf.readSVarint();
    }
}

function readGlyph(tag: number, glyph: StyleGlyph & GlyphMetrics & {bitmap: Uint8Array}, pbf: Protobuf) {
    if (tag === 1) glyph.id = pbf.readVarint();
    else if (tag === 2) (glyph as {bitmap: Uint8Array}).bitmap = pbf.readBytes();
    else if (tag === 3) glyph.width = pbf.readVarint();
    else if (tag === 4) glyph.height = pbf.readVarint();
    else if (tag === 5) glyph.left = pbf.readSVarint();
    else if (tag === 6) glyph.top = pbf.readSVarint();
    else if (tag === 7) glyph.advance = pbf.readVarint();
}

export default function parseGlyphPbf(data: ArrayBuffer | Uint8Array): GlyphData {
    return new Protobuf(data).readFields(readFontstacks, {} as GlyphData);
}

export const GLYPH_PBF_BORDER = border;
