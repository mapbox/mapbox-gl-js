// @flow strict

type GLenum = number;
type GLintptr = number;
type GLsizei = number;
type GLuint = number;

declare interface WebGLVertexArrayObject {
    prototype: WebGLVertexArrayObject;
    new(): WebGLVertexArrayObject;
}

export type WebGL2RenderingContext = WebGLRenderingContext & {
    createVertexArray: () => WebGLVertexArrayObject | null;
    deleteVertexArray: (vertexArray: WebGLVertexArrayObject | null) => void;
    bindVertexArray: (array: WebGLVertexArrayObject | null) => void;
    getBufferSubData: (target: GLenum, srcByteOffset: GLintptr, dstBuffer: $ArrayBufferView, dstOffset?: GLuint, length?: GLuint) => void;
    drawElementsInstanced: (mode: GLenum, count: GLsizei, type: GLenum, offset: GLintptr, instanceCount: GLsizei) => void;
    vertexAttribDivisor: (index: GLuint, divisor: GLuint) => void;
};
