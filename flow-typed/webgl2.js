// @flow strict

type GLenum = number;
type GLintptr = number;
type GLsizei = number;
type GLuint = number;

declare interface WebGLVertexArrayObject {
    prototype: WebGLVertexArrayObject;
    new(): WebGLVertexArrayObject;
}

declare interface WebGLQuery {
    prototype: WebGLQuery;
    new(): WebGLQuery;
}

declare class WebGL2RenderingContext extends WebGLRenderingContext {
    R8: 0x8229;
    R32F: 0x822E;
    RGBA16F: 0x881A;
    RED: 0x1903;
    HALF_FLOAT: 0x140B;
    QUERY_RESULT: 0x8866;
    MIN: 0x8007;
    MAX: 0x8008;
    INTERLEAVED_ATTRIBS: 0x8C8C;
    SEPARATE_ATTRIBS: 0x8C8D;

    createVertexArray: () => WebGLVertexArrayObject | null;
    deleteVertexArray: (vertexArray: WebGLVertexArrayObject | null) => void;
    bindVertexArray: (array: WebGLVertexArrayObject | null) => void;
    getBufferSubData: (target: GLenum, srcByteOffset: GLintptr, dstBuffer: $ArrayBufferView, dstOffset?: GLuint, length?: GLuint) => void;
    drawElementsInstanced: (mode: GLenum, count: GLsizei, type: GLenum, offset: GLintptr, instanceCount: GLsizei) => void;
    vertexAttribDivisor: (index: GLuint, divisor: GLuint) => void;
    createQuery: () => WebGLQuery;
    beginQuery: (target: GLenum, query: WebGLQuery) => void;
    endQuery: (target: GLenum) => void;
    deleteQuery: (query: WebGLQuery) => void;
    getQueryParameter: (query: WebGLQuery, pname: GLenum) => GLuint;
};
