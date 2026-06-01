import {AlphaImage} from '../util/image';
import {PbfReader} from 'pbf';
const border = 3;

import type {StyleGlyph} from './style_glyph';

export type GlyphData = {
    glyphs: Array<StyleGlyph>;
    ascender?: number;
    descender?: number;
};

function readFontstacks(pbf: PbfReader): GlyphData {
    const glyphData: GlyphData = {glyphs: []};
    let field: number;
    while ((field = pbf.nextField())) {
        if (field === 1) readFontstack(pbf, pbf.readVarint() + pbf.pos, glyphData);
    }
    return glyphData;
}

function readFontstack(pbf: PbfReader, end: number, glyphData: GlyphData) {
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 3) glyphData.glyphs.push(readGlyph(pbf, pbf.readVarint() + pbf.pos));
        else if (field === 4) glyphData.ascender = pbf.readSVarint();
        else if (field === 5) glyphData.descender = pbf.readSVarint();
    }
}

function readGlyph(pbf: PbfReader, end: number): StyleGlyph {
    let id = 0, width = 0, height = 0, left = 0, top = 0, advance = 0;
    let bitmap: Uint8Array;
    let field: number;
    while ((field = pbf.nextField(end))) {
        if (field === 1) id = pbf.readVarint();
        else if (field === 2) bitmap = pbf.readBytes();
        else if (field === 3) width = pbf.readVarint();
        else if (field === 4) height = pbf.readVarint();
        else if (field === 5) left = pbf.readSVarint();
        else if (field === 6) top = pbf.readSVarint();
        else if (field === 7) advance = pbf.readVarint();
    }
    return {
        id,
        bitmap: new AlphaImage({width: width + 2 * border, height: height + 2 * border}, bitmap),
        metrics: {width, height, left, top, advance}
    };
}

export default function parseGlyphPbf(data: ArrayBuffer | Uint8Array): GlyphData {
    return readFontstacks(new PbfReader(data));
}

export const GLYPH_PBF_BORDER = border;
