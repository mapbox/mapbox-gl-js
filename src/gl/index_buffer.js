// @flow
const assert = require('assert');

import type {TriangleIndexArray, LineIndexArray} from '../data/index_array_type';
import type {SerializedStructArray} from '../util/struct_array';


class IndexBuffer {
    gl: WebGLRenderingContext;
    buffer: WebGLBuffer;
    dynamicDraw: boolean;

    constructor(gl: WebGLRenderingContext, array: TriangleIndexArray | LineIndexArray, dynamicDraw?: boolean) {
        this.gl = gl;
        this.buffer = gl.createBuffer();
        this.dynamicDraw = Boolean(dynamicDraw);

        // The bound index buffer is part of vertex array object state. We don't want to
        // modify whatever VAO happens to be currently bound, so make sure the default
        // vertex array provided by the context is bound instead.
        if (gl.extVertexArrayObject === undefined) {
            (gl: any).extVertexArrayObject = gl.getExtension("OES_vertex_array_object");
        }
        if (gl.extVertexArrayObject) {
            (gl: any).extVertexArrayObject.bindVertexArrayOES(null);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array.arrayBuffer, this.dynamicDraw ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);

        if (!this.dynamicDraw) {
            delete array.arrayBuffer;
        }
    }

    bind() {
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffer);
    }

    updateData(array: SerializedStructArray) {
        assert(this.dynamicDraw);
        this.bind();
        this.gl.bufferSubData(this.gl.ELEMENT_ARRAY_BUFFER, 0, array.arrayBuffer);
    }

    destroy() {
        if (this.buffer) {
            this.gl.deleteBuffer(this.buffer);
            delete this.buffer;
        }
    }
}

module.exports = IndexBuffer;
