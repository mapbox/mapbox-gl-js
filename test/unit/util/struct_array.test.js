'use strict';

const test = require('mapbox-gl-js-test').test;
const createStructArrayType = require('../../../src/util/struct_array');

test('StructArray', (t) => {

    const TestArray = createStructArrayType({
        members: [
            { type: 'Int16', name: 'map' },
            { type: 'Int16', name: 'box', components: 2 }
        ],
        alignment: 4
    });

    t.test('type defined', (t) => {

        t.deepEqual(TestArray.serialize(), {
            members: [{
                name: 'map',
                components: 1,
                type: 'Int16',
                offset: 0
            }, {
                name: 'box',
                components: 2,
                type: 'Int16',
                offset: 4
            }],
            bytesPerElement: 8,
            alignment: 4
        });

        t.end();
    });

    t.test('array constructs itself', (t) => {
        const array = new TestArray();

        t.equal(array.length, 0);
        t.equal(array.bytesPerElement, 8);
        t.ok(array.arrayBuffer);

        t.end();
    });

    t.test('emplaceBack', (t) => {
        const array = new TestArray();

        t.equal(0, array.emplaceBack(1, 7, 3));
        t.equal(1, array.emplaceBack(4, 2, 5));

        t.equal(array.length, 2);

        const e0 = array.get(0);
        t.equal(e0.map, 1);
        t.equal(e0.box0, 7);
        t.equal(e0.box1, 3);
        const e1 = array.get(1);
        t.equal(e1.map, 4);
        t.equal(e1.box0, 2);
        t.equal(e1.box1, 5);

        t.end();
    });

    t.test('emplaceBack gracefully accepts extra arguments', (t) => {
        // emplaceBack is typically used in fairly hot code paths, where
        // conditionally varying the number of arguments can be expensive.
        const array = new TestArray();
        t.equal(array.emplaceBack(3, 1, 4, 1, 5, 9), 0);
        t.equal(array.length, 1);
        const e0 = array.get(0);
        t.equal(e0.map, 3);
        t.equal(e0.box0, 1);
        t.equal(e0.box1, 4);
        t.end();
    });

    t.test('automatically resizes', (t) => {
        const array = new TestArray();
        const initialCapacity = array.capacity;

        while (initialCapacity > array.length) {
            array.emplaceBack(1, 1, 1);
        }

        t.equal(array.capacity, initialCapacity);

        array.emplaceBack(1, 1, 1);
        t.ok(array.capacity > initialCapacity);

        t.end();
    });

    t.test('trims', (t) => {
        const array = new TestArray();
        const capacityInitial = array.capacity;

        array.emplaceBack(1, 1, 1);
        t.equal(array.capacity, capacityInitial);

        array._trim();
        t.equal(array.capacity, 1);
        t.equal(array.arrayBuffer.byteLength, array.bytesPerElement);

        t.end();
    });

    t.test('toArray', (t) => {
        const array = new TestArray();

        array.emplaceBack(1, 7, 3);
        array.emplaceBack(4, 2, 5);

        const subArray = array.toArray(0, 1);

        t.equal(array.get(0).map0, subArray[0].map0);
        t.equal(array.get(0).box0, subArray[0].box0);
        t.equal(array.get(0).box1, subArray[0].box1);

        t.equal(subArray.length, 1);

        t.end();
    });

    t.end();
});
