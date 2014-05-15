'use strict';

var opentype = require('opentype.js');
var glyphToSDF = require('./sdf.js');
var actor = require('../worker/worker.js');

module.exports = {
    whenLoaded: ready,
    shape: shape,
    loadRects: loadRects,
    setRects: setRects,
    setFonts: setFonts
};

var styleFonts;
var fonts = module.exports.fonts = {};
var loading = {};
var onload = {};

var globalFaces = {};

function setFonts(newfonts) {
    styleFonts = fonts;
    for (var name in newfonts) {
        if (!fonts[name] && !loading[name]) {
            loadFont(name, newfonts[name]);
        }
    }
}

function loadFont(name, url) {
    loading[name] = url;
    onload[name] = [];
    opentype.load(url, function(err, f) {
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

// callback called when the font has been loaded
function ready(name, callback) {
    if (fonts[name]) {
        return callback();
    } else if (loading[name]) {
        onload[name].push(callback);
    } else {
        return callback();
        //return callback("Font not recognized");
    }
}

function shape(text, name, faces) {

    if (faces[name] === undefined) {
        if (globalFaces[name] === undefined) {
            globalFaces[name] = { glyphs: {}, rects: {}, missingRects: {}, waitingRects: {} };
        }
        faces[name] = globalFaces[name];
    }

    var font = fonts[name];
    var face = faces[name];
    var shaping = [];

    var x = 0;
    var y = 0;
    var fontSize = 24;
    var fontScale = fontSize / font.unitsPerEm;

    font.forEachGlyph(text, x, y, fontSize, undefined, function(glyph, x) {
        var id = glyph.index;

        if (id === 0) return;

        // sdf for this glyph has not yet been created
        if (!face.rects[id]) face.missingRects[id] = true;

        face.glyphs[id] = {
            id: id,
            glyph: glyph,
            advance: Math.round(glyph.advanceWidth * fontScale),

            left: Math.round(glyph.xMin * fontScale),
            top: Math.ceil(glyph.yMax * fontScale) - fontSize,
            width: Math.round((glyph.xMax - glyph.xMin) * fontScale),
            height: Math.ceil((glyph.yMax - glyph.yMin) * fontScale)

        };

        shaping.push({
            face: name,
            glyph: id,
            x: x,
            y: 0,
        });
    });

    return shaping;
}

function loadRects(name, faces, callback) {

    var face = faces[name];

    var missingGlyphs = {};
    var missingRects = face.missingRects;
    var waitingRects = face.waitingRects;
    var font = fonts[name];
    var fontScale = 24 / font.unitsPerEm;

    // Create sdfs for missing glyphs
    for (var glyphID in missingRects) {
        if (face.rects[glyphID] || waitingRects[glyphID]) continue;
        var glyph = face.glyphs[glyphID];
        var buffer = 3;
        var sdf = glyphToSDF(glyph.glyph, fontScale, 6, buffer);
        glyph.width = sdf.width - 2 * buffer;
        glyph.height = sdf.height - 2 * buffer;
        glyph.bitmap =  new Uint8Array(sdf.buffer);
        missingGlyphs[glyphID] = glyph;
        waitingRects[glyphID] = true;

        // We never check if some other work is rendering these glyphs.
        // This is fine, except it might be slower.
    }

    face.missingRects = {};

    var f = {};
    f[name] = { glyphs: missingGlyphs };

    actor.send('add glyphs', {
        faces: f,
        id: -1
    }, function(err, rects) {
        if (err) return callback(err);
        setRects(rects);
        callback();
    });
}

// Add rects for sdfs rendered in different workers
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
