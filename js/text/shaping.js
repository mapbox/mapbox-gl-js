'use strict';

var opentype = require('opentype.js');
var glyphToSDF = require('../../../sdf');
var actor = require('../worker/worker.js');

module.exports = {
    loaded: ready,
    shape: shape,
    loadRects: loadRects
};

var fonturl = '/debug/fonts/ubuntu-font-family-0.80/Ubuntu-R.ttf';

var loaded = false;
var onload = [];
var font;

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


var family = 'ubuntu'; // TODO unhardcode
function shape(text, faces) {
    var x = 0;
    var y = 0;
    var fontSize = 24;

    var shaping = [];
    var fontScale = fontSize / font.unitsPerEm;

    if (faces[family] === undefined) {
        faces[family] = { glyphs: {}, rects: {}, missingRects: {} };
    }

    font.forEachGlyph(text, x, y, fontSize, undefined, function(glyph, x) {
        if (glyph.id === 0) return;
        if (!faces[family].rects[glyph.index]) {
            faces[family].missingRects[glyph.index] = true;
        }
        faces[family].glyphs[glyph.index] = {
            glyph: glyph,
            id: glyph.index,
            left: Math.round(glyph.xMin * fontScale),
            top: -fontSize + Math.ceil(glyph.yMax * fontScale),
            width: Math.round((glyph.xMax - glyph.xMin) * fontScale),
            height: Math.ceil((glyph.yMax - glyph.yMin) * fontScale),
            advance: Math.round(glyph.advanceWidth * fontScale)
        };
        shaping.push({
            face: family,
            glyph: glyph.index,
            glyph_: glyph,
            x: x,
            y: 0,
        });
    });

    return shaping;
}

// calculate missing glyph rects, generate sdf, send to main thread, receive rects, continue
// what happens when this gets called again while it is waiting?
// TODO support multiple faces
function loadRects(faces, callback) {
    var f = {};
    f[family] = { glyphs: {}};
    var missingRects = faces[family].missingRects;
    var fontScale = 24 / font.unitsPerEm;
    for (var glyphID in missingRects) {
        var glyph = faces[family].glyphs[glyphID];

        var buffer = 3;
        var sdf = glyphToSDF(glyph.glyph, fontScale, buffer);
        glyph.width = sdf.width - 2* buffer;
        glyph.height = sdf.height - 2* buffer;
        glyph.bitmap =  new Uint8Array(sdf.buffer);

        f[family].glyphs[glyphID] = glyph;
    }
    missingRects = {};

    actor.send('add glyphs', {
        faces: f,
        id: -1
    }, function(err, rects) {
        if (err) return callback(err);
        for (var i in rects[family]) {
            faces[family].rects[i] = rects[family][i];
        }
        callback();
    });
}
