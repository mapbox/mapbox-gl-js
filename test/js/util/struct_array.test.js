'use strict';

const test = require('mapbox-gl-js-test').test;
const createStructArrayType = require('../../../js/util/struct_array');

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

        array.trim();
        t.equal(array.capacity, 1);
        t.equal(array.arrayBuffer.byteLength, array.bytesPerElement);

        t.end();
    });

    t.end();
});
