'use strict';

const test = require('mapbox-gl-js-test').test;
const VertexBuffer = require('../../../src/gl/vertex_buffer');
const StructArrayType = require('../../../src/util/struct_array');

test('VertexBuffer', (t) => {

    const TestArray = new StructArrayType({
        members: [
            { type: 'Int16', name: 'map' },
            { type: 'Int16', name: 'box', components: 2 }
        ],
        alignment: 4
    });


    t.test('constructs itself', (t) => {
        const gl = require('gl')(10, 10);
        const array = new TestArray();
        array.emplaceBack(1, 1, 1);
        array.emplaceBack(1, 1, 1);
        array.emplaceBack(1, 1, 1);

        const buffer = new VertexBuffer(gl, array);

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
        t.end();
    });

    t.end();
});
