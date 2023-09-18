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

    // $FlowFixMe[incompatible-use]
    context.getShaderParameter = function() { return true; };

    // $FlowFixMe[incompatible-use]
    context.getProgramParameter = function() { return true; };

    // $FlowFixMe[incompatible-use]
    const getExtension = context.getExtension;
    // $FlowFixMe[incompatible-use]
    context.getExtension = function(extension) {
        if (extension === 'OES_texture_float_linear') return undefined;
        return getExtension(extension);
    };

    return context;
}
