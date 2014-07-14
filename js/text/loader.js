'use strict';

var GlyphTile = require('../worker/glyphtile.js');

module.exports = {
    whenLoaded: ready
};

var stacks = module.exports.stacks = {};
var loading = {};
var onload = {};

// After a required range is loaded, trigger callback if all required
// ranges have been loaded.
function rangeLoaded(fontstack, ranges, callback) {
    return function() {
        var numRanges = ranges.length;

        for (var i = 0; i < ranges.length; i++) {
            if (stacks[fontstack] &&
                stacks[fontstack].ranges[ranges[i]]) {
                numRanges = numRanges - 1;
            }
        }

        // All required glyph ranges have been loaded.
        if (numRanges === 0) {
            callback();
            return true;
        }
    };
}

function glyphUrl(fontstack, range, url, subdomains) {
    subdomains = subdomains || 'abc';

    return url
        .replace('{s}', subdomains[fontstack.length % subdomains.length])
        .replace('{fontstack}', fontstack)
        .replace('{range}', range);
}

function loadGlyphRange(tile, fontstack, range, actor, callback) {
    if (!tile.glyphs) return callback('no glyph source specified in style');

    loading[fontstack] = loading[fontstack] || {};
    loading[fontstack][range] = true;

    onload[fontstack] = onload[fontstack] || {};
    onload[fontstack][range] = [callback];

    var url = glyphUrl(fontstack, range, tile.glyphs);

    new GlyphTile(url, actor, function(err, glyphs) {
        if (!err) {
            stacks[fontstack] = stacks[fontstack] || {
                ranges: {},
                glyphs: {}
            };

            stacks[fontstack].ranges[range] = true;

            for (var id in glyphs) {
                stacks[fontstack].glyphs[id] = glyphs[id];
            }
        }

        onload[fontstack][range].forEach(function(cb) {
            cb(err);
        });

        delete loading[fontstack][range];
        if (Object.keys(loading[fontstack]).length === 0) delete loading[fontstack];

        delete onload[fontstack][range];
        if (Object.keys(onload[fontstack]).length === 0) delete onload[fontstack];
    });
}

// Callback called when the font has been loaded.
function ready(tile, fontstack, ranges, actor, callback) {
    if (!ranges.length) callback();

    var loaded = rangeLoaded(fontstack, ranges, callback);
    var range;

    for (var i = 0; i < ranges.length; i++) {
        range = ranges[i];

        if (stacks[fontstack] && stacks[fontstack].ranges[range]) {
            if (loaded()) return;
        } else if (loading[fontstack] && loading[fontstack][range]) {
            onload[fontstack][range].push(loaded);
        } else {
            loadGlyphRange(tile, fontstack, range, actor, loaded);
        }
    }
}
