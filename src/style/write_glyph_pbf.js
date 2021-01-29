// @flow

import {AlphaImage} from '../util/image';

import Pbf from 'pbf';

import type {StyleGlyph} from './style_glyph';

function writeFontstacks(glyphs: Array<StyleGlyph>, pbf: Protobuf) {
    pbf.writeMessage(1, writeFontstack, glyphs);
}

function writeFontstack(glyphs: Array<StyleGlyph>, pbf: Protobuf) {
    for (const glyph of glyphs) {
        pbf.writeMessage(3, writeGlyph, glyph);
    }
}

function writeGlyph(glyph: Object, pbf: Protobuf) {
    pbf.writeVarintField(1, glyph.id);
    pbf.writeBytesField(2, glyph.bitmap.data);
    pbf.writeVarintField(3, 2 * glyph.metrics.width);
    pbf.writeVarintField(4, 2 * glyph.metrics.height);
    pbf.writeSVarintField(5, glyph.metrics.left);
    pbf.writeSVarintField(6, Math.round(glyph.metrics.top)); // TODO
    pbf.writeVarintField(7, glyph.metrics.advance);
}

export default function (glyphs: Array<StyleGlyph>): Uint8Array  {
    const pbf = new Pbf();
    writeFontstacks(glyphs, pbf);
    return new Uint8Array(pbf.finish());
}
