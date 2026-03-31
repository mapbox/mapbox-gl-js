import {loadGlyphRange} from './load_glyph_range';
import browser from '../util/browser';

import type {GlyphRange} from './load_glyph_range';
import type {StyleGlyphs} from './style_glyph';
import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';

type GlyphLoaderOptions = {
    useServerFontComposition?: boolean;
};

/*
  GlyphLoader handles loading fonts individually and performing client-side
  glyph fallback, rather than relying on the server font composition.

  - Each font is loaded and processed in priority order
  - Glyphs from the first font take priority
  - Missing glyphs are filled from subsequent fallback fonts
  - Requests for the same font/range are deduplicated across different fontstacks
 */
class GlyphLoader {
    private pendingRequests: Map<string, Array<Callback<GlyphRange>>>;

    private cachedRanges: Map<string, GlyphRange | null>;

    private useServerFontComposition: boolean;

    // Exposed as static to enable stubbing in unit tests
    static loadGlyphRange: typeof loadGlyphRange;

    constructor(options?: GlyphLoaderOptions) {
        this.pendingRequests = new Map();
        this.cachedRanges = new Map();
        this.useServerFontComposition = options && options.useServerFontComposition !== undefined ? options.useServerFontComposition : true;
    }

    loadGlyphRange(
        fontstack: string,
        range: number,
        urlTemplate: string,
        requestManager: RequestManager,
        callback: Callback<GlyphRange>
    ): void {
        if (this.useServerFontComposition) {
            GlyphLoader.loadGlyphRange(fontstack, range, urlTemplate, requestManager, callback);
            return;
        }

        const fonts = fontstack.split(',').map(f => f.trim()).filter(f => f.length > 0);
        if (fonts.length === 0) {
            callback(new Error('Empty fontstack'));
            return;
        }

        if (fonts.length === 1) {
            this._loadFont(fonts[0], range, urlTemplate, requestManager, callback);
            return;
        }

        this._loadMultipleFonts(fonts, range, urlTemplate, requestManager, callback);
    }

    private _loadMultipleFonts(
        fonts: string[],
        range: number,
        urlTemplate: string,
        requestManager: RequestManager,
        callback: Callback<GlyphRange>
    ): void {
        const results: Array<GlyphRange | null> = fonts.map((): GlyphRange | null => null);
        const state = {completed: 0, firstError: null as Error | null, callbackCalled: false};

        const handleResult = (index: number, err: Error | null | undefined, result: GlyphRange | null | undefined) => {
            if (state.callbackCalled) return;

            if (err && !state.firstError) {
                state.firstError = err;
            }
            if (result) {
                results[index] = result;
            }
            state.completed++;

            if (state.completed === fonts.length) {
                state.callbackCalled = true;
                // Filter out null results while preserving priority order
                const validResults = results.filter((r): r is GlyphRange => r !== null);
                if (validResults.length === 0) {
                    callback(state.firstError || new Error('All fonts failed to load'));
                    return;
                }
                const composed = this._composeGlyphs(validResults);
                callback(null, composed);
            }
        };

        for (let i = 0; i < fonts.length; i++) {
            this._loadFont(fonts[i], range, urlTemplate, requestManager, (err, result) => {
                handleResult(i, err, result);
            });
        }
    }

    private _loadFont(
        font: string,
        range: number,
        urlTemplate: string,
        requestManager: RequestManager,
        callback: Callback<GlyphRange>
    ): void {
        const cacheKey = `${font}:${range}`;

        if (this.cachedRanges.has(cacheKey)) {
            const cached = this.cachedRanges.get(cacheKey);
            browser.frame(() => callback(null, cached));
            return;
        }

        const pending = this.pendingRequests.get(cacheKey);
        if (pending) {
            pending.push(callback);
            return;
        }

        const callbacks: Array<Callback<GlyphRange>> = [callback];
        this.pendingRequests.set(cacheKey, callbacks);

        GlyphLoader.loadGlyphRange(font, range, urlTemplate, requestManager, (err, result) => {
            // Cache the result (even null for failed requests, to avoid retrying)
            if (!err) {
                this.cachedRanges.set(cacheKey, result || null);
            }

            const pendingCallbacks = this.pendingRequests.get(cacheKey);
            this.pendingRequests.delete(cacheKey);

            if (pendingCallbacks) {
                for (const cb of pendingCallbacks) {
                    cb(err, result);
                }
            }
        });
    }

    private _composeGlyphs(results: GlyphRange[]): GlyphRange {
        const composedGlyphs: StyleGlyphs = {};
        let ascender: number | undefined;
        let descender: number | undefined;

        for (const result of results) {
            if (ascender === undefined && result.ascender !== undefined) {
                ascender = result.ascender;
            }
            if (descender === undefined && result.descender !== undefined) {
                descender = result.descender;
            }

            // Add glyphs that aren't already present (priority to earlier fonts)
            if (result.glyphs) {
                for (const id in result.glyphs) {
                    if (composedGlyphs[id] === undefined) {
                        composedGlyphs[id] = result.glyphs[id];
                    }
                }
            }
        }

        return {
            glyphs: composedGlyphs,
            ascender,
            descender
        };
    }
}

GlyphLoader.loadGlyphRange = loadGlyphRange;

export {GlyphLoader};
