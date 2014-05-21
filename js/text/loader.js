'use strict';

// var actor = require('../worker/worker.js');
var GlyphTile = require('../worker/glyphtile.js');

module.exports = {
    whenLoaded: ready,
    setRects: setRects,
    setFonts: setFonts
};

var fonts = module.exports.fonts = {};
var loading = {};
var onload = {};

var globalFaces = {};

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

// Callback called when the font has been loaded.
function ready(name, callback) {
    debugger;
    if (fonts[name]) {
        return callback();
    } else if (loading[name]) {
        onload[name].push(callback);
    } else {
        return callback("Font not recognized.");
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
