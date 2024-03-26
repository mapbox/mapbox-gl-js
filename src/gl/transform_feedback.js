// @flow

import type VertexBuffer from './vertex_buffer.js';

export type BufferMode =
    | $PropertyType<WebGL2RenderingContext, 'INTERLEAVED_ATTRIBS'>
    | $PropertyType<WebGL2RenderingContext, 'SEPARATE_ATTRIBS'>;

export type TransformFeedbackConfiguration = {|
    shaderVaryings: [string],
    bufferMode: BufferMode
|};

export type TransformFeedbackBuffer = {|
    buffer: VertexBuffer,
    targetIndex: number
|};
