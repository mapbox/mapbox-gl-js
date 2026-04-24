// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi} from '../../util/vitest';
import {GlyphLoader} from '../../../src/style/glyph_loader';

import type {GlyphRange} from '../../../src/style/load_glyph_range';
import type {RequestManager} from '../../../src/util/mapbox';
import type {Callback} from '../../../src/types/callback';

const mockRequestManager = {
    transformRequest: (url: string) => ({url}),
    normalizeGlyphsURL: (url: string) => url
} as unknown as RequestManager;

const urlTemplate = 'https://api.mapbox.com/fonts/v1/{fontstack}/{range}.pbf';

function createMockGlyphRange(glyphIds: number[], ascender = 1000, descender = -200): GlyphRange {
    const glyphs: Record<number, {id: number; bitmap: {clone: () => object}; metrics: object}> = {};
    for (const id of glyphIds) {
        glyphs[id] = {
            id,
            bitmap: {clone: () => ({})},
            metrics: {width: 10, height: 10, left: 0, top: 0, advance: 12}
        };
    }
    return {glyphs, ascender, descender} as unknown as GlyphRange;
}

const createLoadGlyphRangeStub = (impl: typeof GlyphLoader.loadGlyphRange) => {
    return vi.spyOn(GlyphLoader, 'loadGlyphRange').mockImplementation(impl);
};

test('GlyphLoader defaults to client-side composition when constructed without options', async () => {
    const primaryData = createMockGlyphRange([65, 66]);
    const fallbackData = createMockGlyphRange([67]);
    const stub = createLoadGlyphRangeStub(
        (font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            setTimeout(() => {
                if (font === 'Primary') cb(null, primaryData);
                else cb(null, fallbackData);
            }, 0);
        }
    );

    const loader = new GlyphLoader();

    await new Promise<void>(resolve => {
        loader.loadGlyphRange('Primary,Fallback', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeTruthy();
            // Two per-font requests prove client-side composition was chosen, not a single server-side request.
            expect(stub).toHaveBeenCalledTimes(2);
            expect(stub).toHaveBeenCalledWith('Primary', 0, urlTemplate, mockRequestManager, expect.any(Function));
            expect(stub).toHaveBeenCalledWith('Fallback', 0, urlTemplate, mockRequestManager, expect.any(Function));
            resolve();
        });
    });
});

test('GlyphLoader loads single font directly', async () => {
    const mockData = createMockGlyphRange([65, 66, 67]);
    const stub = createLoadGlyphRangeStub(
        (_font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            setTimeout(cb, 0, null, mockData);
        }
    );

    const loader = new GlyphLoader({
        fontstackCompositing: 'client'
    });

    await new Promise<void>(resolve => {
        loader.loadGlyphRange('Arial Unicode MS', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeTruthy();
            expect(result.glyphs[65]).toBeTruthy();
            expect(result.glyphs[66]).toBeTruthy();
            expect(result.glyphs[67]).toBeTruthy();
            expect(stub).toHaveBeenCalledTimes(1);
            expect(stub).toHaveBeenCalledWith(
                'Arial Unicode MS', 0, urlTemplate, mockRequestManager, expect.any(Function)
            );
            resolve();
        });
    });
});

test('GlyphLoader performs client-side composition with multiple fonts', async () => {
    // First font has glyphs 65, 66
    const primaryData = createMockGlyphRange([65, 66], 1000, -200);
    // Second font has glyphs 66, 67, 68 (66 should be ignored as primary has it)
    const fallbackData = createMockGlyphRange([66, 67, 68], 900, -180);

    createLoadGlyphRangeStub(
        (font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            setTimeout(() => {
                if (font === 'Primary Font') {
                    cb(null, primaryData);
                } else if (font === 'Fallback Font') {
                    cb(null, fallbackData);
                }
            }, 0);
        }
    );

    const loader = new GlyphLoader({
        fontstackCompositing: 'client'
    });

    await new Promise<void>(resolve => {
        loader.loadGlyphRange('Primary Font,Fallback Font', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeTruthy();
            // Should have glyphs from both fonts
            expect(result.glyphs[65]).toBeTruthy(); // from primary
            expect(result.glyphs[66]).toBeTruthy(); // from primary (priority)
            expect(result.glyphs[67]).toBeTruthy(); // from fallback
            expect(result.glyphs[68]).toBeTruthy(); // from fallback
            // Ascender/descender should be from first font
            expect(result.ascender).toBe(1000);
            expect(result.descender).toBe(-200);
            resolve();
        });
    });
});

test('GlyphLoader deduplicates concurrent requests for same font/range', async () => {
    const mockData = createMockGlyphRange([65, 66]);
    let callCount = 0;

    createLoadGlyphRangeStub(
        (_font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            callCount++;
            setTimeout(cb, 10, null, mockData);
        }
    );

    const loader = new GlyphLoader({
        fontstackCompositing: 'client'
    });
    const results: Array<GlyphRange | null | undefined> = [];

    await new Promise<void>(resolve => {
        let completed = 0;
        const checkDone = () => {
            completed++;
            if (completed === 2) {
                expect(callCount).toBe(1); // Only one actual request
                expect(results[0]).toBeTruthy();
                expect(results[1]).toBeTruthy();
                resolve();
            }
        };

        // Two concurrent requests for the same font/range
        loader.loadGlyphRange('Arial', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            results.push(result);
            checkDone();
        });
        loader.loadGlyphRange('Arial', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            results.push(result);
            checkDone();
        });
    });
});

test('GlyphLoader deduplicates shared fallback fonts across different fontstacks', async () => {
    const primaryAData = createMockGlyphRange([65]);
    const primaryBData = createMockGlyphRange([66]);
    const sharedFallbackData = createMockGlyphRange([67, 68]);

    const requestedFonts: string[] = [];
    createLoadGlyphRangeStub(
        (font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            requestedFonts.push(font);
            setTimeout(() => {
                if (font === 'Primary A') cb(null, primaryAData);
                else if (font === 'Primary B') cb(null, primaryBData);
                else if (font === 'Shared Fallback') cb(null, sharedFallbackData);
            }, 0);
        }
    );

    const loader = new GlyphLoader({
        fontstackCompositing: 'client'
    });

    await new Promise<void>(resolve => {
        let completed = 0;
        const checkDone = () => {
            completed++;
            if (completed === 2) {
                // Shared Fallback should only be requested once
                const sharedFallbackCount = requestedFonts.filter(f => f === 'Shared Fallback').length;
                expect(sharedFallbackCount).toBe(1);
                // Total requests: Primary A, Primary B, Shared Fallback (once)
                expect(requestedFonts.length).toBe(3);
                resolve();
            }
        };

        loader.loadGlyphRange('Primary A,Shared Fallback', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result.glyphs[65]).toBeTruthy();
            expect(result.glyphs[67]).toBeTruthy();
            checkDone();
        });

        loader.loadGlyphRange('Primary B,Shared Fallback', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result.glyphs[66]).toBeTruthy();
            expect(result.glyphs[67]).toBeTruthy();
            checkDone();
        });
    });
});

test('GlyphLoader caches completed requests', async () => {
    const mockData = createMockGlyphRange([65]);
    let callCount = 0;

    createLoadGlyphRangeStub(
        (_font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            callCount++;
            setTimeout(cb, 0, null, mockData);
        }
    );

    const loader = new GlyphLoader({
        fontstackCompositing: 'client'
    });

    // First request
    await new Promise<void>(resolve => {
        loader.loadGlyphRange('Arial', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeTruthy();
            resolve();
        });
    });

    expect(callCount).toBe(1);

    // Second request for same font/range should use cache
    await new Promise<void>(resolve => {
        loader.loadGlyphRange('Arial', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeTruthy();
            resolve();
        });
    });

    expect(callCount).toBe(1); // No additional network request
});

test('GlyphLoader handles partial results when one font fails', async () => {
    const primaryData = createMockGlyphRange([65, 66]);

    createLoadGlyphRangeStub(
        (font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            setTimeout(() => {
                if (font === 'Primary Font') {
                    cb(null, primaryData);
                } else {
                    cb(new Error('Font not found'));
                }
            }, 0);
        }
    );

    const loader = new GlyphLoader({
        fontstackCompositing: 'client'
    });

    await new Promise<void>(resolve => {
        loader.loadGlyphRange('Primary Font,Missing Font', 0, urlTemplate, mockRequestManager, (err, result) => {
            // Should succeed with partial results
            expect(err).toBeFalsy();
            expect(result).toBeTruthy();
            expect(result.glyphs[65]).toBeTruthy();
            expect(result.glyphs[66]).toBeTruthy();
            resolve();
        });
    });
});

test('GlyphLoader returns error when all fonts fail', async () => {
    createLoadGlyphRangeStub(
        (_font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            setTimeout(() => cb(new Error('Font not found')), 0);
        }
    );

    const loader = new GlyphLoader({
        fontstackCompositing: 'client'
    });

    await new Promise<void>(resolve => {
        loader.loadGlyphRange('Missing Font,Also Missing', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeTruthy();
            expect(result).toBeFalsy();
            resolve();
        });
    });
});

test('GlyphLoader uses server composition when fontstackCompositing is \'server\'', async () => {
    const mockData = createMockGlyphRange([65, 66]);
    const stub = createLoadGlyphRangeStub(
        (_font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            setTimeout(cb, 0, null, mockData);
        }
    );

    const loader = new GlyphLoader({fontstackCompositing: 'server'});

    await new Promise<void>(resolve => {
        loader.loadGlyphRange('Primary,Fallback', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeTruthy();
            // With server composition, the full fontstack is passed as-is
            expect(stub).toHaveBeenCalledTimes(1);
            expect(stub).toHaveBeenCalledWith(
                'Primary,Fallback', 0, urlTemplate, mockRequestManager, expect.any(Function)
            );
            resolve();
        });
    });
});

test('GlyphLoader trims whitespace from font names', async () => {
    const mockData = createMockGlyphRange([65]);
    const stub = createLoadGlyphRangeStub(
        (_font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            setTimeout(cb, 0, null, mockData);
        }
    );

    const loader = new GlyphLoader({fontstackCompositing: 'client'});

    await new Promise<void>(resolve => {
        loader.loadGlyphRange('  Arial  ,  Fallback  ', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeTruthy();
            expect(stub).toHaveBeenCalledWith(
                'Arial', 0, urlTemplate, mockRequestManager, expect.any(Function)
            );
            expect(stub).toHaveBeenCalledWith(
                'Fallback', 0, urlTemplate, mockRequestManager, expect.any(Function)
            );
            resolve();
        });
    });
});

test('GlyphLoader uses ascender/descender from first font that provides them', async () => {
    // First font has no ascender/descender
    const primaryData: GlyphRange = {glyphs: {65: {} as GlyphRange['glyphs'][0]}};
    // Second font has ascender/descender
    const fallbackData = createMockGlyphRange([66], 950, -250);

    createLoadGlyphRangeStub(
        (font: string, _range: number, _url: string, _rm: RequestManager, cb: Callback<GlyphRange>) => {
            setTimeout(() => {
                if (font === 'Primary') cb(null, primaryData);
                else cb(null, fallbackData);
            }, 0);
        }
    );

    const loader = new GlyphLoader({
        fontstackCompositing: 'client'
    });

    await new Promise<void>(resolve => {
        loader.loadGlyphRange('Primary,Fallback', 0, urlTemplate, mockRequestManager, (err, result) => {
            expect(err).toBeFalsy();
            expect(result).toBeTruthy();
            // Should use fallback's values since primary didn't provide them
            expect(result.ascender).toBe(950);
            expect(result.descender).toBe(-250);
            resolve();
        });
    });
});
