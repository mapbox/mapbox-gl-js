'use strict';

// var actor = require('../worker/worker.js');
var GlyphTile = require('../worker/glyphtile.js');

module.exports = {
    whenLoaded: ready,
    setRects: setRects,
    setFonts: setFonts,
    setGlyphRange: setGlyphRange
};

var fonts = module.exports.fonts = {};
var loading = {};
var onload = {};

var stacks = module.exports.stacks = {};

var globalFaces = {};
var globalStacks = {};

function setFonts(newfonts) {
    for (var name in newfonts) {
        if (!fonts[name] && !loading[name]) {
            loadFont(name, newfonts[name]);
        }
    }
}

function loadFont(name, url) {
    loading[name] = url;
    onload[name] = [];
    new GlyphTile(url, function(err, f) {
        if (!err) fonts[name] = f;
        onload[name].forEach(function(callback) {
            window.setTimeout(function() {
                callback(err);
            });
        });
        delete loading[name];
        delete onload[name];
    });
}

function glyphUrl(fontstack, range, template, subdomains) {
    subdomains = subdomains || 'abc';

    var split = range.split("-");
    var min = split[0];
    var max = split[1];

    return template
        .replace('{s}', subdomains[Math.floor((min + max) % subdomains.length)])
        .replace(/(\/v[0-9]*)\/.*$/, '$1/glyph/' + fontstack + '/' + range + '.pbf');
}

function loadGlyphRange(tile, fontstack, range, callback) {
    loading[fontstack] = loading[fontstack] || {};
    onload[fontstack] = onload[fontstack] || {};
    onload[fontstack][range] = [callback];

    var url = glyphUrl(fontstack, range, tile.source.options.url);

    new GlyphTile(url, function(err, f) {
        if (!err) {
            stacks[fontstack] = stacks[fontstack] || {};
            stacks[fontstack][range] = f;
        }

        onload[fontstack][range].forEach(function(cb) {
            window.setTimeout(function() {
                cb(err);
            });
        });

        delete loading[fontstack][range];
        if (Object.keys(loading[fontstack]).length === 0) delete loading[fontstack];

        delete onload[fontstack][range];
        if (Object.keys(onload[fontstack]).length === 0) delete onload[fontstack];
    });
}

// After a required range is loaded, trigger callback if all required
// ranges have been loaded.
function rangeLoaded(fontstack, ranges, callback) {
    return function() {
        var numRanges = ranges.length;

        for (var i; i < ranges.length; i++) {
            if (stacks[fontstack] && stacks[fontstack][ranges[i]]) {
                --numRanges;
            }
        }

        // All required glyph ranges have been loaded.
        if (numRanges === 0) callback();
    };
}

// Callback called when the font has been loaded.
function ready(tile, fontstack, ranges, callback) {
    var loaded = rangeLoaded(fontstack, ranges, callback);
    var range;

    for (var i; i < ranges.length; i++) {
        range = ranges[i];

        if (stacks[fontstack] && stacks[fontstack][range]) {
            loaded();
        } else if (loading[fontstack] && loading[fontstack][range]) {
            onload[fontstack][range].push(loaded);
        } else {
            loadGlyphRange(tile, fontstack, range, loaded);
        }
    }
}

// Add rects for SDFs rendered in different workers.
function setRects(rects) {
    for (var name in rects) {
        if (!globalFaces[name]) {
            globalFaces[name] = { glyphs: {}, rects: {}, missingRects: {}, waitingRects: {} };
        }

        var faceRects = globalFaces[name].rects;
        for (var id in rects[name]) {
            faceRects[id] = rects[name][id];
            delete globalFaces[name].waitingRects[id];
        }
    }
}

// Add glyph ranges loaded by different workers.
function setGlyphRange(params) {
    var name = params.name;
    var glyphs = params.glyphs;

    debugger;

    if (!globalStacks[name]) {
        globalStacks[name] = { glyphs: {}, rects: {}, missingRects: {}, waitingRects: {} };
    }

    var fontstackRects = globalStacks[name].rects;
    for (var id in glyphs) {
        fontstackRects[id] = glyphs[id];
        delete globalStacks[name].waitingRects[id];
    }
}
