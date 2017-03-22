'use strict';

const assert = require('assert');

class VertexArrayObject {
    constructor() {
        this.boundProgram = null;
        this.boundVertexBuffer = null;
        this.boundVertexBuffer2 = null;
        this.boundElementBuffer = null;
        this.boundVertexOffset = null;
        this.vao = null;
    }

    bind(gl, program, layoutVertexBuffer, elementBuffer, vertexBuffer2, vertexOffset) {

        if (gl.extVertexArrayObject === undefined) {
            gl.extVertexArrayObject = gl.getExtension("OES_vertex_array_object");
        }

        const isFreshBindRequired = (
            !this.vao ||
            this.boundProgram !== program ||
            this.boundVertexBuffer !== layoutVertexBuffer ||
            this.boundVertexBuffer2 !== vertexBuffer2 ||
            this.boundElementBuffer !== elementBuffer ||
            this.boundVertexOffset !== vertexOffset
        );

        if (!gl.extVertexArrayObject || isFreshBindRequired) {
            this.freshBind(gl, program, layoutVertexBuffer, elementBuffer, vertexBuffer2, vertexOffset);
            this.gl = gl;
        } else {
            gl.extVertexArrayObject.bindVertexArrayOES(this.vao);
        }
    }

    freshBind(gl, program, layoutVertexBuffer, elementBuffer, vertexBuffer2, vertexOffset) {
        let numPrevAttributes;
        const numNextAttributes = program.numAttributes;

        if (gl.extVertexArrayObject) {
            if (this.vao) this.destroy();
            this.vao = gl.extVertexArrayObject.createVertexArrayOES();
            gl.extVertexArrayObject.bindVertexArrayOES(this.vao);
            numPrevAttributes = 0;

            // store the arguments so that we can verify them when the vao is bound again
            this.boundProgram = program;
            this.boundVertexBuffer = layoutVertexBuffer;
            this.boundVertexBuffer2 = vertexBuffer2;
            this.boundElementBuffer = elementBuffer;
            this.boundVertexOffset = vertexOffset;

        } else {
            numPrevAttributes = gl.currentNumAttributes || 0;

            // Disable all attributes from the previous program that aren't used in
            // the new program. Note: attribute indices are *not* program specific!
            for (let i = numNextAttributes; i < numPrevAttributes; i++) {
                // WebGL breaks if you disable attribute 0.
                // http://stackoverflow.com/questions/20305231
                assert(i !== 0);
                gl.disableVertexAttribArray(i);
            }
        }

        // Enable all attributes for the new program.
        for (let j = numPrevAttributes; j < numNextAttributes; j++) {
            gl.enableVertexAttribArray(j);
        }

        layoutVertexBuffer.bind(gl);
        layoutVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        if (vertexBuffer2) {
            vertexBuffer2.bind(gl);
            vertexBuffer2.setVertexAttribPointers(gl, program, vertexOffset);
        }
        if (elementBuffer) {
            elementBuffer.bind(gl);
        }

        gl.currentNumAttributes = numNextAttributes;
    }

    destroy() {
        if (this.vao) {
            this.gl.extVertexArrayObject.deleteVertexArrayOES(this.vao);
            this.vao = null;
        }
    }
}

module.exports = VertexArrayObject;
