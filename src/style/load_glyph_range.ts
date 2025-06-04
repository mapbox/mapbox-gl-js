import {getArrayBuffer, ResourceType} from '../util/ajax';
import parseGlyphPBF from './parse_glyph_pbf';

import type {StyleGlyph, StyleGlyphs} from './style_glyph';
import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';

export type GlyphRange = {
    glyphs?: StyleGlyphs;
    ascender?: number;
    descender?: number;
};

export function loadGlyphRange(
    fontstack: string,
    range: number,
    urlTemplate: string,
    requestManager: RequestManager,
    callback: Callback<GlyphRange>
) {
    const begin = range * 256;
    const end = begin + 255;

    const request = requestManager.transformRequest(
        requestManager.normalizeGlyphsURL(urlTemplate)
            .replace('{fontstack}', fontstack)
            .replace('{range}', `${begin}-${end}`),
        ResourceType.Glyphs);

    getArrayBuffer(request, (err?: Error, data?: ArrayBuffer) => {
        if (err) {
            callback(err);
        } else if (data) {
            const glyphs: Record<string, StyleGlyph> = {};
            const glyphData = parseGlyphPBF(data);
            for (const glyph of glyphData.glyphs) {
                glyphs[glyph.id] = glyph;
            }
            callback(null, {glyphs, ascender: glyphData.ascender, descender: glyphData.descender});
        }
    });
}
