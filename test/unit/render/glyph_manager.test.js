import {test, expect, vi} from "../../util/vitest.js";
import parseGlyphPBF from '../../../src/style/parse_glyph_pbf.js';
import GlyphManager, {LocalGlyphMode} from '../../../src/render/glyph_manager.js';
// eslint-disable-next-line import/no-unresolved,import/extensions
import glyphStub from '/test/fixtures/0-255.pbf?arraybuffer';

const glyphData = {};
glyphData.glyphs = [];
const data = parseGlyphPBF(glyphStub);
glyphData.ascender = data.ascender;
glyphData.descender = data.descender;
for (const glyph of data.glyphs) {
    glyphData.glyphs[glyph.id] = glyph;
}

const identityTransform = (url) => ({url});

const TinySDF = class {
    constructor() {
        this.fontWeight = '400';
    }
    // Return empty 30x30 bitmap (24 fontsize + 3 * 2 buffer)
    draw() {
        return {
            data: new Uint8ClampedArray(900),
            glyphWidth: 48,
            glyphHeight: 48,
            width: 30,
            height: 30,
            glyphAdvance: 48
        };
    }
};

const createLoadGlyphRangeStub = () => {
    return vi.spyOn(GlyphManager, 'loadGlyphRange').mockImplementation((stack, range, urlTemplate, transform, callback) => {
        expect(stack).toEqual('Arial Unicode MS');
        expect(range).toEqual(0);
        expect(urlTemplate).toEqual('https://localhost/fonts/v1/{fontstack}/{range}.pbf');
        expect(transform).toEqual(identityTransform);
        setTimeout(() => callback(null, glyphData));
    });
};

const createGlyphManager = (font, allGlyphs) => {
    const manager = new GlyphManager(identityTransform,
        font ? (allGlyphs ? LocalGlyphMode.all : LocalGlyphMode.ideographs) : LocalGlyphMode.none,
        font);
    manager.setURL('https://localhost/fonts/v1/{fontstack}/{range}.pbf');
    return manager;
};

test('GlyphManager requests 0-255 PBF', async () => {
    createLoadGlyphRangeStub();
    const manager = createGlyphManager();

    await new Promise(resolve => {
        manager.getGlyphs({'Arial Unicode MS': [55]}, undefined, (err, result) => {
            expect(err).toBeFalsy();
            expect(result['Arial Unicode MS'].glyphs['55'].metrics.advance).toEqual(12);
            resolve();
        });
    });
});

test('GlyphManager doesn\'t request twice 0-255 PBF if a glyph is missing', async () => {
    const stub = createLoadGlyphRangeStub();
    const manager = createGlyphManager();

    await new Promise(resolve => {
        manager.getGlyphs({'Arial Unicode MS': [0.5]}, undefined, (err) => {
            expect(err).toBeFalsy();
            expect(manager.entries['Arial Unicode MS'].ranges[0]).toEqual(true);
            expect(stub).toHaveBeenCalledTimes(1);

            // We remove all requests as in getGlyphs code.
            delete manager.entries['Arial Unicode MS'].requests[0];

            manager.getGlyphs({'Arial Unicode MS': [0.5]}, undefined, (err) => {
                expect(err).toBeFalsy();
                expect(manager.entries['Arial Unicode MS'].ranges[0]).toEqual(true);
                expect(stub).toHaveBeenCalledTimes(1);
                resolve();
            });
        });
    });
});

test('GlyphManager requests remote CJK PBF', async () => {
    vi.spyOn(GlyphManager, 'loadGlyphRange').mockImplementation((stack, range, urlTemplate, transform, callback) => {
        setTimeout(() => callback(null, glyphData));
    });

    const manager = createGlyphManager();

    await new Promise(resolve => {
        manager.getGlyphs({'Arial Unicode MS': [0x5e73]}, undefined, (err, results) => {
            expect(err).toBeFalsy();
            expect(results['Arial Unicode MS'].glyphs[0x5e73]).toEqual(null); // The fixture returns a PBF without the glyph we requested
            resolve();
        });
    });
});

test('GlyphManager does not cache CJK chars that should be rendered locally', async () => {
    vi.spyOn(GlyphManager, 'loadGlyphRange').mockImplementation((stack, range, urlTemplate, transform, callback) => {
        const overlappingGlyphs = {};
        overlappingGlyphs.glyphs = [];
        overlappingGlyphs.ascender = glyphData.ascender;
        overlappingGlyphs.descender = glyphData.descender;
        const start = range * 256;
        const end = start + 256;
        for (let i = start, j = 0; i < end; i++, j++) {
            overlappingGlyphs.glyphs[i] = glyphData.glyphs[j];
        }
        setTimeout(() => callback(null, overlappingGlyphs));
    });
    vi.spyOn(GlyphManager, 'TinySDF', 'get').mockImplementation(() => TinySDF);
    const manager = createGlyphManager('sans-serif');

    await new Promise(resolve => {
        // Request char that overlaps Katakana range
        manager.getGlyphs({'Arial Unicode MS': [0x3005]}, undefined, (err, result) => {
            expect(err).toBeFalsy();
            expect(result['Arial Unicode MS'].glyphs[0x3005]).not.toEqual(null);
            // Request char from Katakana range (te)
            manager.getGlyphs({'Arial Unicode MS': [0x30C6]}, undefined, (err, result) => {
                expect(err).toBeFalsy();
                const glyph = result['Arial Unicode MS'].glyphs[0x30c6];
                // Ensure that te is locally generated.
                expect(glyph.bitmap.height).toEqual(30);
                expect(glyph.bitmap.width).toEqual(30);

                resolve();
            });
        });
    });
});

test('GlyphManager generates CJK PBF locally', async () => {
    vi.spyOn(GlyphManager, 'TinySDF', 'get').mockImplementation(() => TinySDF);

    const manager = createGlyphManager('sans-serif');

    await new Promise(resolve => {
        manager.getGlyphs({'Arial Unicode MS': [0x5e73]}, undefined, (err, result) => {
            expect(err).toBeFalsy();
            expect(result['Arial Unicode MS'].glyphs[0x5e73].metrics.advance).toEqual(24);
            resolve();
        });
    });
});

test('GlyphManager generates Katakana PBF locally', async () => {
    vi.spyOn(GlyphManager, 'TinySDF', 'get').mockImplementation(() => TinySDF);

    const manager = createGlyphManager('sans-serif');

    await new Promise(resolve => {
        // Katakana letter te
        manager.getGlyphs({'Arial Unicode MS': [0x30c6]}, undefined, (err, result) => {
            expect(err).toBeFalsy();
            expect(result['Arial Unicode MS'].glyphs[0x30c6].metrics.advance).toEqual(24);
            resolve();
        });
    });
});

test('GlyphManager generates Hiragana PBF locally', async () => {
    vi.spyOn(GlyphManager, 'TinySDF', 'get').mockImplementation(() => TinySDF);

    const manager = createGlyphManager('sans-serif');

    await new Promise(resolve => {
        // Hiragana letter te
        manager.getGlyphs({'Arial Unicode MS': [0x3066]}, undefined, (err, result) => {
            expect(err).toBeFalsy();
            expect(result['Arial Unicode MS'].glyphs[0x3066].metrics.advance).toEqual(24);
            resolve();
        });
    });
});

test('GlyphManager caches locally generated glyphs', async () => {
    let drawCallCount = 0;
    vi.spyOn(GlyphManager, 'TinySDF', 'get').mockImplementation(() => class {
        constructor() {
            this.fontWeight = '400';
        }
        // Return empty 30x30 bitmap (24 fontsize + 3 * 2 buffer)
        draw() {
            drawCallCount++;
            return {
                data: new Uint8ClampedArray(900),
                glyphWidth: 48,
                glyphHeight: 48,
                width: 30,
                height: 30,
                glyphAdvance: 48
            };
        }
    });

    const manager = createGlyphManager('sans-serif');

    await new Promise(resolve => {
        // Katakana letter te
        manager.getGlyphs({'Arial Unicode MS': [0x30c6]}, undefined, (err, result) => {
            expect(err).toBeFalsy();
            expect(result['Arial Unicode MS'].glyphs[0x30c6].metrics.advance).toEqual(24);
            manager.getGlyphs({'Arial Unicode MS': [0x30c6]}, undefined, () => {
                expect(drawCallCount).toEqual(1);
                resolve();
            });
        });
    });
});

test('GlyphManager locally generates latin glyphs', async () => {
    vi.spyOn(GlyphManager, 'TinySDF', 'get').mockImplementation(() => class {
        constructor() {
            this.fontWeight = '400';
        }
        // Return empty 20x24 bitmap (made up glyph size + 3 * 2 buffer)
        draw() {
            return {
                data: new Uint8ClampedArray(480),
                glyphWidth: 28,
                glyphHeight: 36,
                width: 20,
                height: 24,
                glyphAdvance: 20
            };
        }
    });

    const manager = createGlyphManager('sans-serif', true);

    await new Promise(resolve => {
        manager.getGlyphs({'Arial Unicode MS': [65]}, undefined, (err, result) => {
            expect(err).toBeFalsy();
            const glyphs = result['Arial Unicode MS'].glyphs;
            expect(glyphs[65].metrics.advance).toEqual(10);
            expect(glyphs[65].metrics.width).toEqual(14);
            expect(glyphs[65].metrics.height).toEqual(18);
            resolve();
        });
    });
});
