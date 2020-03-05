// @flow

import loadGlyphRange from '../style/load_glyph_range';

import TinySDF from '@mapbox/tiny-sdf';
import isChar from '../util/is_char_in_unicode_block';
import {asyncAll} from '../util/util';
import {AlphaImage} from '../util/image';

import type {StyleGlyph} from '../style/style_glyph';
import type {RequestManager} from '../util/mapbox';
import type {Callback} from '../types/callback';

type Entry = {
    // null means we've requested the range, but the glyph wasn't included in the result.
    glyphs: {[id: number]: StyleGlyph | null},
    requests: {[range: number]: Array<Callback<{[_: number]: StyleGlyph | null}>>},
    ranges: {[range: number]: boolean | null},
    tinySDF?: TinySDF
};

class GlyphManager {
    requestManager: RequestManager;
    localIdeographFontFamily: ?string;
    entries: {[_: string]: Entry};
    url: ?string;

    // exposed as statics to enable stubbing in unit tests
    static loadGlyphRange: typeof loadGlyphRange;
    static TinySDF: Class<TinySDF>;

    constructor(requestManager: RequestManager, localIdeographFontFamily: ?string) {
        this.requestManager = requestManager;
        this.localIdeographFontFamily = localIdeographFontFamily;
        this.entries = {};
    }

    setURL(url: ?string) {
        this.url = url;
    }

    getGlyphs(glyphs: {[stack: string]: Array<number>}, callback: Callback<{[stack: string]: {[id: number]: ?StyleGlyph}}>) {
        const all = [];

        for (const stack in glyphs) {
            for (const id of glyphs[stack]) {
                all.push({stack, id});
            }
        }

        asyncAll(all, ({stack, id}, callback: Callback<{stack: string, id: number, glyph: ?StyleGlyph}>) => {
            let entry = this.entries[stack];
            if (!entry) {
                entry = this.entries[stack] = {
                    glyphs: {},
                    requests: {},
                    ranges: {}
                };
            }

            let glyph = entry.glyphs[id];
            if (glyph !== undefined) {
                callback(null, {stack, id, glyph});
                return;
            }

            glyph = this._tinySDF(entry, stack, id);
            if (glyph) {
                entry.glyphs[id] = glyph;
                callback(null, {stack, id, glyph});
                return;
            }

            const range = Math.floor(id / 256);
            if (range * 256 > 65535) {
                callback(new Error('glyphs > 65535 not supported'));
                return;
            }

            if (entry.ranges[range]) {
                callback(null, {stack, id, glyph});
                return;
            }

            let requests = entry.requests[range];
            if (!requests) {
                requests = entry.requests[range] = [];
                GlyphManager.loadGlyphRange(stack, range, (this.url: any), this.requestManager,
                    (err, response: ?{[_: number]: StyleGlyph | null}) => {
                        if (response) {
                            for (const id in response) {
                                if (!this._doesCharSupportLocalGlyph(+id)) {
                                    entry.glyphs[+id] = response[+id];
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

            requests.push((err, result: ?{[_: number]: StyleGlyph | null}) => {
                if (err) {
                    callback(err);
                } else if (result) {
                    callback(null, {stack, id, glyph: result[id] || null});
                }
            });
        }, (err, glyphs: ?Array<{stack: string, id: number, glyph: ?StyleGlyph}>) => {
            if (err) {
                callback(err);
            } else if (glyphs) {
                const result = {};

                for (const {stack, id, glyph} of glyphs) {
                    // Clone the glyph so that our own copy of its ArrayBuffer doesn't get transferred.
                    (result[stack] || (result[stack] = {}))[id] = glyph && {
                        id: glyph.id,
                        bitmap: glyph.bitmap.clone(),
                        metrics: glyph.metrics
                    };
                }

                callback(null, result);
            }
        });
    }

    _doesCharSupportLocalGlyph(id: number): boolean {
        /* eslint-disable new-cap */
        return !!this.localIdeographFontFamily &&
            (isChar['CJK Unified Ideographs'](id) ||
                isChar['Hangul Syllables'](id) ||
                isChar['Hiragana'](id) ||
                isChar['Katakana'](id));
        /* eslint-enable new-cap */
    }

    _tinySDF(entry: Entry, stack: string, id: number): ?StyleGlyph {
        const family = this.localIdeographFontFamily;
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
            tinySDF = entry.tinySDF = new GlyphManager.TinySDF(24, 3, 8, .25, family, fontWeight);
        }

        return {
            id,
            bitmap: new AlphaImage({width: 30, height: 30}, tinySDF.draw(String.fromCharCode(id))),
            metrics: {
                width: 24,
                height: 24,
                left: 0,
                top: -8,
                advance: 24
            }
        };
    }
}

GlyphManager.loadGlyphRange = loadGlyphRange;
GlyphManager.TinySDF = TinySDF;

export default GlyphManager;
