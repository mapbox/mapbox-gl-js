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

export async function loadGlyphRange(
    fontstack: string,
    range: number,
    urlTemplate: string,
    requestManager: RequestManager,
    callback: Callback<GlyphRange>
) {
    const begin = range * 256;
    const end = begin + 255;

    let result: GlyphRange;
    try {
        const request = await requestManager.transformRequest(
            requestManager.normalizeGlyphsURL(urlTemplate)
                .replace('{fontstack}', fontstack)
                .replace('{range}', `${begin}-${end}`),
            ResourceType.Glyphs);

        const {data} = await getArrayBuffer(request);
        const glyphs: Record<string, StyleGlyph> = {};
        const glyphData = parseGlyphPBF(data);
        for (const glyph of glyphData.glyphs) {
            glyphs[glyph.id] = glyph;
        }
        result = {glyphs, ascender: glyphData.ascender, descender: glyphData.descender};
    } catch (err) {
        // No controller: every rejection must settle the callback, or the GlyphManager dedup entry blocks forever.
        return callback(err as Error);
    }
    callback(null, result);
}
