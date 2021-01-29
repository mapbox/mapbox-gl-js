// @flow

import {AlphaImage} from '../util/image';

import Protobuf from 'pbf';

export const GLYPH_PBF_BORDER = 3;

import type {StyleGlyph} from './style_glyph';

function readFontstacks(tag: number, output: Array<StyleGlyph>, pbf: Protobuf) {
    if (tag === 1) {
        pbf.readMessage(readFontstack, output);
    }
}

function readFontstack(tag: number, output: Array<StyleGlyph>, pbf: Protobuf) {
    if (tag === 3) {
        const {id, bitmap, width, height, left, top, advance} = pbf.readMessage(readGlyph, {});
        output.glyphs.push({
            id,
            bitmap: new AlphaImage({
                width: width + output.scale * 2 * GLYPH_PBF_BORDER,
                height: height + output.scale * 2 * GLYPH_PBF_BORDER
            }, bitmap),
            metrics: {width: width / output.scale, height: height / output.scale, left, top, advance, localGlyph: true}
        });
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

export default function (data: ArrayBuffer | Uint8Array, scale: ?number): Array<StyleGlyph> {
    return new Protobuf(data).readFields(readFontstacks, { scale: scale || 1, glyphs: [] }).glyphs;
}
