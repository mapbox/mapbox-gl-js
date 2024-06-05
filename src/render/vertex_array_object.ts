import type Program from './program';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type Context from '../gl/context';

class VertexArrayObject {
    context: Context;
    boundProgram: Program<any> | null | undefined;
    boundLayoutVertexBuffer: VertexBuffer | null | undefined;
    boundPaintVertexBuffers: Array<VertexBuffer>;
    boundIndexBuffer: IndexBuffer | null | undefined;
    boundVertexOffset: number | null | undefined;
    boundDynamicVertexBuffers: Array<VertexBuffer | null | undefined>;
    vao: any;

    constructor() {
        this.boundProgram = null;
        this.boundLayoutVertexBuffer = null;
        this.boundPaintVertexBuffers = [];
        this.boundIndexBuffer = null;
        this.boundVertexOffset = null;
        this.boundDynamicVertexBuffers = [];
        this.vao = null;
    }

    bind(context: Context,
         program: Program<any>,
         layoutVertexBuffer: VertexBuffer,
         paintVertexBuffers: Array<VertexBuffer>,
         indexBuffer: IndexBuffer | null | undefined,
         vertexOffset: number | null | undefined,
         dynamicVertexBuffers: Array<VertexBuffer | null | undefined>,
         vertexAttribDivisorValue?: number | null) {

        this.context = context;

        let paintBuffersDiffer = this.boundPaintVertexBuffers.length !== paintVertexBuffers.length;
        for (let i = 0; !paintBuffersDiffer && i < paintVertexBuffers.length; i++) {
            if (this.boundPaintVertexBuffers[i] !== paintVertexBuffers[i]) {
                paintBuffersDiffer = true;
            }
        }
        let dynamicBuffersDiffer = this.boundDynamicVertexBuffers.length !== dynamicVertexBuffers.length;
        for (let i = 0; !dynamicBuffersDiffer && i < dynamicVertexBuffers.length; i++) {
            if (this.boundDynamicVertexBuffers[i] !== dynamicVertexBuffers[i]) {
                dynamicBuffersDiffer = true;
            }
        }

        const isFreshBindRequired = (
            !this.vao ||
            this.boundProgram !== program ||
            this.boundLayoutVertexBuffer !== layoutVertexBuffer ||
            paintBuffersDiffer ||
            dynamicBuffersDiffer ||
            this.boundIndexBuffer !== indexBuffer ||
            this.boundVertexOffset !== vertexOffset
        );

        if (isFreshBindRequired) {
            this.freshBind(program, layoutVertexBuffer, paintVertexBuffers, indexBuffer, vertexOffset, dynamicVertexBuffers, vertexAttribDivisorValue);
        } else {
            context.bindVertexArrayOES.set(this.vao);
            for (const dynamicBuffer of dynamicVertexBuffers) {
                if (dynamicBuffer) {
                    dynamicBuffer.bind();
                    if (vertexAttribDivisorValue && dynamicBuffer.instanceCount) {
                        dynamicBuffer.setVertexAttribDivisor(context.gl, program, vertexAttribDivisorValue);
                    }
                }
            }
            if (indexBuffer && indexBuffer.dynamicDraw) {
                indexBuffer.bind();
            }
        }
    }

    freshBind(program: Program<any>,
              layoutVertexBuffer: VertexBuffer,
              paintVertexBuffers: Array<VertexBuffer>,
              indexBuffer: IndexBuffer | null | undefined,
              vertexOffset: number | null | undefined,
              dynamicVertexBuffers: Array<VertexBuffer | null | undefined>,
              vertexAttribDivisorValue?: number | null) {
        const numNextAttributes = program.numAttributes;

        const context = this.context;
        const gl = context.gl;

        if (this.vao) this.destroy();
        this.vao = context.gl.createVertexArray();
        context.bindVertexArrayOES.set(this.vao);

        // store the arguments so that we can verify them when the vao is bound again
        this.boundProgram = program;
        this.boundLayoutVertexBuffer = layoutVertexBuffer;
        this.boundPaintVertexBuffers = paintVertexBuffers;
        this.boundIndexBuffer = indexBuffer;
        this.boundVertexOffset = vertexOffset;
        this.boundDynamicVertexBuffers = dynamicVertexBuffers;

        layoutVertexBuffer.enableAttributes(gl, program);
        layoutVertexBuffer.bind();
        layoutVertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);

        for (const vertexBuffer of paintVertexBuffers) {
            vertexBuffer.enableAttributes(gl, program);
            vertexBuffer.bind();
            vertexBuffer.setVertexAttribPointers(gl, program, vertexOffset);
        }

        for (const dynamicBuffer of dynamicVertexBuffers) {
            if (dynamicBuffer) {
                dynamicBuffer.enableAttributes(gl, program);
                dynamicBuffer.bind();
                dynamicBuffer.setVertexAttribPointers(gl, program, vertexOffset);
                if (vertexAttribDivisorValue && dynamicBuffer.instanceCount) {
                    dynamicBuffer.setVertexAttribDivisor(gl, program, vertexAttribDivisorValue);
                }
            }
        }

        if (indexBuffer) {
            indexBuffer.bind();
        }

        context.currentNumAttributes = numNextAttributes;
    }

    destroy() {
        if (this.vao) {
            this.context.gl.deleteVertexArray(this.vao);
            this.vao = null;
        }
    }
}

export default VertexArrayObject;
