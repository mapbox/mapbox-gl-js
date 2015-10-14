'use strict';

var test = require('prova');
var Buffer = require('../../../js/data/buffer');
var util = require('../../../js/util/util');

test('Buffer', function(t) {

    function create(options) {
        return new Buffer(util.extend({}, {
            type: Buffer.BufferType.VERTEX,
            attributes: [
                { name: 'map' },
                { name: 'box', components: 2, type: Buffer.AttributeType.SHORT }
            ]
        }, options));
    }

    t.test('constructs itself', function(t) {
        var buffer = create();

        t.equal(buffer.type, Buffer.BufferType.VERTEX);
        t.equal(buffer.capacity, 8192);
        t.equal(buffer.length, 0);
        t.equal(buffer.itemSize, 8);
        t.ok(buffer.arrayBuffer);

        t.deepEqual(buffer.attributes, [{
            name: 'map',
            components: 1,
            type: Buffer.AttributeType.UNSIGNED_BYTE,
            size: 1,
            offset: 0
        }, {
            name: 'box',
            components: 2,
            type: Buffer.AttributeType.SHORT,
            size: 4,
            offset: 4
        }]);

        t.end();
    });

    t.test('pushes items', function(t) {
        var buffer = create();

        t.equal(0, buffer.push([1], [7, 3]));
        t.equal(1, buffer.push([4], [2, 5]));

        t.equal(buffer.length, 2);

        t.deepEqual(buffer.get(0), {map: [1], box: [7, 3]});
        t.deepEqual(buffer.get(1), {map: [4], box: [2, 5]});

        t.end();
    });

    t.test('automatically resizes', function(t) {
        var buffer = create();
        var capacityInitial = buffer.capacity;

        while (capacityInitial > buffer.length * buffer.itemSize) {
            buffer.push([1], [1, 1]);
        }
        t.equal(buffer.capacity, capacityInitial);

        buffer.push([1], [1, 1]);
        t.ok(buffer.capacity > capacityInitial);

        t.end();
    });

    t.end();
});
