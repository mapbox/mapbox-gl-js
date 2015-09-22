'use strict';

var test = require('prova');
var Buffer = require('../../../js/data/buffer2');
var util = require('../../../js/util/util');

test('Buffer2', function(t) {

    function create(options) {
        return new Buffer(util.extend({}, {
            type: Buffer.BufferType.VERTEX,
            attributes: {
                map: { },
                box: { components: 2, type: Buffer.AttributeType.SHORT }
            }
        }, options));
    }

    t.test('constructs itself', function(t) {
        var buffer = create();

        t.equal(buffer.type, Buffer.BufferType.VERTEX);
        t.equal(buffer.capacity, 8192);
        t.equal(buffer.length, 0);
        t.equal(buffer.itemSize, 8);
        t.ok(buffer.arrayBuffer);
        t.notOk(buffer.singleAttribute);

        t.equal(buffer.attributes.map.name, 'map');
        t.equal(buffer.attributes.map.components, 1);
        t.equal(buffer.attributes.map.type, Buffer.AttributeType.UNSIGNED_BYTE);
        t.equal(buffer.attributes.map.size, 1);
        t.equal(buffer.attributes.map.offset, 0);

        t.equal(buffer.attributes.box.name, 'box');
        t.equal(buffer.attributes.box.components, 2);
        t.equal(buffer.attributes.box.type, Buffer.AttributeType.SHORT);
        t.equal(buffer.attributes.box.size, 4);
        t.equal(buffer.attributes.box.offset, 4);

        t.end();
    });

    t.test('constructs itself with one attribute', function(t) {
        var buffer = create({attributes: { map: {} }});

        t.ok(buffer.singleAttribute);
        t.equal(buffer.singleAttribute, buffer.attributes.map);

        t.end();
    });

    t.test('pushes items', function(t) {
        var buffer = create();

        t.equal(0, buffer.push({map: 1, box: [7, 3]}));
        t.equal(1, buffer.push({map: 4, box: [2, 5]}));

        t.equal(buffer.length, 2);

        t.deepEqual(buffer.get(0), {map: [1], box: [7, 3]});
        t.deepEqual(buffer.get(1), {map: [4], box: [2, 5]});

        t.end();
    });

    t.test('pushes items with one attribute', function(t) {
        var buffer = create({attributes: { map: {} }});

        t.equal(0, buffer.push(1));
        t.equal(1, buffer.push(2));

        t.equal(buffer.length, 2);

        t.deepEqual(buffer.get(0), {map: [1]});
        t.deepEqual(buffer.get(1), {map: [2]});

        t.end();
    });

    t.test('sets items', function(t) {
        var buffer = create();
        buffer.set(1, {map: [1], box: [7, 3]});
        t.deepEqual(buffer.get(1), {map: [1], box: [7, 3]});
        t.equal(buffer.length, 2);
        t.end();
    });

    t.test('sets item attributes', function(t) {
        var buffer = create();
        buffer.setAttribute(1, 'map', 1);
        buffer.setAttribute(1, 'box', [7, 3]);
        t.deepEqual(buffer.get(1), {map: [1], box: [7, 3]});
        t.equal(buffer.length, 2);
        t.end();
    });

    t.test('automatically resizes', function(t) {
        var buffer = create();
        var capacityInitial = buffer.capacity;
        t.ok(capacityInitial);

        var index = Math.ceil(capacityInitial * 1.5 / buffer.itemSize) + 1;
        buffer.set(index, {map: 1, box: [7, 3]});

        t.deepEqual(buffer.get(index), {map: [1], box: [7, 3]});
        t.equal(buffer.length, index + 1);
        t.equal(buffer.capacity, capacityInitial * 1.5 * 1.5);

        t.end();
    });

    t.end();
});
