// @flow

export type Glyph = {
    id: number,
    width: number,
    height: number,
    left: number,
    top: number,
    advance: number,
    bitmap: Uint8ClampedArray
};

export type GlyphStack = {
    name: string,
    range: string,
    glyphs: {[number]: Glyph}
};

class Glyphs {
    stacks: Array<GlyphStack>;

    constructor(pbf: any, end: any) {
        this.stacks = pbf.readFields(readFontstacks, [], end);
    }
}

function readFontstacks(tag, stacks, pbf) {
    if (tag === 1) {
        const fontstack = pbf.readMessage(readFontstack, {glyphs: {}});
        stacks.push(fontstack);
    }
}

function readFontstack(tag, fontstack, pbf) {
    if (tag === 1) fontstack.name = pbf.readString();
    else if (tag === 2) fontstack.range = pbf.readString();
    else if (tag === 3) {
        const glyph = pbf.readMessage(readGlyph, {});
        fontstack.glyphs[glyph.id] = glyph;
    }
}

function readGlyph(tag, glyph, pbf) {
    if (tag === 1) glyph.id = pbf.readVarint();
    else if (tag === 2) glyph.bitmap = pbf.readBytes();
    else if (tag === 3) glyph.width = pbf.readVarint();
    else if (tag === 4) glyph.height = pbf.readVarint();
    else if (tag === 5) glyph.left = pbf.readSVarint();
    else if (tag === 6) glyph.top = pbf.readSVarint();
    else if (tag === 7) glyph.advance = pbf.readVarint();
}

module.exports = Glyphs;
