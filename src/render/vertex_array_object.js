// @flow

const assert = require('assert');

import type Program from './program';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type Context from '../gl/context';

class VertexArrayObject {
    context: Context;
    boundProgram: ?Program;
    boundVertexBuffer: ?VertexBuffer;
    boundVertexBuffer2: ?VertexBuffer;
    boundIndexBuffer: ?IndexBuffer;
    boundVertexOffset: ?number;
    boundDynamicVertexBuffer: ?VertexBuffer;
    boundDynamicVertexBuffer2: ?VertexBuffer;
    vao: any;

    constructor() {
        this.boundProgram = null;
        this.boundVertexBuffer = null;
        this.boundVertexBuffer2 = null;
        this.boundIndexBuffer = null;
        this.boundVertexOffset = null;
        this.boundDynamicVertexBuffer = null;
        this.vao = null;
    }

    bind(context: Context,
         program: Program,
         layoutVertexBuffer: VertexBuffer,
         indexBuffer: ?IndexBuffer,
         vertexBuffer2: ?VertexBuffer,
         vertexOffset: ?number,
         dynamicVertexBuffer: ?VertexBuffer,
         dynamicVertexBuffer2: ?VertexBuffer) {

        this.context = context;

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

        if (!context.extVertexArrayObject || isFreshBindRequired) {
            this.freshBind(program, layoutVertexBuffer, indexBuffer, vertexBuffer2, vertexOffset, dynamicVertexBuffer, dynamicVertexBuffer2);
        } else {
            context.bindVertexArrayOES.set(this.vao);

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

    freshBind(program: Program,
              layoutVertexBuffer: VertexBuffer,
              indexBuffer: ?IndexBuffer,
              vertexBuffer2: ?VertexBuffer,
              vertexOffset: ?number,
              dynamicVertexBuffer: ?VertexBuffer,
              dynamicVertexBuffer2: ?VertexBuffer) {
        let numPrevAttributes;
        const numNextAttributes = program.numAttributes;

        const context = this.context;
        const gl = context.gl;

        if (context.extVertexArrayObject) {
            if (this.vao) this.destroy();
            this.vao = context.extVertexArrayObject.createVertexArrayOES();
            context.bindVertexArrayOES.set(this.vao);
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
            numPrevAttributes = context.currentNumAttributes || 0;

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

        context.currentNumAttributes = numNextAttributes;
    }

    destroy() {
        if (this.vao) {
            this.context.extVertexArrayObject.deleteVertexArrayOES(this.vao);
            this.vao = null;
        }
    }
}

module.exports = VertexArrayObject;
