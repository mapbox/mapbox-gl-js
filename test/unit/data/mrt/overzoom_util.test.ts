import {describe, test, expect} from '../../../util/vitest';
import {computeOverzoomCoords, crop, MRTOverzoomError} from '../../../../src/data/mrt/overzoom_util';

describe('computeOverzoomCoords', () => {
    test('returns zero offset and unchanged tileSize when source equals destination', () => {
        const result = computeOverzoomCoords(256, {x: 1, y: 2, z: 4}, {x: 1, y: 2, z: 4});
        expect(result.offset).toEqual([0, 0]);
        expect(result.tileSize).toBe(256);
        expect(result.deltaZ).toBe(0);
    });

    test('one zoom level: tileSize halves and offset matches child index in parent', () => {
        // Source z4 tile (10, 10). Destination z5 tile (21, 20) is in the parent's
        // (1, 0) sub-quadrant, so offset should be [128, 0] of a 256 tile.
        const result = computeOverzoomCoords(256, {x: 10, y: 10, z: 4}, {x: 21, y: 20, z: 5});
        expect(result.offset).toEqual([128, 0]);
        expect(result.tileSize).toBe(128);
        expect(result.deltaZ).toBe(1);
    });

    test('matches server-side mrt-overzoom for a known z4->z8 case', () => {
        // Same fixture used by docs in MRT-OVERZOOMING.md
        // tileSize=256, source 4/10/10, destination 8/169/162
        const result = computeOverzoomCoords(256, {x: 10, y: 10, z: 4}, {x: 169, y: 162, z: 8});
        // x_in_parent = 169 - (10 << 4) = 169 - 160 = 9
        // y_in_parent = 162 - (10 << 4) = 162 - 160 = 2
        // outTileSize = 256 >> 4 = 16
        // offset = [9 * 16, 2 * 16] = [144, 32]
        expect(result.offset).toEqual([144, 32]);
        expect(result.tileSize).toBe(16);
        expect(result.deltaZ).toBe(4);
    });

    test('handles 512px tiles', () => {
        const result = computeOverzoomCoords(512, {x: 0, y: 0, z: 0}, {x: 3, y: 1, z: 2});
        // outTileSize = 512 >> 2 = 128, offset = [3*128, 1*128] = [384, 128]
        expect(result.offset).toEqual([384, 128]);
        expect(result.tileSize).toBe(128);
        expect(result.deltaZ).toBe(2);
    });

    test('throws MRTOverzoomError when destination zoom is less than source zoom', () => {
        expect(() => computeOverzoomCoords(256, {x: 0, y: 0, z: 5}, {x: 0, y: 0, z: 4}))
            .toThrow(MRTOverzoomError);
    });

    test('throws MRTOverzoomError when destination is not a child of source', () => {
        // z4 tile (10, 10) -> z5 tile (1, 1) is in a different parent
        expect(() => computeOverzoomCoords(256, {x: 10, y: 10, z: 4}, {x: 1, y: 1, z: 5}))
            .toThrow(MRTOverzoomError);
    });

    test('clamps gracefully at the max overzoom limit (deltaZ == log2(tileSize))', () => {
        // 256px tile, deltaZ = 8 -> outTileSize = 1
        const result = computeOverzoomCoords(256, {x: 0, y: 0, z: 0}, {x: 12, y: 5, z: 8});
        expect(result.tileSize).toBe(1);
        // x=12, y=5 within parent at z0; outTileSize=1 -> offset = [12, 5]
        expect(result.offset).toEqual([12, 5]);
        expect(result.deltaZ).toBe(8);
    });

    test('clamps beyond max overzoom without throwing (deltaZ > log2(tileSize))', () => {
        // 256px tile, deltaZ = 10. Server-side mrt-overzoom would throw.
        // Client clamps: effectiveDeltaZ = 8, subPixelShift = 2, outTileSize = 1.
        // dest (0/0/10) is within parent (0/0/0), x = 0 - (0 << 10) = 0, y = 0.
        // offset = [(0 >> 2) * 1, (0 >> 2) * 1] = [0, 0]
        const result = computeOverzoomCoords(256, {x: 0, y: 0, z: 0}, {x: 0, y: 0, z: 10});
        expect(result.tileSize).toBe(1);
        expect(result.offset).toEqual([0, 0]);
        expect(result.deltaZ).toBe(10);
    });

    test('clamp maps far-overzoomed coordinates to the correct parent pixel', () => {
        // 256px tile, source z=0, dest z=12 (deltaZ=12, clamped to 8).
        // x = 0b101100000000 (2816 in decimal) within parent.
        // With subPixelShift = 4, x >> 4 = 0b10110000 = 176, outTileSize = 1.
        // So offset.x = 176 — i.e. the pixel of the parent at the upper bits.
        const result = computeOverzoomCoords(256, {x: 0, y: 0, z: 0}, {x: 2816, y: 1024, z: 12});
        expect(result.tileSize).toBe(1);
        expect(result.offset).toEqual([176, 64]);
        expect(result.deltaZ).toBe(12);
    });

    test('clamp does not affect deltaZ <= log2(tileSize)', () => {
        // Sanity: behavior at the exact limit equals math without clamp.
        const r1 = computeOverzoomCoords(256, {x: 5, y: 5, z: 4}, {x: 5 << 7, y: 5 << 7, z: 11});
        // deltaZ = 7 (still <= 8). outTileSize = 256 >> 7 = 2.
        // x_in_parent = (5 << 7) - (5 << 7) = 0, y same.
        expect(r1.tileSize).toBe(2);
        expect(r1.offset).toEqual([0, 0]);
        expect(r1.deltaZ).toBe(7);
    });
});

describe('crop', () => {
    function makeImage(size: number, fill: (i: number) => number): Uint8Array {
        // RGBA, single band, no buffer.
        const out = new Uint8Array(size * size * 4);
        for (let i = 0; i < out.length; i++) out[i] = fill(i);
        return out;
    }

    test('identity crop returns the same bytes', () => {
        const data = makeImage(4, i => i);
        const cropped = crop(data, [1, 4, 4, 4], [1, 4, 4, 4], [0, 0]);
        expect(Array.from(cropped)).toEqual(Array.from(data));
    });

    test('extracts the correct rectangular region for a known offset', () => {
        // 4x4 RGBA. Each pixel's value = (row * 4 + col) for all 4 channels, so we
        // can easily eyeball which pixels we expect.
        const data = new Uint8Array(4 * 4 * 4);
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const pixel = row * 4 + col;
                for (let c = 0; c < 4; c++) {
                    data[(row * 4 + col) * 4 + c] = pixel;
                }
            }
        }

        // Crop a 2x2 region starting at (1, 1).
        const cropped = crop(data, [1, 4, 4, 4], [1, 2, 2, 4], [1, 1]);

        // Expected pixel ids:
        //  row 1, col 1 = 5; row 1, col 2 = 6
        //  row 2, col 1 = 9; row 2, col 2 = 10
        const pixelIds = [
            cropped[0], cropped[4],
            cropped[8], cropped[12],
        ];
        expect(pixelIds).toEqual([5, 6, 9, 10]);
    });

    test('supports uint16 dtype', () => {
        const data = new Uint16Array(16);
        for (let i = 0; i < data.length; i++) data[i] = i * 100;

        // 4x4, 1 component, no bands. Crop the top-left 2x2.
        const cropped = crop(data, [1, 4, 4, 1], [1, 2, 2, 1], [0, 0]);
        expect(cropped).toBeInstanceOf(Uint16Array);
        expect(Array.from(cropped)).toEqual([0, 100, 400, 500]);
    });

    test('supports uint32 dtype', () => {
        const data = new Uint32Array(16);
        for (let i = 0; i < data.length; i++) data[i] = i;

        const cropped = crop(data, [1, 4, 4, 1], [1, 2, 2, 1], [2, 2]);
        expect(cropped).toBeInstanceOf(Uint32Array);
        // Rows 2-3, cols 2-3 -> indices 10, 11, 14, 15.
        expect(Array.from(cropped)).toEqual([10, 11, 14, 15]);
    });

    test('handles multi-band data independently', () => {
        // 2 bands, 2x2 RGBA. Band 0 = 0x10..., band 1 = 0x20...
        const bandLen = 2 * 2 * 4;
        const data = new Uint8Array(2 * bandLen);
        for (let i = 0; i < bandLen; i++) data[i] = 0x10;
        for (let i = 0; i < bandLen; i++) data[bandLen + i] = 0x20;

        const cropped = crop(data, [2, 2, 2, 4], [2, 2, 2, 4], [0, 0]);

        // Both bands fully preserved.
        const cropArr = Array.from(cropped);
        const band0 = cropArr.slice(0, bandLen);
        const band1 = cropArr.slice(bandLen);
        expect(band0.every(v => v === 0x10)).toBe(true);
        expect(band1.every(v => v === 0x20)).toBe(true);
    });
});
