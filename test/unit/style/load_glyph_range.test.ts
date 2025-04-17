// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi} from '../../util/vitest';
import {RequestManager} from '../../../src/util/mapbox';
import {loadGlyphRange} from '../../../src/style/load_glyph_range';
import glyphStub from '../../fixtures/0-255.pbf?arraybuffer';

test('loadGlyphRange', async () => {
    const transform = vi.fn().mockImplementation((url) => ({url}));
    const manager = new RequestManager(transform);

    let request: any;
    // eslint-disable-next-line @typescript-eslint/require-await
    vi.spyOn(window, 'fetch').mockImplementation(async (req) => {
        request = req;
        return new window.Response(glyphStub);
    });

    await new Promise(resolve => {

        loadGlyphRange('Arial Unicode MS', 0, 'https://localhost/fonts/v1/{fontstack}/{range}.pbf', manager, (err, result) => {
            expect(err).toBeFalsy();
            expect(transform).toHaveBeenCalledTimes(1);
            expect(transform.mock.calls[0]).toEqual(['https://localhost/fonts/v1/Arial Unicode MS/0-255.pbf', 'Glyphs']);

            if (!result) return expect.unreachable();
            expect(request.url).toEqual('https://localhost/fonts/v1/Arial%20Unicode%20MS/0-255.pbf');
            expect(typeof result.ascender).toEqual('undefined');
            expect(typeof result.descender).toEqual('undefined');
            expect(result.ascender).toEqual(undefined);
            expect(result.descender).toEqual(undefined);
            expect(Object.keys(result.glyphs).length).toEqual(223);
            for (const key in result.glyphs) {
                const id = Number(key);
                const glyph = result.glyphs[id];
                if (!glyph) return expect.unreachable();
                expect(glyph.id).toEqual(Number(id));
                expect(glyph.metrics).toBeTruthy();
                expect(typeof glyph.metrics.width).toEqual('number');
                expect(typeof glyph.metrics.height).toEqual('number');
                expect(typeof glyph.metrics.top).toEqual('number');
                expect(typeof glyph.metrics.advance).toEqual('number');
            }
            resolve();
        });
    });
});
