// @flow

import {getArrayBuffer, ResourceType} from '../util/ajax.js';

import parseGlyphPBF from './parse_glyph_pbf.js';

import type {StyleGlyph} from './style_glyph.js';
import type {RequestManager} from '../util/mapbox.js';
import type {Callback} from '../types/callback.js';

export default function (fontstack: string,
                           range: number,
                           urlTemplate: string,
                           requestManager: RequestManager,
                           callback: Callback<{glyphs: {[number]: StyleGlyph | null}, ascender?: number, descender?: number}>) {
    const begin = range * 256;
    const end = begin + 255;

    const request = requestManager.transformRequest(
        requestManager.normalizeGlyphsURL(urlTemplate)
            .replace('{fontstack}', fontstack)
            .replace('{range}', `${begin}-${end}`),
        ResourceType.Glyphs);

    getArrayBuffer(request, (err: ?Error, data: ?ArrayBuffer) => {
        if (err) {
            callback(err);
        } else if (data) {
            const glyphs = {};
            const glyphData = parseGlyphPBF(data);
            for (const glyph of glyphData.glyphs) {
                glyphs[glyph.id] = glyph;
            }
            callback(null, {glyphs, ascender: glyphData.ascender, descender: glyphData.descender});
        }
    });
}
