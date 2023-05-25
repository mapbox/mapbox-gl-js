// @flow
import assert from 'assert';

import type {StructArray} from '../util/struct_array.js';
import type {TriangleIndexArray, LineIndexArray, LineStripIndexArray} from '../data/index_array_type.js';
import type Context from '../gl/context.js';

class IndexBuffer {
    context: Context;
    buffer: ?WebGLBuffer;
    dynamicDraw: boolean;
    id: number; // Unique ID, iterated on construction and data upload

    static uniqueIdxCounter: number;
    constructor(context: Context, array: TriangleIndexArray | LineIndexArray | LineStripIndexArray, dynamicDraw?: boolean, noDestroy?: boolean) {
        this.id = IndexBuffer.uniqueIdxCounter;
        IndexBuffer.uniqueIdxCounter++;

        this.context = context;
        const gl = context.gl;
        this.buffer = gl.createBuffer();
        this.dynamicDraw = Boolean(dynamicDraw);

        // The bound index buffer is part of vertex array object state. We don't want to
        // modify whatever VAO happens to be currently bound, so make sure the default
        // vertex array provided by the context is bound instead.
        this.context.unbindVAO();

        context.bindElementBuffer.set(this.buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array.arrayBuffer, this.dynamicDraw ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);

        if (!this.dynamicDraw && !noDestroy) {
            array.destroy();
        }
    }

    bind() {
        this.context.bindElementBuffer.set(this.buffer);
    }

    updateData(array: StructArray) {
        this.id = IndexBuffer.uniqueIdxCounter;
        IndexBuffer.uniqueIdxCounter++;

        const gl = this.context.gl;
        assert(this.dynamicDraw);
        // The right VAO will get this buffer re-bound later in VertexArrayObject#bind
        // See https://github.com/mapbox/mapbox-gl-js/issues/5620
        this.context.unbindVAO();
        this.bind();
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, array.arrayBuffer);
    }

    destroy() {
        const gl = this.context.gl;
        if (this.buffer) {
            gl.deleteBuffer(this.buffer);
            delete this.buffer;
        }
    }
}

IndexBuffer.uniqueIdxCounter = 0;

export default IndexBuffer;
