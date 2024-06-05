import {getArrayBuffer, ResourceType} from '../util/ajax';

import parseGlyphPBF from './parse_glyph_pbf';

import type {StyleGlyph} from './style_glyph';
import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';

export default function (fontstack: string,
                           range: number,
                           urlTemplate: string,
                           requestManager: RequestManager,
                           callback: Callback<{
                               glyphs: {
                                   [key: number]: StyleGlyph | null;
                               };
                               ascender?: number;
                               descender?: number;
                           }>) {
    const begin = range * 256;
    const end = begin + 255;

    const request = requestManager.transformRequest(
        requestManager.normalizeGlyphsURL(urlTemplate)
            .replace('{fontstack}', fontstack)
            .replace('{range}', `${begin}-${end}`),
        // @ts-expect-error - TS2345 - Argument of type 'string' is not assignable to parameter of type '"Unknown" | "Style" | "Source" | "Tile" | "Glyphs" | "SpriteImage" | "SpriteJSON" | "Image" | "Model"'.
        ResourceType.Glyphs);

    getArrayBuffer(request, (err?: Error | null, data?: ArrayBuffer | null) => {
        if (err) {
            callback(err);
        } else if (data) {
            const glyphs: Record<string, any> = {};
            const glyphData = parseGlyphPBF(data);
            for (const glyph of glyphData.glyphs) {
                glyphs[glyph.id] = glyph;
            }
            callback(null, {glyphs, ascender: glyphData.ascender, descender: glyphData.descender});
        }
    });
}
