'use strict';

var test = require('tap').test;
var StructArrayType = require('../../../js/util/struct_array');

test('StructArray', function(t) {

    var TestArray = new StructArrayType({
        members: [
            { type: 'Int16', name: 'map' },
            { type: 'Int16', name: 'box', components: 2 }
        ],
        alignment: 4
    });

    t.test('type defined', function(t) {

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

    t.test('array constructs itself', function(t) {
        var array = new TestArray();

        t.equal(array.length, 0);
        t.equal(array.bytesPerElement, 8);
        t.ok(array.arrayBuffer);

        t.end();
    });

    t.test('emplaceBack', function(t) {
        var array = new TestArray();

        t.equal(0, array.emplaceBack(1, 7, 3));
        t.equal(1, array.emplaceBack(4, 2, 5));

        t.equal(array.length, 2);

        var e0 = array.get(0);
        t.equal(e0.map, 1);
        t.equal(e0.box0, 7);
        t.equal(e0.box1, 3);
        var e1 = array.get(1);
        t.equal(e1.map, 4);
        t.equal(e1.box0, 2);
        t.equal(e1.box1, 5);

        t.end();
    });

    t.test('automatically resizes', function(t) {
        var array = new TestArray();
        var initialCapacity = array.capacity;

        while (initialCapacity > array.length) {
            array.emplaceBack(1, 1, 1);
        }

        t.equal(array.capacity, initialCapacity);

        array.emplaceBack(1, 1, 1);
        t.ok(array.capacity > initialCapacity);

        t.end();
    });

    t.test('trims', function(t) {
        var array = new TestArray();
        var capacityInitial = array.capacity;

        array.emplaceBack(1, 1, 1);
        t.equal(array.capacity, capacityInitial);

        array.trim();
        t.equal(array.capacity, 1);
        t.equal(array.arrayBuffer.byteLength, array.bytesPerElement);

        t.end();
    });

    t.end();
});
