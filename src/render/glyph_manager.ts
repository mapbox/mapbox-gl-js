import {GlyphLoader} from '../style/glyph_loader';
import {LocalGlyphRasterizer} from './local_glyph_rasterizer';
import config from '../util/config';
import {asyncAll, warnOnce} from '../util/util';

import type {FontstackCompositing} from '../style/glyph_loader';
import type {GlyphRange} from '../style/load_glyph_range';
import type {StyleGlyph, StyleGlyphs} from '../style/style_glyph';
import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';

type FontStack = string;
export type FontStacks = Record<FontStack, number[]>;

type FontGlyph = {
    id: number;
    stack: FontStack;
    glyph?: StyleGlyph;
};

type Entry = {
    // null means we've requested the range, but the glyph wasn't included in the result.
    glyphs: StyleGlyphs;
    requests: {[range: number]: Array<Callback<GlyphRange>>};
    ranges: {[range: number]: boolean | null};
    ascender?: number;
    descender?: number;
};

export type GlyphMap = Record<FontStack, GlyphRange>;

class GlyphManager {
    requestManager: RequestManager;
    localGlyphs: LocalGlyphRasterizer;
    entries: Record<string, Entry>;
    url: string;
    glyphLoader: GlyphLoader;

    constructor(requestManager: RequestManager, localGlyphMode: number, localFontFamily?: string, fontstackCompositing?: FontstackCompositing) {
        this.requestManager = requestManager;
        this.localGlyphs = new LocalGlyphRasterizer({mode: localGlyphMode, fontFamily: localFontFamily});
        this.url = '';
        this.entries = {};
        this.glyphLoader = new GlyphLoader({fontstackCompositing});
    }

    setURL(url: string) {
        this.url = url;
    }

    getGlyphs(glyphs: FontStacks, callback: Callback<GlyphMap>) {
        const all: Array<{id: number, stack: FontStack}> = [];
        const stacks = Object.keys(glyphs);

        // Fallback to the default glyphs URL if none is specified
        const url = this.url || config.GLYPHS_URL;

        for (const stack in glyphs) {
            for (const id of glyphs[stack]) {
                all.push({stack, id});
            }
        }

        asyncAll(all, ({stack, id}, fnCallback: Callback<FontGlyph>) => {
            let entry = this.entries[stack];
            if (!entry) {
                entry = this.entries[stack] = {
                    glyphs: {},
                    requests: {},
                    ranges: {},
                    ascender: undefined,
                    descender: undefined
                };
            }

            let glyph = entry.glyphs[id];
            if (glyph !== undefined) {
                fnCallback(null, {stack, id, glyph});
                return;
            }

            glyph = this.localGlyphs.draw(stack, id);
            if (glyph) {
                entry.glyphs[id] = glyph;
                fnCallback(null, {stack, id, glyph});
                return;
            }

            const range = Math.floor(id / 256);
            if (range * 256 > 65535) {
                warnOnce('glyphs > 65535 not supported');
                fnCallback(null, {stack, id, glyph});
                return;
            }

            if (entry.ranges[range]) {
                fnCallback(null, {stack, id, glyph});
                return;
            }

            let requests = entry.requests[range];
            if (!requests) {
                requests = entry.requests[range] = [];
                this.glyphLoader.loadGlyphRange(stack, range, url, this.requestManager,
                    (err, response?: GlyphRange) => {
                        if (response) {
                            entry.ascender = response.ascender;
                            entry.descender = response.descender;
                            for (const id in response.glyphs) {
                                if (!this.localGlyphs.supports(+id)) {
                                    entry.glyphs[+id] = response.glyphs[+id];
                                }
                            }
                            entry.ranges[range] = true;
                        }
                        for (const cb of requests) {
                            cb(err, response);
                        }
                        delete entry.requests[range];
                    });
            }

            requests.push((err, result?: GlyphRange) => {
                if (err) {
                    fnCallback(err);
                } else if (result) {
                    fnCallback(null, {stack, id, glyph: result.glyphs[id] || null});
                }
            });
        }, (err, glyphs?: Array<FontGlyph>) => {
            if (err) {
                callback(err);
            } else if (glyphs) {
                // Every requested stack gets its baseline, including ones requested without glyphs by workers
                // that rasterize local glyphs themselves
                const result: GlyphMap = {};
                for (const stack of stacks) {
                    const entry = this.entries[stack];
                    result[stack] = {glyphs: {}, ascender: entry && entry.ascender, descender: entry && entry.descender};
                }

                for (const {stack, id, glyph} of glyphs) {
                    // Clone the glyph so that our own copy of its ArrayBuffer doesn't get transferred.
                    result[stack].glyphs[id] = glyph && {
                        id: glyph.id,
                        bitmap: glyph.bitmap.clone(),
                        metrics: glyph.metrics
                    };
                }

                callback(null, result);
            }
        });
    }
}

export type {GlyphRange};

export default GlyphManager;
