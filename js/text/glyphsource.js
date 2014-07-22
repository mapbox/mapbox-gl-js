'use strict';

var getArrayBuffer = require('../util/ajax.js').getArrayBuffer;
var Glyphs = require('../format/glyphs.js');
var Protobuf = require('pbf');

module.exports = GlyphSource;

function GlyphSource(url, glyphAtlas) {
    this.url = url;
    this.glyphAtlas = glyphAtlas;
    this.stacks = {};
    this.loading = {};
}

GlyphSource.prototype.getRects = function(fontstack, glyphIDs, tileID, callback) {

    if (this.stacks[fontstack] === undefined) this.stacks[fontstack] = {};

    var rects = {};
    var glyphs = {};
    var result = { rects: rects, glyphs: glyphs };

    var stack = this.stacks[fontstack];
    var glyphAtlas = this.glyphAtlas;

    var missing = {};
    var remaining = 0;

    for (var i = 0; i < glyphIDs.length; i++) {
        var glyphID = glyphIDs[i];
        var range = Math.floor(glyphID / 256);

        if (stack[range]) {
            var glyph = stack[range].glyphs[glyphID];
            var buffer = 3;
            rects[glyphID] = glyphAtlas.addGlyph(tileID, fontstack, glyph, buffer);
            if (glyph) glyphs[glyphID] = simpleGlyph(glyph);
        } else {
            if (missing[range] === undefined) {
                missing[range] = [];
                remaining++;
            }
            missing[range].push(glyphID);
        }
    }

    if (!remaining) callback(undefined, result);

    var glyphSource = this;
    for (var r in missing) {
        this.loadRange(fontstack, r, onRangeLoaded);
    }

    function onRangeLoaded(err, range, data) {
        // TODO not be silent about errors
        if (!err) {
            var stack = glyphSource.stacks[fontstack][range] = data.stacks[fontstack];
            for (var i = 0; i < missing[range].length; i++) {
                var glyphID = missing[range][i];
                var glyph = stack.glyphs[glyphID];
                var buffer = 3;
                rects[glyphID] = glyphAtlas.addGlyph(tileID, fontstack, glyph, buffer);
                if (glyph) glyphs[glyphID] = simpleGlyph(glyph);
            }
        }
        remaining--;
        if (!remaining) callback(undefined, result);
    }
};

function simpleGlyph(glyph) {
    return {
        advance: glyph.advance,
        left: glyph.left,
        top: glyph.top
    };
}

GlyphSource.prototype.loadRange = function(fontstack, range, callback) {

    if (range * 256 >= 65280) return callback('gyphs > 65280 not supported');

    if (this.loading[fontstack] === undefined) this.loading[fontstack] = {};
    var loading = this.loading[fontstack];

    if (loading[range]) {
        loading[range].push(callback);
    } else {
        loading[range] = [callback];

        var rangeName = (range * 256) + '-' + (range * 256 + 255);
        var url = glyphUrl(fontstack, rangeName, this.url);

        getArrayBuffer(url, function(err, data) {
            if (err) return callback(err);
            var glyphs = new Glyphs(new Protobuf(new Uint8Array(data)));
            for (var i = 0; i < loading[range].length; i++) {
                loading[range][i](undefined, range, glyphs);
            }
            delete loading[range][i];
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
