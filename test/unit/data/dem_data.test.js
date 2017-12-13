'use strict';

const test = require('mapbox-gl-js-test').test;
const {DEMData, Level} = require('../../../src/data/dem_data');
const {RGBAImage} = require('../../../src/util/image');
const {serialize, deserialize} = require('../../../src/util/web_worker_transfer');

function createMockImage(height, width) {
    const pixels = new Uint8Array(height * width * 4);
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] = (i + 1) % 4 === 0 ? 1 : Math.floor(Math.random() * 256);
    }
    return new RGBAImage({height: height, width: width}, pixels);
}

test('Level', (t)=>{

    t.test('constructor correctly creates Level', (t) => {
        const level = new Level(4, 2);
        t.equal(level.dim, 4);
        t.equal(level.border, 2);
        t.equal(level.stride, 8);

        t.deepEqual(level.data, new Int32Array(8 * 8));
        t.end();
    });

    t.test('setters and getters return correct values', (t) => {
        const level = new Level(4, 2);

        t.deepEqual(level.data, new Int32Array(8 * 8));
        level.set(0, 0, 255);
        t.equal(level.get(0, 0), 255);
        t.end();
    });

    t.test('setters and getters throw for invalid data coordinates', (t) => {
        const level = new Level(4, 2);

        t.deepEqual(level.data, new Int32Array(8 * 8));
        t.throws(()=>level.set(20, 0, 255), 'out of range source coordinates for DEM data', 'detects and throws on invalid input');
        t.throws(()=>level.set(10, 20, 255), 'out of range source coordinates for DEM data', 'detects and throws on invalid input');

        t.end();
    });

    t.end();
});


test('DEMData constructor', (t) => {
    t.test('constructor', (t) => {
        const dem = new DEMData(0, 1);
        t.false(dem.loaded);
        t.equal(dem.uid, 0);

        dem.loadFromImage({width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4)});
        t.true(dem.level instanceof Level, 'dem loads in data from typed array of pixel data');
        t.end();
    });

    t.test('constructor defaults', (t) => {
        const dem = new DEMData(0);
        t.false(dem.loaded);
        t.equal(dem.uid, 0);
        t.equal(dem.scale, 1);

        t.end();
    });

    t.test('constructor with data', (t) => {
        const data = new Level(16, 8, new Int32Array(32 * 32));
        const dem = new DEMData(0, 1, data);
        t.equal(dem.level.dim, 16);
        t.equal(dem.level.border, 8);

        t.end();
    });

    t.end();
});


test('DEMData#backfillBorder', (t) => {
    const imageData0 = createMockImage(4, 4);
    const dem0 = new DEMData(0);
    const imageData1 = createMockImage(4, 4);
    const dem1 = new DEMData(1);

    dem0.loadFromImage(imageData0);
    dem1.loadFromImage(imageData1);

    t.test('border region is initially populated with neighboring data', (t)=>{
        const level0 = dem0.level;
        let nonempty = true;
        for (let x = -1; x < 5; x++) {
            for (let y = -1; y < 5; y++) {
                if (level0.get(x, y) === -65536) {
                    nonempty = false;
                    break;
                }
            }
        }
        t.true(nonempty, 'pixel data populates DEM data level');

        let verticalBorderMatch = true;
        for (const x of [-1, 4]) {
            for (let y = 0; y < 4; y++) {
                if (level0.get(x, y) !== level0.get(x < 0 ? x + 1 : x - 1, y)) {
                    verticalBorderMatch = false;
                    break;
                }
            }
        }
        t.true(verticalBorderMatch, 'vertical border of DEM data is initially equal to next column of data');

        // horizontal borders empty
        let horizontalBorderMatch = true;
        for (const y of [-1, 4]) {
            for (let x = 0; x < 4; x++) {
                if (level0.get(x, y) !== level0.get(x, y < 0 ? y + 1 : y - 1)) {
                    horizontalBorderMatch = false;
                    break;
                }
            }
        }
        t.true(horizontalBorderMatch, 'horizontal border of DEM data is initially equal to next row of data');

        t.true(level0.get(-1, 4) === level0.get(0, 3), '-1, 1 corner initially equal to closest corner data');
        t.true(level0.get(4, 4) === level0.get(3, 3), '1, 1 corner initially equal to closest corner data');
        t.true(level0.get(-1, -1) === level0.get(0, 0), '-1, -1 corner initially equal to closest corner data');
        t.true(level0.get(4, -1) === level0.get(3, 0), '-1, 1 corner initially equal to closest corner data');


        t.end();
    });

    t.test('backfillBorder correctly populates borders with neighboring data', (t)=>{
        const level0 = dem0.level;

        dem0.backfillBorder(dem1, -1, 0);
        for (let y = 0; y < 4; y++) {
            // dx = -1, dy = 0, so the left edge of dem1 should equal the right edge of dem0
            t.true(level0.get(-1, y) === dem1.level.get(3, y), 'backfills neighbor -1, 0');

        }

        dem0.backfillBorder(dem1, 0, -1);
        for (let x = 0; x < 4; x++) {
            t.true(level0.get(x, -1) === dem1.level.get(x, 3), 'backfills neighbor 0, -1');
        }

        dem0.backfillBorder(dem1, 1, 0);
        for (let y = 0; y < 4; y++) {
            t.true(level0.get(4, y) === dem1.level.get(0, y), 'backfills neighbor 1, 0');
        }

        dem0.backfillBorder(dem1, 0, 1);
        for (let x = 0; x < 4; x++) {
            t.true(level0.get(x, 4) === dem1.level.get(x, 0), 'backfills neighbor 0, 1');
        }

        dem0.backfillBorder(dem1, -1, 1);
        t.true(level0.get(-1, 4) === dem1.level.get(3, 0), 'backfills neighbor -1, 1');

        dem0.backfillBorder(dem1, 1, 1);
        t.true(level0.get(4, 4) === dem1.level.get(0, 0), 'backfills neighbor 1, 1');

        dem0.backfillBorder(dem1, -1, -1);
        t.true(level0.get(-1, -1) === dem1.level.get(3, 3), 'backfills neighbor -1, -1');

        dem0.backfillBorder(dem1, 1, -1);
        t.true(level0.get(4, -1) === dem1.level.get(0, 3), 'backfills neighbor -1, 1');


        t.end();
    });

    t.test('DEMData is correctly serialized', (t)=>{
        const imageData0 = createMockImage(4, 4);
        const dem0 = new DEMData(0);

        dem0.loadFromImage(imageData0);

        const serialized = serialize(dem0);

        t.deepEqual(serialized, {
            name: 'DEMData',
            properties: {
                uid: 0,
                scale: 1,
                level: {
                    name: 'Level',
                    properties: {
                        dim: 4,
                        border: 2,
                        stride: 8,
                        data: dem0.level.data,
                    }
                },
                loaded: true
            }
        }, 'serializes DEM');

        const transferrables = [];
        serialize(dem0, transferrables);
        t.deepEqual(new Uint32Array(transferrables[0]), dem0.level.data, 'populates transferrables with correct data');

        t.end();
    });

    t.test('DEMData is correctly deserialized', (t)=>{
        const imageData0 = createMockImage(4, 4);
        const dem0 = new DEMData(0);

        dem0.loadFromImage(imageData0);
        const serialized = serialize(dem0);

        const deserialized = deserialize(serialized);
        t.deepEqual(deserialized, dem0, 'deserializes serialized DEMData instance');

        t.end();
    });


    t.end();
});
