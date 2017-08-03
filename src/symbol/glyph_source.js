// @flow

const normalizeURL = require('../util/mapbox').normalizeGlyphsURL;
const ajax = require('../util/ajax');
const Glyphs = require('../util/glyphs');
const GlyphAtlas = require('../symbol/glyph_atlas');
const Protobuf = require('pbf');
const TinySDF = require('@mapbox/tiny-sdf');
const isChar = require('../util/is_char_in_unicode_block');
const Evented = require('../util/evented');
const assert = require('assert');

import type {Glyph, GlyphStack} from '../util/glyphs';
import type {Rect} from '../symbol/glyph_atlas';
import type {RequestTransformFunction} from '../ui/map';

// A simplified representation of the glyph containing only the properties needed for shaping.
class SimpleGlyph {
    advance: number;
    left: number;
    top: number;
    rect: ?Rect;

    constructor(glyph: Glyph, rect: ?Rect, buffer: number) {
        const padding = 1;
        this.advance = glyph.advance;
        this.left = glyph.left - buffer - padding;
        this.top = glyph.top + buffer + padding;
        this.rect = rect;
    }
}

export type {SimpleGlyph as SimpleGlyph};

/**
 * A glyph source has a URL from which to load new glyphs and manages
 * GlyphAtlases in which to store glyphs used by the requested fontstacks
 * and ranges.
 *
 * @private
 */
class GlyphSource extends Evented {
    url: ?string;
    atlases: {[string]: GlyphAtlas};
    stacks: {[string]: { ranges: {[number]: GlyphStack}, cjkGlyphs: {[number]: Glyph} }};
    loading: {[string]: {[number]: Array<Function>}};
    localIdeographFontFamily: ?string;
    tinySDFs: {[string]: TinySDF};
    transformRequestCallback: RequestTransformFunction;

    /**
     * @param {string} url glyph template url
     */
    constructor(url: ?string, localIdeographFontFamily: ?string, transformRequestCallback: RequestTransformFunction, eventedParent?: Evented) {
        super();
        this.url = url && normalizeURL(url);
        this.atlases = {};
        this.stacks = {};
        this.loading = {};
        this.localIdeographFontFamily = localIdeographFontFamily;
        this.tinySDFs = {};
        this.setEventedParent(eventedParent);
        this.transformRequestCallback = transformRequestCallback;
    }

    getSimpleGlyphs(fontstack: string, glyphIDs: Array<number>, uid: number, callback: (err: ?Error, glyphs: {[number]: SimpleGlyph}, fontstack: string) => void) {
        if (this.stacks[fontstack] === undefined) {
            this.stacks[fontstack] = { ranges: {}, cjkGlyphs: {} };
        }
        if (this.atlases[fontstack] === undefined) {
            this.atlases[fontstack] = new GlyphAtlas();
        }

        const glyphs: {[number]: SimpleGlyph} = {};
        const stack = this.stacks[fontstack];
        const atlas = this.atlases[fontstack];

        // the number of pixels the sdf bitmaps are padded by
        const buffer = 3;

        const missingRanges: {[number]: Array<number>} = {};
        let remaining = 0;

        const getGlyph = (glyphID) => {
            const range = Math.floor(glyphID / 256);
            if (this.localIdeographFontFamily &&
                // eslint-disable-next-line new-cap
                (isChar['CJK Unified Ideographs'](glyphID) ||
                // eslint-disable-next-line new-cap
                 isChar['Hangul Syllables'](glyphID))) {
                if (!stack.cjkGlyphs[glyphID]) {
                    stack.cjkGlyphs[glyphID] = this.loadCJKGlyph(fontstack, glyphID);
                }

                const glyph = stack.cjkGlyphs[glyphID];
                const rect  = atlas.addGlyph(uid, fontstack, glyph, buffer);
                if (glyph) glyphs[glyphID] = new SimpleGlyph(glyph, rect, buffer);
            } else {
                if (stack.ranges[range]) {
                    const glyph = stack.ranges[range].glyphs[glyphID];
                    const rect  = atlas.addGlyph(uid, fontstack, glyph, buffer);
                    if (glyph) glyphs[glyphID] = new SimpleGlyph(glyph, rect, buffer);
                } else {
                    if (missingRanges[range] === undefined) {
                        missingRanges[range] = [];
                        remaining++;
                    }
                    missingRanges[range].push(glyphID);
                }
            }
            /* eslint-enable new-cap */
        };

        for (const glyphID of glyphIDs) {
            getGlyph(glyphID);
        }

        if (!remaining) callback(undefined, glyphs, fontstack);

        const onRangeLoaded = (err: ?Error, range: ?number, data: ?Glyphs) => {
            if (err) {
                this.fire('error', { error: err });
            } else if (typeof range === 'number' && data) {
                const stack = this.stacks[fontstack].ranges[range] = data.stacks[0];
                for (let i = 0; i < missingRanges[range].length; i++) {
                    const glyphID = missingRanges[range][i];
                    const glyph = stack.glyphs[glyphID];
                    const rect  = atlas.addGlyph(uid, fontstack, glyph, buffer);
                    if (glyph) glyphs[glyphID] = new SimpleGlyph(glyph, rect, buffer);
                }

                remaining--;
                if (!remaining) callback(undefined, glyphs, fontstack);
            }
        };

        for (const r in missingRanges) {
            this.loadRange(fontstack, +r, onRangeLoaded);
        }
    }

    createTinySDF(fontFamily: string, fontWeight: string) {
        return new TinySDF(24, 3, 8, .25, fontFamily, fontWeight);
    }

    loadCJKGlyph(fontstack: string, glyphID: number): Glyph {
        let tinySDF = this.tinySDFs[fontstack];
        if (!tinySDF) {
            let fontWeight = '400';
            if (/bold/i.test(fontstack)) {
                fontWeight = '900';
            } else if (/medium/i.test(fontstack)) {
                fontWeight = '500';
            } else if (/light/i.test(fontstack)) {
                fontWeight = '200';
            }
            assert(this.localIdeographFontFamily);
            tinySDF = this.tinySDFs[fontstack] = this.createTinySDF((this.localIdeographFontFamily: any), fontWeight);
        }

        return {
            id: glyphID,
            bitmap: tinySDF.draw(String.fromCharCode(glyphID)),
            width: 24,
            height: 24,
            left: 0,
            top: -8,
            advance: 24
        };
    }

    loadPBF(url: string, callback: Callback<{data: ArrayBuffer}>) {
        const request  = this.transformRequestCallback ? this.transformRequestCallback(url, ajax.ResourceType.Glyphs) : { url };
        ajax.getArrayBuffer(request, callback);
    }

    loadRange(fontstack: string, range: number, callback: (err: ?Error, range: ?number, glyphs: ?Glyphs) => void) {
        if (range * 256 > 65535) {
            callback(new Error('glyphs > 65535 not supported'));
            return;
        }

        if (this.loading[fontstack] === undefined) {
            this.loading[fontstack] = {};
        }
        const loading = this.loading[fontstack];

        if (loading[range]) {
            loading[range].push(callback);
        } else {
            loading[range] = [callback];

            assert(this.url);
            const rangeName = `${range * 256}-${range * 256 + 255}`;
            const url = glyphUrl(fontstack, rangeName, (this.url: any));

            this.loadPBF(url, (err, response) => {
                if (err) {
                    for (const cb of loading[range]) {
                        cb(err);
                    }
                } else if (response) {
                    const glyphs = new Glyphs(new Protobuf(response.data));
                    for (const cb of loading[range]) {
                        cb(null, range, glyphs);
                    }
                }
                delete loading[range];
            });
        }
    }

    getGlyphAtlas(fontstack: string) {
        return this.atlases[fontstack];
    }
}

/**
 * Use CNAME sharding to load a specific glyph range over a randomized
 * but consistent subdomain.
 * @param {string} fontstack comma-joined fonts
 * @param {string} range comma-joined range
 * @param {url} url templated url
 * @param {string} [subdomains=abc] subdomains as a string where each letter is one.
 * @returns {string} a url to load that section of glyphs
 * @private
 */
function glyphUrl(fontstack, range, url, subdomains) {
    subdomains = subdomains || 'abc';

    return url
        .replace('{s}', subdomains[fontstack.length % subdomains.length])
        .replace('{fontstack}', fontstack)
        .replace('{range}', range);
}

module.exports = GlyphSource;
