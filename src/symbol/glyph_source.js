
const normalizeURL = require('../util/mapbox').normalizeGlyphsURL;
const ajax = require('../util/ajax');
const Glyphs = require('../util/glyphs');
const GlyphAtlas = require('../symbol/glyph_atlas');
const Protobuf = require('pbf');
const TinySDF = require('@mapbox/tiny-sdf');
const isChar = require('../util/is_char_in_unicode_block');
const Evented = require('../util/evented');

// A simplified representation of the glyph containing only the properties needed for shaping.
class SimpleGlyph {
    constructor(glyph, rect, buffer) {
        const padding = 1;
        this.advance = glyph.advance;
        this.left = glyph.left - buffer - padding;
        this.top = glyph.top + buffer + padding;
        this.rect = rect;
    }
}

/**
 * A glyph source has a URL from which to load new glyphs and manages
 * GlyphAtlases in which to store glyphs used by the requested fontstacks
 * and ranges.
 *
 * @private
 */
class GlyphSource extends Evented {
    /**
     * @param {string} url glyph template url
     */
    constructor(url, localIdeographFontFamily, eventedParent) {
        super();
        this.url = url && normalizeURL(url);
        this.atlases = {};
        this.stacks = {};
        this.loading = {};
        this.localIdeographFontFamily = localIdeographFontFamily;
        this.tinySDFs = {};
        this.setEventedParent(eventedParent);
    }

    getSimpleGlyphs(fontstack, glyphIDs, uid, callback) {
        if (this.stacks[fontstack] === undefined) {
            this.stacks[fontstack] = { ranges: {}, cjkGlyphs: {} };
        }
        if (this.atlases[fontstack] === undefined) {
            this.atlases[fontstack] = new GlyphAtlas();
        }

        const glyphs = {};
        const stack = this.stacks[fontstack];
        const atlas = this.atlases[fontstack];

        // the number of pixels the sdf bitmaps are padded by
        const buffer = 3;

        const missingRanges = {};
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

        for (let i = 0; i < glyphIDs.length; i++) {
            getGlyph(glyphIDs[i]);
        }

        if (!remaining) callback(undefined, glyphs, fontstack);

        const onRangeLoaded = (err, range, data) => {
            if (err) {
                this.fire('error', { error: err });
                return;
            }

            const stack = this.stacks[fontstack].ranges[range] = data.stacks[0];
            for (let i = 0; i < missingRanges[range].length; i++) {
                const glyphID = missingRanges[range][i];
                const glyph = stack.glyphs[glyphID];
                const rect  = atlas.addGlyph(uid, fontstack, glyph, buffer);
                if (glyph) glyphs[glyphID] = new SimpleGlyph(glyph, rect, buffer);
            }

            remaining--;
            if (!remaining) callback(undefined, glyphs, fontstack);
        };

        for (const r in missingRanges) {
            this.loadRange(fontstack, r, onRangeLoaded);
        }
    }

    createTinySDF(fontFamily, fontWeight) {
        return  new TinySDF(24, 3, 8, .25, fontFamily, fontWeight);
    }

    loadCJKGlyph(fontstack, glyphID) {
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
            tinySDF = this.tinySDFs[fontstack] = this.createTinySDF(this.localIdeographFontFamily, fontWeight);
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

    loadPBF(url, callback) {
        ajax.getArrayBuffer(url, callback);
    }

    loadRange(fontstack, range, callback) {
        if (range * 256 > 65535) return callback('glyphs > 65535 not supported');

        if (this.loading[fontstack] === undefined) {
            this.loading[fontstack] = {};
        }
        const loading = this.loading[fontstack];

        if (loading[range]) {
            loading[range].push(callback);
        } else {
            loading[range] = [callback];

            const rangeName = `${range * 256}-${range * 256 + 255}`;
            const url = glyphUrl(fontstack, rangeName, this.url);

            this.loadPBF(url, (err, response) => {
                const glyphs = !err && new Glyphs(new Protobuf(response.data));
                for (let i = 0; i < loading[range].length; i++) {
                    loading[range][i](err, range, glyphs);
                }
                delete loading[range];
            });
        }
    }

    getGlyphAtlas(fontstack) {
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
