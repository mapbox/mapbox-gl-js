'use strict';

var normalizeURL = require('../util/mapbox').normalizeGlyphsURL;
var getArrayBuffer = require('../util/ajax').getArrayBuffer;
var Glyphs = require('../util/glyphs');
var Protobuf = require('pbf');

module.exports = GlyphSource;

function GlyphSource(url, glyphAtlas) {
    this.url = url && normalizeURL(url);
    this.glyphAtlas = glyphAtlas;
    this.stacks = [];
    this.loading = {};
}

GlyphSource.prototype.getSimpleGlyphs = function(fontstack, glyphIDs, uid, callback) {

    if (this.stacks[fontstack] === undefined) this.stacks[fontstack] = {};

    var glyphs = {};

    var stack = this.stacks[fontstack];
    var glyphAtlas = this.glyphAtlas;

    // the number of pixels the sdf bitmaps are padded by
    var buffer = 3;

    var missing = {};
    var remaining = 0;
    var range;

    for (var i = 0; i < glyphIDs.length; i++) {
        var glyphID = glyphIDs[i];
        range = Math.floor(glyphID / 256);

        if (stack[range]) {
            var glyph = stack[range].glyphs[glyphID];
            var rect  = glyphAtlas.addGlyph(uid, fontstack, glyph, buffer);
            if (glyph) glyphs[glyphID] = new SimpleGlyph(glyph, rect, buffer);
        } else {
            if (missing[range] === undefined) {
                missing[range] = [];
                remaining++;
            }
            missing[range].push(glyphID);
        }
    }

    if (!remaining) callback(undefined, glyphs);

    var onRangeLoaded = function(err, range, data) {
        // TODO not be silent about errors
        if (!err) {
            var stack = this.stacks[fontstack][range] = data.stacks[0];
            for (var i = 0; i < missing[range].length; i++) {
                var glyphID = missing[range][i];
                var glyph = stack.glyphs[glyphID];
                var rect  = glyphAtlas.addGlyph(uid, fontstack, glyph, buffer);
                if (glyph) glyphs[glyphID] = new SimpleGlyph(glyph, rect, buffer);
            }
        }
        remaining--;
        if (!remaining) callback(undefined, glyphs);
    }.bind(this);

    for (var r in missing) {
        this.loadRange(fontstack, r, onRangeLoaded);
    }
};

// A simplified representation of the glyph containing only the properties needed for shaping.
function SimpleGlyph(glyph, rect, buffer) {
    this.advance = glyph.advance;
    this.left = glyph.left - buffer;
    this.top = glyph.top + buffer;
    this.rect = rect;
}

GlyphSource.prototype.loadRange = function(fontstack, range, callback) {

    if (range * 256 > 65535) return callback('gyphs > 65535 not supported');

    if (this.loading[fontstack] === undefined) this.loading[fontstack] = {};
    var loading = this.loading[fontstack];

    if (loading[range]) {
        loading[range].push(callback);
    } else {
        loading[range] = [callback];

        var rangeName = (range * 256) + '-' + (range * 256 + 255);
        var url = glyphUrl(fontstack, rangeName, this.url);

        getArrayBuffer(url, function(err, data) {
            var glyphs = !err && new Glyphs(new Protobuf(new Uint8Array(data)));
            for (var i = 0; i < loading[range].length; i++) {
                loading[range][i](err, range, glyphs);
            }
            delete loading[range];
        });
    }
};

function glyphUrl(fontstack, range, url, subdomains) {
    subdomains = subdomains || 'abc';

    return url
        .replace('{s}', subdomains[fontstack.length % subdomains.length])
        .replace('{fontstack}', fontstack)
        .replace('{range}', range);
}
