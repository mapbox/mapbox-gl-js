// @flow

const assert = require('assert');

import type Program from './program';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';

class VertexArrayObject {
    boundProgram: ?Program;
    boundVertexBuffer: ?VertexBuffer;
    boundVertexBuffer2: ?VertexBuffer;
    boundIndexBuffer: ?IndexBuffer;
    boundVertexOffset: ?number;
    boundDynamicVertexBuffer: ?VertexBuffer;
    boundDynamicVertexBuffer2: ?VertexBuffer;
    vao: any;
    gl: WebGLRenderingContext;

    constructor() {
        this.boundProgram = null;
        this.boundVertexBuffer = null;
        this.boundVertexBuffer2 = null;
        this.boundIndexBuffer = null;
        this.boundVertexOffset = null;
        this.boundDynamicVertexBuffer = null;
        this.vao = null;
    }

    bind(gl: WebGLRenderingContext,
         program: Program,
         layoutVertexBuffer: VertexBuffer,
         indexBuffer: ?IndexBuffer,
         vertexBuffer2: ?VertexBuffer,
         vertexOffset: ?number,
         dynamicVertexBuffer: ?VertexBuffer,
         dynamicVertexBuffer2: ?VertexBuffer) {

        if (gl.extVertexArrayObject === undefined) {
            (gl: any).extVertexArrayObject = gl.getExtension("OES_vertex_array_object");
        }

        const isFreshBindRequired = (
            !this.vao ||
            this.boundProgram !== program ||
            this.boundVertexBuffer !== layoutVertexBuffer ||
            this.boundVertexBuffer2 !== vertexBuffer2 ||
            this.boundIndexBuffer !== indexBuffer ||
            this.boundVertexOffset !== vertexOffset ||
            this.boundDynamicVertexBuffer !== dynamicVertexBuffer ||
            this.boundDynamicVertexBuffer2 !== dynamicVertexBuffer2
        );

        if (!gl.extVertexArrayObject || isFreshBindRequired) {
            this.freshBind(gl, program, layoutVertexBuffer, indexBuffer, vertexBuffer2, vertexOffset, dynamicVertexBuffer, dynamicVertexBuffer2);
            this.gl = gl;
        } else {
            (gl: any).extVertexArrayObject.bindVertexArrayOES(this.vao);

            if (dynamicVertexBuffer) {
                // The buffer may have been updated. Rebind to upload data.
                dynamicVertexBuffer.bind();
            }

            if (indexBuffer && indexBuffer.dynamicDraw) {
                indexBuffer.bind();
            }

            if (dynamicVertexBuffer2) {
                dynamicVertexBuffer2.bind();
            }
        }
    }

    freshBind(gl: WebGLRenderingContext,
              program: Program,
              layoutVertexBuffer: VertexBuffer,
              indexBuffer: ?IndexBuffer,
              vertexBuffer2: ?VertexBuffer,
              vertexOffset: ?number,
              dynamicVertexBuffer: ?VertexBuffer,
              dynamicVertexBuffer2: ?VertexBuffer) {
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
            this.boundIndexBuffer = indexBuffer;
            this.boundVertexOffset = vertexOffset;
            this.boundDynamicVertexBuffer = dynamicVertexBuffer;
            this.boundDynamicVertexBuffer2 = dynamicVertexBuffer2;

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
        if (dynamicVertexBuffer2) {
            dynamicVertexBuffer2.enableAttributes(gl, program);
        }

        layoutVertexBuffer.bind();
        layoutVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        if (vertexBuffer2) {
            vertexBuffer2.bind();
            vertexBuffer2.setVertexAttribPointers(gl, program, vertexOffset);
        }
        if (dynamicVertexBuffer) {
            dynamicVertexBuffer.bind();
            dynamicVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        }
        if (indexBuffer) {
            indexBuffer.bind();
        }
        if (dynamicVertexBuffer2) {
            dynamicVertexBuffer2.bind();
            dynamicVertexBuffer2.setVertexAttribPointers(gl, program, vertexOffset);
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
