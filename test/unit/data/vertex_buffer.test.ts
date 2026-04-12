// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi} from '../../util/vitest';
import VertexBuffer from '../../../src/gl/vertex_buffer';
import {StructArrayLayout3i6, StructArrayLayout3f12} from '../../../src/data/array_types';
import Context from '../../../src/gl/context';

const element = window.document.createElement('canvas');
const gl = element.getContext('webgl2');

describe('VertexBuffer', () => {
    class TestArrayI extends StructArrayLayout3i6 {}
    class TestArrayF extends StructArrayLayout3f12 {}
    const attributesI = [
        {name: 'map', components: 1, type: 'Int16', offset: 0},
        {name: 'box', components: 2, type: 'Int16', offset: 2}
    ];
    const attributesF = [
        {name: 'map', components: 1, type: 'Float32', offset: 0},
        {name: 'box', components: 2, type: 'Float32', offset: 4}
    ];
    const program = {
        getAttributeLocation(gl, name) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return ({map: 5, box: 6})[name] || -1;
        }
    };

    test('constructs itself', () => {
        const context = new Context(gl);

        {
            const arrayI = new TestArrayI();
            arrayI.emplaceBack(1, 1, 1);
            arrayI.emplaceBack(1, 1, 1);
            arrayI.emplaceBack(1, 1, 1);

            const bufferI = new VertexBuffer(context, arrayI, attributesI);

            expect(bufferI.attributes).toEqual([
                {name: 'map', components: 1, type: 'Int16', offset: 0},
                {name: 'box', components: 2, type: 'Int16', offset: 2}
            ]);
            expect(bufferI.itemSize).toEqual(6);
            expect(bufferI.length).toEqual(3);
        }

        {
            const arrayF = new TestArrayF();
            arrayF.emplaceBack(1, 1, 1);
            arrayF.emplaceBack(1, 1, 1);
            arrayF.emplaceBack(1, 1, 1);

            const bufferF = new VertexBuffer(context, arrayF, attributesF);

            expect(bufferF.attributes).toEqual([
                {name: 'map', components: 1, type: 'Float32', offset: 0},
                {name: 'box', components: 2, type: 'Float32', offset: 4}
            ]);
            expect(bufferF.itemSize).toEqual(12);
            expect(bufferF.length).toEqual(3);
        }
    });

    test('enableAttributes', () => {
        const context = new Context(gl);
        const array = new TestArrayI();
        const buffer = new VertexBuffer(context, array, attributesI);
        vi.spyOn(context.gl, 'enableVertexAttribArray').mockImplementation(() => {});
        buffer.enableAttributes(context.gl, program);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(context.gl.enableVertexAttribArray.mock.calls).toEqual([[5], [6]]);
    });

    test('setVertexAttribIPointers', () => {
        const context = new Context(gl);
        const arrayI = new TestArrayI();
        const bufferI = new VertexBuffer(context, arrayI, attributesI);
        vi.spyOn(context.gl, 'vertexAttribIPointer').mockImplementation(() => {});
        vi.spyOn(context.gl, 'vertexAttribPointer').mockImplementation(() => {});
        bufferI.setVertexAttribPointers(context.gl, program, 50);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(context.gl.vertexAttribIPointer.mock.calls).toEqual([
            [5, 1, context.gl['SHORT'], 6, 300],
            [6, 2, context.gl['SHORT'], 6, 302]
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(context.gl.vertexAttribPointer.mock.calls).toEqual([]);
    });

    test('setVertexAttribPointers', () => {
        const context = new Context(gl);
        const arrayF = new TestArrayF();
        const bufferF = new VertexBuffer(context, arrayF, attributesF);
        vi.spyOn(context.gl, 'vertexAttribPointer').mockImplementation(() => {});
        vi.spyOn(context.gl, 'vertexAttribIPointer').mockImplementation(() => {});
        bufferF.setVertexAttribPointers(context.gl, program, 50);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(context.gl.vertexAttribPointer.mock.calls).toEqual([
            [5, 1, context.gl['FLOAT'], false, 12, 600],
            [6, 2, context.gl['FLOAT'], false, 12, 604]
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(context.gl.vertexAttribIPointer.mock.calls).toEqual([]);
    });
});
