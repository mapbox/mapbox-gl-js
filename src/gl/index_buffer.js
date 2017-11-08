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

        this.unbindVAO();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array.arrayBuffer, this.dynamicDraw ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);

        if (!this.dynamicDraw) {
            delete array.arrayBuffer;
        }
    }

    unbindVAO() {
        // The bound index buffer is part of vertex array object state. We don't want to
        // modify whatever VAO happens to be currently bound, so make sure the default
        // vertex array provided by the context is bound instead.
        if (this.gl.extVertexArrayObject === undefined) {
            (this.gl: any).extVertexArrayObject = this.gl.getExtension("OES_vertex_array_object");
        }
        if (this.gl.extVertexArrayObject) {
            (this.gl: any).extVertexArrayObject.bindVertexArrayOES(null);
        }
    }

    bind() {
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffer);
    }

    updateData(array: SerializedStructArray) {
        assert(this.dynamicDraw);
        // The right VAO will get this buffer re-bound later in VertexArrayObject#bind
        // See https://github.com/mapbox/mapbox-gl-js/issues/5620
        this.unbindVAO();
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
