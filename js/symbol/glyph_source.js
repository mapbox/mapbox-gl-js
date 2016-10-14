'use strict';

const normalizeURL = require('../util/mapbox').normalizeGlyphsURL;
const ajax = require('../util/ajax');
const Glyphs = require('../util/glyphs');
const GlyphAtlas = require('../symbol/glyph_atlas');
const Protobuf = require('pbf');

module.exports = GlyphSource;

/**
 * A glyph source has a URL from which to load new glyphs and manages
 * GlyphAtlases in which to store glyphs used by the requested fontstacks
 * and ranges.
 *
 * @param {string} url glyph template url
 * @private
 */
function GlyphSource(url) {
    this.url = url && normalizeURL(url);
    this.atlases = {};
    this.stacks = {};
    this.loading = {};
}

GlyphSource.prototype.getSimpleGlyphs = function(fontstack, glyphIDs, uid, callback) {
    if (this.stacks[fontstack] === undefined) {
        this.stacks[fontstack] = {};
    }
    if (this.atlases[fontstack] === undefined) {
        this.atlases[fontstack] = new GlyphAtlas();
    }

    const glyphs = {};
    const stack = this.stacks[fontstack];
    const atlas = this.atlases[fontstack];

    // the number of pixels the sdf bitmaps are padded by
    const buffer = 3;

    const missing = {};
    let remaining = 0;
    let range;

    for (let i = 0; i < glyphIDs.length; i++) {
        const glyphID = glyphIDs[i];
        range = Math.floor(glyphID / 256);

        if (stack[range]) {
            const glyph = stack[range].glyphs[glyphID];
            const rect  = atlas.addGlyph(uid, fontstack, glyph, buffer);
            if (glyph) glyphs[glyphID] = new SimpleGlyph(glyph, rect, buffer);
        } else {
            if (missing[range] === undefined) {
                missing[range] = [];
                remaining++;
            }
            missing[range].push(glyphID);
        }
    }

    if (!remaining) callback(undefined, glyphs, fontstack);

    const onRangeLoaded = function(err, range, data) {
        if (!err) {
            const stack = this.stacks[fontstack][range] = data.stacks[0];
            for (let i = 0; i < missing[range].length; i++) {
                const glyphID = missing[range][i];
                const glyph = stack.glyphs[glyphID];
                const rect  = atlas.addGlyph(uid, fontstack, glyph, buffer);
                if (glyph) glyphs[glyphID] = new SimpleGlyph(glyph, rect, buffer);
            }
        }
        remaining--;
        if (!remaining) callback(undefined, glyphs, fontstack);
    }.bind(this);

    for (const r in missing) {
        this.loadRange(fontstack, r, onRangeLoaded);
    }
};

// A simplified representation of the glyph containing only the properties needed for shaping.
function SimpleGlyph(glyph, rect, buffer) {
    const padding = 1;
    this.advance = glyph.advance;
    this.left = glyph.left - buffer - padding;
    this.top = glyph.top + buffer + padding;
    this.rect = rect;
}

GlyphSource.prototype.loadRange = function(fontstack, range, callback) {
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

        ajax.getArrayBuffer(url, function(err, data) {
            const glyphs = !err && new Glyphs(new Protobuf(data));
            for (let i = 0; i < loading[range].length; i++) {
                loading[range][i](err, range, glyphs);
            }
            delete loading[range];
        });
    }
};

GlyphSource.prototype.getGlyphAtlas = function(fontstack) {
    return this.atlases[fontstack];
};

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
