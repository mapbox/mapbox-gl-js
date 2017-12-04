// @flow

const loadGlyphRange = require('../style/load_glyph_range');
const TinySDF = require('@mapbox/tiny-sdf');
const isChar = require('../util/is_char_in_unicode_block');
const {asyncAll} = require('../util/util');
const {AlphaImage} = require('../util/image');

import type {StyleGlyph} from '../style/style_glyph';
import type {RequestTransformFunction} from '../ui/map';
import type {Callback} from '../types/callback';

type Entry = {
    // null means we've requested the range, but the glyph wasn't included in the result.
    glyphs: {[id: number]: StyleGlyph | null},
    requests: {[range: number]: Array<Callback<{[number]: StyleGlyph | null}>>},
    tinySDF?: TinySDF
};

class GlyphManager {
    requestTransform: RequestTransformFunction;
    localIdeographFontFamily: ?string;
    entries: {[string]: Entry};
    url: ?string;

    constructor(requestTransform: RequestTransformFunction, localIdeographFontFamily: ?string) {
        this.requestTransform = requestTransform;
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
                    requests: {}
                };
            }

            let glyph = entry.glyphs[id];
            if (glyph !== undefined) {
                callback(null, {stack, id, glyph});
                return;
            }

            glyph = this._tinySDF(entry, stack, id);
            if (glyph) {
                callback(null, {stack, id, glyph});
                return;
            }

            const range = Math.floor(id / 256);
            if (range * 256 > 65535) {
                callback(new Error('glyphs > 65535 not supported'));
                return;
            }

            let requests = entry.requests[range];
            if (!requests) {
                requests = entry.requests[range] = [];
                loadGlyphRange(stack, range, (this.url: any), this.requestTransform,
                    (err, response: ?{[number]: StyleGlyph | null}) => {
                        if (response) {
                            for (const id in response) {
                                entry.glyphs[+id] = response[+id];
                            }
                        }
                        for (const cb of requests) {
                            cb(err, response);
                        }
                        delete entry.requests[range];
                    });
            }

            requests.push((err, result: ?{[number]: StyleGlyph | null}) => {
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
                    (result[stack] || (result[stack] = {}))[id] = glyph;
                }

                callback(null, result);
            }
        });
    }

    _tinySDF(entry: Entry, stack: string, id: number): ?StyleGlyph {
        const family = this.localIdeographFontFamily;
        if (!family) {
            return;
        }

        if (!isChar['CJK Unified Ideographs'](id) && !isChar['Hangul Syllables'](id)) { // eslint-disable-line new-cap
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
            tinySDF = entry.tinySDF = new TinySDF(24, 3, 8, .25, family, fontWeight);
        }

        return {
            id,
            bitmap: AlphaImage.create({width: 30, height: 30}, tinySDF.draw(String.fromCharCode(id))),
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

module.exports = GlyphManager;
