'use strict';

const test = require('mapbox-gl-js-test').test;
const {DEMData, Level} = require('../../../src/data/dem_data');
const {RGBAImage} = require('../../../src/util/image');

function createMockImage(height, width) {
    const pixels = new Uint8Array(height * width * 4);
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] = (i + 1) % 4 === 0 ? 1 : Math.floor(Math.random() * 256);
    }
    return RGBAImage.create({height: height, width: width}, pixels);
}

test('Level', (t)=>{

    t.test('constructor correctly creates Level', (t) => {
        const level = new Level(4, 4, 2);
        t.equal(level.height, 4);
        t.equal(level.width, 4);
        t.equal(level.border, 2);
        t.equal(level.stride, 8);

        t.deepEqual(level.data, new Int32Array(8 * 8));
        t.end();
    });

    t.test('constructor throws on ');

    t.test('setters and getters return correct values', (t) => {
        const level = new Level(4, 4, 2);

        t.deepEqual(level.data, new Int32Array(8 * 8));
        level.set(0, 0, 255);
        t.equal(level.get(0, 0), 255);
        t.end();
    });

    t.test('setters and getters throw for invalid data coordinates', (t) => {
        const level = new Level(4, 4, 2);

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
        t.equal(dem.data.length, 1, 'dem loads in data from typed array of pixel data');
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
        const data = [new Level(16, 16, 8, new Int32Array(32 * 32))];
        const dem = new DEMData(0, 1, data);
        t.equal(dem.data.length, 1);
        t.equal(dem.data[0].height, 16);
        t.equal(dem.data[0].border, 8);

        t.end();
    });

    t.end();
});


test('DEMData#backfillBorders', (t) => {
    const imageData0 = createMockImage(4, 4);
    const dem0 = new DEMData(0);
    const imageData1 = createMockImage(4, 4);
    const dem1 = new DEMData(1);

    dem0.loadFromImage(imageData0);
    dem1.loadFromImage(imageData1);

    t.test('border region is initially empty', (t)=>{
        const level0 = dem0.data[0];
        let nonempty = true;
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                if (level0.get(x, y) <= 0) {
                    nonempty = false;
                    break;
                }
            }
        }
        t.true(nonempty, 'pixel data is processed correctly into DEM');
        // vertical borders empty
        let empty = true;
        for (let x = -1; x < 5; x += 5) {
            for (let y = -1; y < 5; y++) {
                if (level0.get(x, y) !== -65536) {
                    empty = false;
                    break;
                }
            }
        }
        t.true(empty, 'vertical border of DEM data is initially empty');

        // horizontal borders empty
        empty = true;
        for (let y = -1; y < 5; y += 5) {
            for (let x = -1; x < 5; x++) {
                if (level0.get(x, y) !== -65536) {
                    empty = false;
                    break;
                }
            }
        }
        t.true(empty, 'horizontal border of DEM data is initially empty');

        t.end();
    });

    t.test('backfillBorders correctly populates neighboring border', (t)=>{
        const level0 = dem0.data[0];

        dem0.backfillBorders(dem1, -1, 0);
        for (let y = 0; y < 4; y++) {
            t.true(level0.get(-1, y) > 0, 'backfills neighbor -1, 0');
        }

        dem0.backfillBorders(dem1, 0, -1);
        for (let x = 0; x < 4; x++) {
            t.true(level0.get(x, -1) > 0, 'backfills neighbor 0, -1');
        }

        dem0.backfillBorders(dem1, 1, 0);
        for (let y = 0; y < 4; y++) {
            t.true(level0.get(1, y) > 0, 'backfills neighbor 1, 0');
        }

        dem0.backfillBorders(dem1, 0, 1);
        for (let x = 0; x < 4; x++) {
            t.true(level0.get(x, 1) > 0, 'backfills neighbor 0, 1');
        }

        dem0.backfillBorders(dem1, -1, 1);
        t.true(level0.get(-1, 1) > 0, 'backfills neighbor -1, 1');

        dem0.backfillBorders(dem1, 1, 1);
        t.true(level0.get(1, 1) > 0, 'backfills neighbor 1, 1');

        dem0.backfillBorders(dem1, -1, -1);
        t.true(level0.get(-1, -1) > 0, 'backfills neighbor -1, -1');

        dem0.backfillBorders(dem1, 1, -1);
        t.true(level0.get(1, -1) > 0, 'backfills neighbor -1, 1');


        t.end();
    });

    t.test('DEMData#serialize', (t)=>{
        const imageData0 = createMockImage(4, 4);
        const dem0 = new DEMData(0);

        dem0.loadFromImage(imageData0);

        const serialized = dem0.serialize();
        t.deepEqual(serialized, {
            uid: 0,
            scale: 1,
            levels: [new ArrayBuffer()]
        }, 'serializes DEM');


        const transferrables = [];
        dem0.serialize(transferrables);
        t.deepEqual(new Uint32Array(transferrables[0]), dem0.data[0].data, 'populates transferrables with correct data');

        t.end();
    });

    t.test('DEMData#deserialize', (t)=>{
        const imageData0 = createMockImage(4, 4);
        const dem0 = new DEMData(0);

        dem0.loadFromImage(imageData0);
        const serialized = dem0.serialize();

        const deserialized = DEMData.deserialize(serialized);
        t.deepEqual(deserialized, dem0, 'deserializes serialized DEMData instance');

        t.end();
    });


    t.end();
});





















