import {describe, test, expect, vi} from "../../util/vitest.js";
import DEMData from '../../../src/data/dem_data.js';
import {RGBAImage} from '../../../src/util/image.js';
import {serialize, deserialize} from '../../../src/util/web_worker_transfer.js';

function createMockImage(height, width) {
    // RGBAImage passed to constructor has uniform 1px padding on all sides.
    height += 2;
    width += 2;
    const pixels = new Uint8Array(height * width * 4);
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] = (i + 1) % 4 === 0 ? 1 : Math.floor(Math.random() * 256);
    }
    return new RGBAImage({height, width}, pixels);
}

describe('DEMData', () => {
    test('constructor', () => {
        const dem = new DEMData(0, {width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4)});
        expect(dem.uid).toEqual(0);
        expect(dem.dim).toEqual(2);
        expect(dem.stride).toEqual(4);
    });

    test('setters and getters throw for invalid data coordinates', () => {
        const dem = new DEMData(0, {width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4)});

        expect(() => dem.set(20, 0, 255)).toThrowError('out of range source coordinates for DEM data');
        expect(() => dem.set(10, 20, 255)).toThrowError('out of range source coordinates for DEM data');
    });

    test('loadFromImage with invalid encoding', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const dem = new DEMData(0, {width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4)}, "derp");
        expect(dem.uid).toEqual(0);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(
            console.warn.mock.calls[0][0]
        ).toMatch(/"derp" is not a valid encoding type/);
    });
});

describe('DEMData#backfillBorder', () => {
    const dem0 = new DEMData(0, createMockImage(4, 4));
    const dem1 = new DEMData(1, createMockImage(4, 4));

    test('border region is initially populated with neighboring data', () => {
        let nonempty = true;
        for (let x = -1; x < 5; x++) {
            for (let y = -1; y < 5; y++) {
                if (dem0.get(x, y) === -65536) {
                    nonempty = false;
                    break;
                }
            }
        }
        expect(nonempty).toBeTruthy();

        let verticalBorderMatch = true;
        for (const x of [-1, 4]) {
            for (let y = 0; y < 4; y++) {
                if (dem0.get(x, y) !== dem0.get(x < 0 ? x + 1 : x - 1, y)) {
                    verticalBorderMatch = false;
                    break;
                }
            }
        }
        expect(verticalBorderMatch).toBeTruthy();

        // horizontal borders empty
        let horizontalBorderMatch = true;
        for (const y of [-1, 4]) {
            for (let x = 0; x < 4; x++) {
                if (dem0.get(x, y) !== dem0.get(x, y < 0 ? y + 1 : y - 1)) {
                    horizontalBorderMatch = false;
                    break;
                }
            }
        }
        expect(horizontalBorderMatch).toBeTruthy();

        expect(dem0.get(-1, 4) === dem0.get(0, 3)).toBeTruthy();
        expect(dem0.get(4, 4) === dem0.get(3, 3)).toBeTruthy();
        expect(dem0.get(-1, -1) === dem0.get(0, 0)).toBeTruthy();
        expect(dem0.get(4, -1) === dem0.get(3, 0)).toBeTruthy();
    });

    test(
        'backfillBorder correctly populates borders with neighboring data',
        () => {
            dem0.backfillBorder(dem1, -1, 0);
            for (let y = 0; y < 4; y++) {
                // dx = -1, dy = 0, so the left edge of dem1 should equal the right edge of dem0
                expect(dem0.get(-1, y) === dem1.get(3, y)).toBeTruthy();

            }

            dem0.backfillBorder(dem1, 0, -1);
            for (let x = 0; x < 4; x++) {
                expect(dem0.get(x, -1) === dem1.get(x, 3)).toBeTruthy();
            }

            dem0.backfillBorder(dem1, 1, 0);
            for (let y = 0; y < 4; y++) {
                expect(dem0.get(4, y) === dem1.get(0, y)).toBeTruthy();
            }

            dem0.backfillBorder(dem1, 0, 1);
            for (let x = 0; x < 4; x++) {
                expect(dem0.get(x, 4) === dem1.get(x, 0)).toBeTruthy();
            }

            dem0.backfillBorder(dem1, -1, 1);
            expect(dem0.get(-1, 4) === dem1.get(3, 0)).toBeTruthy();

            dem0.backfillBorder(dem1, 1, 1);
            expect(dem0.get(4, 4) === dem1.get(0, 0)).toBeTruthy();

            dem0.backfillBorder(dem1, -1, -1);
            expect(dem0.get(-1, -1) === dem1.get(3, 3)).toBeTruthy();

            dem0.backfillBorder(dem1, 1, -1);
            expect(dem0.get(4, -1) === dem1.get(0, 3)).toBeTruthy();
        }
    );

    test('DEMData is correctly serialized', () => {
        const imageData0 = createMockImage(4, 4);
        const dem0 = new DEMData(0, imageData0);
        // eslint-disable-next-line no-unused-vars
        const {_modifiedForSources, _timestamp, ...serialized} = serialize(dem0);

        expect(serialized).toEqual({
            $name: 'DEMData',
            uid: 0,
            dim: 4,
            stride: 6,
            pixels: dem0.pixels,
            floatView: dem0.floatView,
            borderReady: false
        });

        const transferrables = new Set();
        serialize(dem0, transferrables);
        expect(transferrables.has(dem0.pixels.buffer)).toBeTruthy();
        expect(transferrables.has(dem0.floatView.buffer)).toBeTruthy();
    });

    test('DEMData is correctly deserialized', () => {
        const imageData0 = createMockImage(4, 4);
        const dem0 = new DEMData(0, imageData0);
        const serialized = serialize(dem0);

        const deserialized = deserialize(serialized);
        expect(deserialized).toEqual(dem0);
    });
});
