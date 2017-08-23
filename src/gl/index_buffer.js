// @flow

import type {SerializedStructArray} from '../util/struct_array';

class IndexBuffer {
    arrayBuffer: ?ArrayBuffer;
    length: number;
    gl: WebGLRenderingContext;
    buffer: ?WebGLBuffer;

    constructor(array: SerializedStructArray) {
        this.arrayBuffer = array.arrayBuffer;
        this.length = array.length;
    }

    bind(gl: WebGLRenderingContext) {
        if (!this.buffer) {
            this.gl = gl;
            this.buffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.arrayBuffer, gl.STATIC_DRAW);

            // dump array buffer once it's bound to gl
            this.arrayBuffer = null;
        } else {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
        }
    }

    destroy() {
        if (this.buffer) {
            this.gl.deleteBuffer(this.buffer);
        }
    }
}

module.exports = IndexBuffer;
