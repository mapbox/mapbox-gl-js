'use strict';

const test = require('mapbox-gl-js-test').test;
const GlyphSource = require('../../../src/symbol/glyph_source');
const fs = require('fs');

const mockTinySDF = {
    // Return empty 30x30 bitmap (24 fontsize + 3 * 2 buffer)
    draw: function () { return new Uint8ClampedArray(900); }
};

function createSource(t, localIdeographFontFamily) {
    const aPBF = fs.readFileSync('./test/fixtures/0-255.pbf');
    const source = new GlyphSource("https://localhost/fonts/v1{fontstack}/{range}.pbf", localIdeographFontFamily);
    t.stub(source, 'createTinySDF').returns(mockTinySDF);
    // It would be better to mock with FakeXMLHttpRequest, but the binary encoding
    // doesn't survive the mocking
    source.loadPBF = function(url, callback) {
        callback(null, { data: aPBF });
    };

    return source;
}


test('GlyphSource', (t) => {
    t.test('requests 0-255 PBF', (t) => {
        const source = createSource(t);
        source.getSimpleGlyphs("Arial Unicode MS", [55], 0, (err, glyphs, fontName) => {
            t.notOk(err);
            t.equal(fontName, "Arial Unicode MS");
            t.equal(glyphs['55'].advance, 12);
            t.end();
        });
    });

    t.test('requests remote CJK PBF', (t) => {
        const source = createSource(t);
        source.getSimpleGlyphs("Arial Unicode MS", [0x5e73], 0, (err, glyphs, fontName) => {
            t.notOk(err);
            t.equal(fontName, "Arial Unicode MS");
            t.notOk(Object.keys(glyphs).length); // The fixture returns a PBF without the glyph we requested
            t.end();
        });

    });

    t.test('locally generates CJK PBF', (t) => {
        const source = createSource(t, 'sans-serif');
        source.getSimpleGlyphs("Arial Unicode MS", [0x5e73], 0, (err, glyphs, fontName) => {
            t.notOk(err);
            t.equal(fontName, "Arial Unicode MS");
            t.equal(glyphs['24179'].advance, 24);
            t.end();
        });
    });

    t.end();
});
