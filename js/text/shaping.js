'use strict';

var opentype = require('opentype.js');
var glyphToSDF = require('../../../sdf');
var actor = require('../worker/worker.js');

module.exports = {
    loaded: ready,
    shape: shape,
    loadRects: loadRects,
    setRects: setRects
};

var fonturl = '/debug/fonts/ubuntu-font-family-0.80/Ubuntu-R.ttf';

var globalFaces = {};
var loaded = false;
var onload = [];
var font;

var family = 'ubuntu'; // TODO unhardcode

opentype.load(fonturl, function(err, f) {
    if (err) throw('handle this properly');

    loaded = true;
    font = f;

    for (var i = 0; i < onload.length; i++) {
        self.setImmediate(onload[i]);
    }
});

function ready(callback) {
    if (loaded) return callback();
    else onload.push(callback);
}

function shape(text, faces) {

    if (faces[family] === undefined) {
        if (globalFaces[family] === undefined) {
            globalFaces[family] = { glyphs: {}, rects: {}, missingRects: {}, waitingRects: {} };
        }
        faces[family] = globalFaces[family];
    }

    var face = faces[family];
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
            face: family,
            glyph: id,
            x: x,
            y: 0,
        });
    });

    return shaping;
}

function loadRects(faces, callback) {

    var face = faces[family];

    var missingGlyphs = {};
    var missingRects = face.missingRects;
    var waitingRects = face.waitingRects;
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

    // TODO: what happens when this gets called again while it is waiting?
    face.missingRects = {};

    var f = {};
    f[family] = { glyphs: missingGlyphs };

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
