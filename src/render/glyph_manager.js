// @flow

import loadGlyphRange from '../style/load_glyph_range.js';

import TinySDF from '@mapbox/tiny-sdf';
import isChar from '../util/is_char_in_unicode_block.js';
import {asyncAll} from '../util/util.js';
import {AlphaImage} from '../util/image.js';

import type {StyleGlyph} from '../style/style_glyph.js';
import type {RequestManager} from '../util/mapbox.js';
import type {Callback} from '../types/callback.js';

/*
  SDF_SCALE controls the pixel density of locally generated glyphs relative
  to "normal" SDFs which are generated at 24pt font and a "pixel ratio" of 1.
  The GlyphManager will generate glyphs SDF_SCALE times as large,
  but with the same glyph metrics, and the quad generation code will scale them
  back down so they display at the same size.

  The choice of SDF_SCALE is a trade-off between performance and quality.
  Glyph generation time grows quadratically with the the scale, while quality
  improvements drop off rapidly when the scale is higher than the pixel ratio
  of the device. The scale of 2 buys noticeable improvements on HDPI screens
  at acceptable cost.

  The scale can be any value, but in order to avoid small distortions, these
  pixel-based values must come out to integers:
   - "localGlyphPadding" in GlyphAtlas
   - Font/Canvas/Buffer size for TinySDF
  localGlyphPadding + buffer should equal 4 * SDF_SCALE. So if you wanted to
  use an SDF_SCALE of 1.75, you could manually set localGlyphAdding to 2 and
  buffer to 5.
*/
export const SDF_SCALE = 2;

type Entry = {
    // null means we've requested the range, but the glyph wasn't included in the result.
    glyphs: {[id: number]: StyleGlyph | null},
    requests: {[range: number]: Array<Callback<{glyphs: {[number]: StyleGlyph | null}, ascender?: number, descender?: number}>>},
    ranges: {[range: number]: boolean | null},
    tinySDF?: TinySDF,
    ascender?: number,
    descender?: number
};

export const LocalGlyphMode = {
    none: 0,
    ideographs: 1,
    all: 2
};

class GlyphManager {
    requestManager: RequestManager;
    localFontFamily: ?string;
    localGlyphMode: number;
    entries: {[_: string]: Entry};
    // Multiple fontstacks may share the same local glyphs, so keep an index
    // into the glyphs based soley on font weight
    localGlyphs: {[_: string]: {glyphs: {[id: number]: StyleGlyph | null}, ascender: ?number, descender: ?number}};
    url: ?string;

    // exposed as statics to enable stubbing in unit tests
    static loadGlyphRange: typeof loadGlyphRange;
    static TinySDF: Class<TinySDF>;

    constructor(requestManager: RequestManager, localGlyphMode: number, localFontFamily: ?string) {
        this.requestManager = requestManager;
        this.localGlyphMode = localGlyphMode;
        this.localFontFamily = localFontFamily;
        this.entries = {};
        this.localGlyphs = {
            // Only these four font weights are supported
            '200': {},
            '400': {},
            '500': {},
            '900': {}
        };
    }

    setURL(url: ?string) {
        this.url = url;
    }

    getGlyphs(glyphs: {[stack: string]: Array<number>}, callback: Callback<{[stack: string]: {glyphs: {[_: number]: ?StyleGlyph}, ascender?: number, descender?: number}}>) {
        const all = [];

        for (const stack in glyphs) {
            for (const id of glyphs[stack]) {
                all.push({stack, id});
            }
        }

        asyncAll(all, ({stack, id}, fnCallback: Callback<{stack: string, id: number, glyph: ?StyleGlyph}>) => {
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

            glyph = this._tinySDF(entry, stack, id);
            if (glyph) {
                entry.glyphs[id] = glyph;
                fnCallback(null, {stack, id, glyph});
                return;
            }

            const range = Math.floor(id / 256);
            if (range * 256 > 65535) {
                fnCallback(new Error('glyphs > 65535 not supported'));
                return;
            }

            if (entry.ranges[range]) {
                fnCallback(null, {stack, id, glyph});
                return;
            }

            let requests = entry.requests[range];
            if (!requests) {
                requests = entry.requests[range] = [];
                GlyphManager.loadGlyphRange(stack, range, (this.url: any), this.requestManager,
                    (err, response: ?{glyphs: {[_: number]: StyleGlyph | null}, ascender?: number, descender?: number}) => {
                        if (response) {
                            entry.ascender = response.ascender;
                            entry.descender = response.descender;
                            for (const id in response.glyphs) {
                                if (!this._doesCharSupportLocalGlyph(+id)) {
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

            requests.push((err, result: ?{glyphs: {[_: number]: StyleGlyph | null}, ascender?: number, descender?: number}) => {
                if (err) {
                    fnCallback(err);
                } else if (result) {
                    fnCallback(null, {stack, id, glyph: result.glyphs[id] || null});
                }
            });
        }, (err, glyphs: ?Array<{stack: string, id: number, glyph: ?StyleGlyph}>) => {
            if (err) {
                callback(err);
            } else if (glyphs) {
                const result = {};

                for (const {stack, id, glyph} of glyphs) {
                    // Clone the glyph so that our own copy of its ArrayBuffer doesn't get transferred.
                    if (result[stack] === undefined) result[stack] = {};
                    if (result[stack].glyphs === undefined) result[stack].glyphs = {};
                    result[stack].glyphs[id] = glyph && {
                        id: glyph.id,
                        bitmap: glyph.bitmap.clone(),
                        metrics: glyph.metrics
                    };
                    result[stack].ascender = this.entries[stack].ascender;
                    result[stack].descender = this.entries[stack].descender;
                }

                callback(null, result);
            }
        });
    }

    _doesCharSupportLocalGlyph(id: number): boolean {
        if (this.localGlyphMode === LocalGlyphMode.none) {
            return false;
        } else if (this.localGlyphMode === LocalGlyphMode.all) {
            return !!this.localFontFamily;
        } else {
            /* eslint-disable new-cap */
            return !!this.localFontFamily &&
            (isChar['CJK Unified Ideographs'](id) ||
                isChar['Hangul Syllables'](id) ||
                isChar['Hiragana'](id) ||
                isChar['Katakana'](id)) ||
                // gl-native parity: Extend Ideographs rasterization range to include CJK symbols and punctuations
                isChar['CJK Symbols and Punctuation'](id);
            /* eslint-enable new-cap */
        }
    }

    _tinySDF(entry: Entry, stack: string, id: number): ?StyleGlyph {
        const family = this.localFontFamily;
        if (!family) {
            return;
        }

        if (!this._doesCharSupportLocalGlyph(id)) {
            return;
        }

        let tinySDF = entry.tinySDF;
        if (!tinySDF) {
            let fontWeight = '400';
            if (/bold/i.test(stack)) {
                fontWeight = '900';
            } else if (/medium/i.test(stack)) {
                fontWeight = '500';
            } else if (/light/i.test(stack)) {
                fontWeight = '200';
            }
            tinySDF = entry.tinySDF = new GlyphManager.TinySDF(24 * SDF_SCALE, 3 * SDF_SCALE, 8 * SDF_SCALE, .25, family, fontWeight);
        }

        if (this.localGlyphs[tinySDF.fontWeight][id]) {
            return this.localGlyphs[tinySDF.fontWeight][id];
        }

        const {data, metrics} = tinySDF.drawWithMetrics(String.fromCharCode(id));
        const {sdfWidth, sdfHeight, width, height, left, top, advance} = metrics;
        /*
        TinySDF's "top" is the distance from the alphabetic baseline to the
         top of the glyph.

        Server-generated fonts specify "top" relative to an origin above the
         em box (the origin comes from FreeType, but I'm unclear on exactly
         how it's derived)
          ref: https://github.com/mapbox/sdf-glyph-foundry

        Server fonts don't yet include baseline information, so we can't line
        up exactly with them (and they don't line up with each other)
          ref: https://github.com/mapbox/node-fontnik/pull/160

        To approximately align TinySDF glyphs with server-provided glyphs, we
        use this baseline adjustment factor calibrated to be in between DIN Pro
        and Arial Unicode (but closer to Arial Unicode)
        */
        const baselineAdjustment = 27;

        const glyph = this.localGlyphs[tinySDF.fontWeight][id] = {
            id,
            bitmap: new AlphaImage({
                width: sdfWidth,
                height: sdfHeight
            }, data),
            metrics: {
                width: width / SDF_SCALE,
                height: height / SDF_SCALE,
                left: left / SDF_SCALE,
                top: top / SDF_SCALE - baselineAdjustment,
                advance: advance / SDF_SCALE,
                localGlyph: true
            }
        };
        return glyph;
    }
}

GlyphManager.loadGlyphRange = loadGlyphRange;
GlyphManager.TinySDF = TinySDF;

export default GlyphManager;
