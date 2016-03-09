'use strict';

var test = require('tap').test;
var Buffer = require('../../../js/data/buffer');
var StructArrayType = require('../../../js/util/struct_array');

test('Buffer', function(t) {

    var TestArray = new StructArrayType({
        members: [
            { type: 'Int16', name: 'map' },
            { type: 'Int16', name: 'box', components: 2 }
        ],
        alignment: 4
    });


    t.test('constructs itself', function(t) {
        var array = new TestArray();
        array.emplaceBack(1, 1, 1);
        array.emplaceBack(1, 1, 1);
        array.emplaceBack(1, 1, 1);

        var buffer = new Buffer(array.serialize(), TestArray.serialize(), Buffer.BufferType.VERTEX);

        t.deepEqual(buffer.attributes, [
            {
                name: 'map',
                components: 1,
                type: 'Int16',
                offset: 0
            }, {
                name: 'box',
                components: 2,
                type: 'Int16',
                offset: 4
            }]);

        t.deepEqual(buffer.itemSize, 8);
        t.deepEqual(buffer.length, 3);
        t.ok(buffer.arrayBuffer);
        t.equal(buffer.type, Buffer.BufferType.VERTEX);
        t.end();

    });

    t.end();

});
