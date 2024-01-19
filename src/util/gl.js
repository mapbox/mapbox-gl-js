// @flow strict

import gl from 'gl';

export default function(width: number, height: number, attributes: WebGLContextAttributes): WebGL2RenderingContext {
    const context = gl(width, height, attributes);

    // Mock WebGL2 methods
    context.createVertexArray = function() { return null; };
    context.deleteVertexArray = function() {};
    context.bindVertexArray = function() {};
    context.drawElementsInstanced = function() {};
    context.getBufferSubData = function() {};
    context.vertexAttribDivisor = function() {};

    // Override WebGL2 methods to bypass asserts in src/render/program.js

    // $FlowFixMe[cannot-write]
    context.getShaderParameter = function() { return true; };

    // $FlowFixMe[cannot-write]
    context.getProgramParameter = function() { return true; };

    // $FlowFixMe[method-unbinding]
    const getExtension = context.getExtension;
    // $FlowFixMe[cannot-write]
    context.getExtension = function(extension) {
        if (extension === 'OES_texture_float_linear') return undefined;
        return getExtension(extension);
    };

    return context;
}
