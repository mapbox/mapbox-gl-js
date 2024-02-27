import {describe, test, expect, vi} from "../../util/vitest.js";
import VertexBuffer from '../../../src/gl/vertex_buffer.js';
import {StructArrayLayout3i6} from '../../../src/data/array_types.js';
import Context from '../../../src/gl/context.js';

const element = window.document.createElement('canvas');
const gl = element.getContext('webgl2');

describe('VertexBuffer', () => {
    class TestArray extends StructArrayLayout3i6 {}
    const attributes = [
        {name: 'map', components: 1, type: 'Int16', offset: 0},
        {name: 'box', components: 2, type: 'Int16', offset: 4}
    ];

    test('constructs itself', () => {
        const context = new Context(gl);
        const array = new TestArray();
        array.emplaceBack(1, 1, 1);
        array.emplaceBack(1, 1, 1);
        array.emplaceBack(1, 1, 1);

        const buffer = new VertexBuffer(context, array, attributes);

        expect(buffer.attributes).toEqual([
            {name: 'map', components: 1, type: 'Int16', offset: 0},
            {name: 'box', components: 2, type: 'Int16', offset: 4}
        ]);
        expect(buffer.itemSize).toEqual(6);
        expect(buffer.length).toEqual(3);
    });

    test('enableAttributes', () => {
        const context = new Context(gl);
        const array = new TestArray();
        const buffer = new VertexBuffer(context, array, attributes);
        vi.spyOn(context.gl, 'enableVertexAttribArray').mockImplementation(() => {});
        buffer.enableAttributes(context.gl, {attributes: {map: 5, box: 6}});
        expect(context.gl.enableVertexAttribArray.mock.calls).toEqual([[5], [6]]);
    });

    test('setVertexAttribPointers', () => {
        const context = new Context(gl);
        const array = new TestArray();
        const buffer = new VertexBuffer(context, array, attributes);
        vi.spyOn(context.gl, 'vertexAttribPointer').mockImplementation(() => {});
        buffer.setVertexAttribPointers(context.gl, {attributes: {map: 5, box: 6}}, 50);
        expect(context.gl.vertexAttribPointer.mock.calls).toEqual([
            [5, 1, context.gl['SHORT'], false, 6, 300],
            [6, 2, context.gl['SHORT'], false, 6, 304]
        ]);
    });
});
