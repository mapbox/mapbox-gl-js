// @flow

const assert = require('assert');

import type Program from './program';
import type Buffer from '../data/buffer';

class VertexArrayObject {
    boundProgram: ?Program;
    boundVertexBuffer: ?Buffer;
    boundVertexBuffer2: ?Buffer;
    boundElementBuffer: ?Buffer;
    boundVertexOffset: ?number;
    boundDynamicVertexBuffer: ?Buffer;
    vao: any;
    gl: WebGLRenderingContext;

    constructor() {
        this.boundProgram = null;
        this.boundVertexBuffer = null;
        this.boundVertexBuffer2 = null;
        this.boundElementBuffer = null;
        this.boundVertexOffset = null;
        this.boundDynamicVertexBuffer = null;
        this.vao = null;
    }

    bind(gl: WebGLRenderingContext,
         program: Program,
         layoutVertexBuffer: Buffer,
         elementBuffer: ?Buffer,
         vertexBuffer2: ?Buffer,
         vertexOffset: ?number,
         dynamicVertexBuffer: ?Buffer) {

        if (gl.extVertexArrayObject === undefined) {
            (gl: any).extVertexArrayObject = gl.getExtension("OES_vertex_array_object");
        }

        const isFreshBindRequired = (
            !this.vao ||
            this.boundProgram !== program ||
            this.boundVertexBuffer !== layoutVertexBuffer ||
            this.boundVertexBuffer2 !== vertexBuffer2 ||
            this.boundElementBuffer !== elementBuffer ||
            this.boundVertexOffset !== vertexOffset ||
            this.boundDynamicVertexBuffer !== dynamicVertexBuffer
        );

        if (!gl.extVertexArrayObject || isFreshBindRequired) {
            this.freshBind(gl, program, layoutVertexBuffer, elementBuffer, vertexBuffer2, vertexOffset, dynamicVertexBuffer);
            this.gl = gl;
        } else {
            (gl: any).extVertexArrayObject.bindVertexArrayOES(this.vao);

            if (dynamicVertexBuffer) {
                // The buffer may have been updated. Rebind to upload data.
                dynamicVertexBuffer.bind(gl);
            }
        }
    }

    freshBind(gl: WebGLRenderingContext,
              program: any,
              layoutVertexBuffer: any,
              elementBuffer: any,
              vertexBuffer2: any,
              vertexOffset: any,
              dynamicVertexBuffer: any) {
        let numPrevAttributes;
        const numNextAttributes = program.numAttributes;

        if (gl.extVertexArrayObject) {
            if (this.vao) this.destroy();
            this.vao = (gl: any).extVertexArrayObject.createVertexArrayOES();
            (gl: any).extVertexArrayObject.bindVertexArrayOES(this.vao);
            numPrevAttributes = 0;

            // store the arguments so that we can verify them when the vao is bound again
            this.boundProgram = program;
            this.boundVertexBuffer = layoutVertexBuffer;
            this.boundVertexBuffer2 = vertexBuffer2;
            this.boundElementBuffer = elementBuffer;
            this.boundVertexOffset = vertexOffset;
            this.boundDynamicVertexBuffer = dynamicVertexBuffer;

        } else {
            numPrevAttributes = (gl: any).currentNumAttributes || 0;

            // Disable all attributes from the previous program that aren't used in
            // the new program. Note: attribute indices are *not* program specific!
            for (let i = numNextAttributes; i < numPrevAttributes; i++) {
                // WebGL breaks if you disable attribute 0.
                // http://stackoverflow.com/questions/20305231
                assert(i !== 0);
                gl.disableVertexAttribArray(i);
            }
        }

        layoutVertexBuffer.enableAttributes(gl, program);
        if (vertexBuffer2) {
            vertexBuffer2.enableAttributes(gl, program);
        }
        if (dynamicVertexBuffer) {
            dynamicVertexBuffer.enableAttributes(gl, program);
        }

        layoutVertexBuffer.bind(gl);
        layoutVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        if (vertexBuffer2) {
            vertexBuffer2.bind(gl);
            vertexBuffer2.setVertexAttribPointers(gl, program, vertexOffset);
        }
        if (dynamicVertexBuffer) {
            dynamicVertexBuffer.bind(gl);
            dynamicVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        }
        if (elementBuffer) {
            elementBuffer.bind(gl);
        }

        (gl: any).currentNumAttributes = numNextAttributes;
    }

    destroy() {
        if (this.vao) {
            (this.gl: any).extVertexArrayObject.deleteVertexArrayOES(this.vao);
            this.vao = null;
        }
    }
}

module.exports = VertexArrayObject;
