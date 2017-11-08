const window = require('../util/window')

const config = {
    logAll: false,
    activeTexture: true,
    depthFunc: true,
    depthMask: true,
    depthRange: true,
    disable: true,
    drawArrays: true,
    drawElements: true,
    enable: true,
    framebufferRenderbuffer: true,
    framebufferTexture2D: true,
    stencilFunc: true,
    stencilMask: true,
    stencilOp: true,
    texImage2D: true
}

function log(logArray) {
    // pick your poison:
    // console.log.apply(console.log, logArray);
    // or
    if (!window.mbglLog) window.mbglLog = [];
    window.mbglLog.push(logArray);
}

class WebGLWrapper {
    constructor(gl) {
        this.gl = gl;
        this.ACTIVE_ATTRIBUTES = this.gl.ACTIVE_ATTRIBUTES;
        this.ACTIVE_UNIFORMS = this.gl.ACTIVE_UNIFORMS;
        this.ALIASED_LINE_WIDTH_RANGE = this.gl.ALIASED_LINE_WIDTH_RANGE;
        this.ALPHA = this.gl.ALPHA;
        this.ALWAYS = this.gl.ALWAYS;
        this.ARRAY_BUFFER = this.gl.ARRAY_BUFFER;
        this.BLEND = this.gl.BLEND;
        this.CLAMP_TO_EDGE = this.gl.CLAMP_TO_EDGE;
        this.COLOR_ATTACHMENT0 = this.gl.COLOR_ATTACHMENT0;
        this.COLOR_BUFFER_BIT = this.gl.COLOR_BUFFER_BIT;
        this.COMPILE_STATUS = this.gl.COMPILE_STATUS;
        this.CONSTANT_COLOR = this.gl.CONSTANT_COLOR;
        this.DEPTH_ATTACHMENT = this.gl.DEPTH_ATTACHMENT;
        this.DEPTH_BUFFER_BIT = this.gl.DEPTH_BUFFER_BIT;
        this.DEPTH_COMPONENT16 = this.gl.DEPTH_COMPONENT16;
        this.DEPTH_TEST = this.gl.DEPTH_TEST;
        this.DYNAMIC_DRAW = this.gl.DYNAMIC_DRAW;
        this.ELEMENT_ARRAY_BUFFER = this.gl.ELEMENT_ARRAY_BUFFER;
        this.EQUAL = this.gl.EQUAL;
        this.FRAGMENT_SHADER = this.gl.FRAGMENT_SHADER;
        this.FRAMEBUFFER = this.gl.FRAMEBUFFER;
        this.FRAMEBUFFER_COMPLETE = this.gl.FRAMEBUFFER_COMPLETE;
        this.KEEP = this.gl.KEEP;
        this.LEQUAL = this.gl.LEQUAL;
        this.LESS = this.gl.LESS;
        this.LINEAR = this.gl.LINEAR;
        this.LINEAR_MIPMAP_NEAREST = this.gl.LINEAR_MIPMAP_NEAREST;
        this.LINES = this.gl.LINES;
        this.LINE_STRIP = this.gl.LINE_STRIP;
        this.LINK_STATUS = this.gl.LINK_STATUS;
        this.NEAREST = this.gl.NEAREST;
        this.ONE = this.gl.ONE;
        this.ONE_MINUS_SRC_ALPHA = this.gl.ONE_MINUS_SRC_ALPHA;
        this.RENDERBUFFER = this.gl.RENDERBUFFER;
        this.REPEAT = this.gl.REPEAT;
        this.REPLACE = this.gl.REPLACE;
        this.RGBA = this.gl.RGBA;
        this.STATIC_DRAW = this.gl.STATIC_DRAW;
        this.STENCIL_BUFFER_BIT = this.gl.STENCIL_BUFFER_BIT;
        this.STENCIL_TEST = this.gl.STENCIL_TEST;
        this.TEXTURE0 = this.gl.TEXTURE0;
        this.TEXTURE1 = this.gl.TEXTURE1;
        this.TEXTURE2 = this.gl.TEXTURE2;
        this.TEXTURE_2D = this.gl.TEXTURE_2D;
        this.TEXTURE_MAG_FILTER = this.gl.TEXTURE_MAG_FILTER;
        this.TEXTURE_MIN_FILTER = this.gl.TEXTURE_MIN_FILTER;
        this.TEXTURE_WRAP_S = this.gl.TEXTURE_WRAP_S;
        this.TEXTURE_WRAP_T = this.gl.TEXTURE_WRAP_T;
        this.TRIANGLES = this.gl.TRIANGLES;
        this.TRIANGLE_STRIP = this.gl.TRIANGLE_STRIP;
        this.UNPACK_ALIGNMENT = this.gl.UNPACK_ALIGNMENT;
        this.UNPACK_PREMULTIPLY_ALPHA_WEBGL = this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL;
        this.UNSIGNED_BYTE = this.gl.UNSIGNED_BYTE;
        this.UNSIGNED_SHORT = this.gl.UNSIGNED_SHORT;
        this.VERTEX_SHADER = this.gl.VERTEX_SHADER;

        // reverse map for enum lookup:
        this[gl.ACTIVE_ATTRIBUTES.toString()] = 'ACTIVE_ATTRIBUTES';
        this[gl.ACTIVE_UNIFORMS.toString()] = 'ACTIVE_UNIFORMS';
        this[gl.ALIASED_LINE_WIDTH_RANGE.toString()] = 'ALIASED_LINE_WIDTH_RANGE';
        this[gl.ALPHA.toString()] = 'ALPHA';
        this[gl.ALWAYS.toString()] = 'ALWAYS';
        this[gl.ARRAY_BUFFER.toString()] = 'ARRAY_BUFFER';
        this[gl.BLEND.toString()] = 'BLEND';
        this[gl.CLAMP_TO_EDGE.toString()] = 'CLAMP_TO_EDGE';
        this[gl.COLOR_ATTACHMENT0.toString()] = 'COLOR_ATTACHMENT0';
        this[gl.COLOR_BUFFER_BIT.toString()] = 'COLOR_BUFFER_BIT';
        this[gl.COMPILE_STATUS.toString()] = 'COMPILE_STATUS';
        this[gl.CONSTANT_COLOR.toString()] = 'CONSTANT_COLOR';
        this[gl.DEPTH_ATTACHMENT.toString()] = 'DEPTH_ATTACHMENT';
        this[gl.DEPTH_BUFFER_BIT.toString()] = 'DEPTH_BUFFER_BIT';
        this[gl.DEPTH_COMPONENT16.toString()] = 'DEPTH_COMPONENT16';
        this[gl.DEPTH_TEST.toString()] = 'DEPTH_TEST';
        this[gl.DYNAMIC_DRAW.toString()] = 'DYNAMIC_DRAW';
        this[gl.ELEMENT_ARRAY_BUFFER.toString()] = 'ELEMENT_ARRAY_BUFFER';
        this[gl.EQUAL.toString()] = 'EQUAL';
        this[gl.FRAGMENT_SHADER.toString()] = 'FRAGMENT_SHADER';
        this[gl.FRAMEBUFFER.toString()] = 'FRAMEBUFFER';
        this[gl.FRAMEBUFFER_COMPLETE.toString()] = 'FRAMEBUFFER_COMPLETE';
        this[gl.KEEP.toString()] = 'KEEP';
        this[gl.LEQUAL.toString()] = 'LEQUAL';
        this[gl.LESS.toString()] = 'LESS';
        this[gl.LINEAR.toString()] = 'LINEAR';
        this[gl.LINEAR_MIPMAP_NEAREST.toString()] = 'LINEAR_MIPMAP_NEAREST';
        this[gl.LINES.toString()] = 'LINES';
        this[gl.LINE_STRIP.toString()] = 'LINE_STRIP';
        this[gl.LINK_STATUS.toString()] = 'LINK_STATUS';
        this[gl.NEAREST.toString()] = 'NEAREST';
        this[gl.ONE.toString()] = 'ONE';
        this[gl.ONE_MINUS_SRC_ALPHA.toString()] = 'ONE_MINUS_SRC_ALPHA';
        this[gl.RENDERBUFFER.toString()] = 'RENDERBUFFER';
        this[gl.REPEAT.toString()] = 'REPEAT';
        this[gl.REPLACE.toString()] = 'REPLACE';
        this[gl.RGBA.toString()] = 'RGBA';
        this[gl.STATIC_DRAW.toString()] = 'STATIC_DRAW';
        this[gl.STENCIL_BUFFER_BIT.toString()] = 'STENCIL_BUFFER_BIT';
        this[gl.STENCIL_TEST.toString()] = 'STENCIL_TEST';
        this[gl.TEXTURE0.toString()] = 'TEXTURE0';
        this[gl.TEXTURE1.toString()] = 'TEXTURE1';
        this[gl.TEXTURE2.toString()] = 'TEXTURE2';
        this[gl.TEXTURE_2D.toString()] = 'TEXTURE_2D';
        this[gl.TEXTURE_MAG_FILTER.toString()] = 'TEXTURE_MAG_FILTER';
        this[gl.TEXTURE_MIN_FILTER.toString()] = 'TEXTURE_MIN_FILTER';
        this[gl.TEXTURE_WRAP_S.toString()] = 'TEXTURE_WRAP_S';
        this[gl.TEXTURE_WRAP_T.toString()] = 'TEXTURE_WRAP_T';
        this[gl.TRIANGLES.toString()] = 'TRIANGLES';
        this[gl.TRIANGLE_STRIP.toString()] = 'TRIANGLE_STRIP';
        this[gl.UNPACK_ALIGNMENT.toString()] = 'UNPACK_ALIGNMENT';
        this[gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL.toString()] = 'UNPACK_PREMULTIPLY_ALPHA_WEBGL';
        this[gl.UNSIGNED_BYTE.toString()] = 'UNSIGNED_BYTE';
        this[gl.UNSIGNED_SHORT.toString()] = 'UNSIGNED_SHORT';
        this[gl.VERTEX_SHADER.toString()] = 'VERTEX_SHADER';

        // this.bindBuffer = this.gl.bindBuffer;
        // this.bufferData = this.gl.bufferData;
        // this.vertexAttribPointer = this.gl.vertexAttribPointer;
    }

    activeTexture() { if (config.logAll || config.activeTexture) log(['gl.activeTexture'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.activeTexture.apply(this.gl, arguments); }
    attachShader() { if (config.logAll || config.attachShader) log(['gl.attachShader'].concat(Array.from(arguments))); return this.gl.attachShader.apply(this.gl, arguments); }
    bindAttribLocation() { if (config.logAll || config.bindAttribLocation) log(['gl.bindAttribLocation'].concat(Array.from(arguments))); return this.gl.bindAttribLocation.apply(this.gl, arguments); }
    bindFramebuffer() { if (config.logAll || config.bindFramebuffer) log(['gl.bindFramebuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.bindFramebuffer.apply(this.gl, arguments); }
    bindRenderbuffer() { if (config.logAll || config.bindRenderbuffer) log(['gl.bindRenderbuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.bindRenderbuffer.apply(this.gl, arguments); }
    bindTexture() { if (config.logAll || config.bindTexture) log(['gl.bindTexture'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.bindTexture.apply(this.gl, arguments); }
    blendColor() { if (config.logAll || config.blendColor) log(['gl.blendColor'].concat(Array.from(arguments))); return this.gl.blendColor.apply(this.gl, arguments); }
    blendFunc() { if (config.logAll || config.blendFunc) log(['gl.blendFunc'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.blendFunc.apply(this.gl, arguments); }
    bufferSubData() { if (config.logAll || config.bufferSubData) log(['gl.bufferSubData'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.bufferSubData.apply(this.gl, arguments); }
    checkFramebufferStatus() { if (config.logAll || config.checkFramebufferStatus) log(['gl.checkFramebufferStatus'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.checkFramebufferStatus.apply(this.gl, arguments); }
    clear() { if (config.logAll || config.clear) log(['gl.clear'].concat(Array.from(arguments))); return this.gl.clear.apply(this.gl, arguments); }
    clearColor() { if (config.logAll || config.clearColor) log(['gl.clearColor'].concat(Array.from(arguments))); return this.gl.clearColor.apply(this.gl, arguments); }
    clearDepth() { if (config.logAll || config.clearDepth) log(['gl.clearDepth'].concat(Array.from(arguments))); return this.gl.clearDepth.apply(this.gl, arguments); }
    clearStencil() { if (config.logAll || config.clearStencil) log(['gl.clearStencil'].concat(Array.from(arguments))); return this.gl.clearStencil.apply(this.gl, arguments); }
    colorMask() { if (config.logAll || config.colorMask) log(['gl.colorMask'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.colorMask.apply(this.gl, arguments); }
    compileShader() { if (config.logAll || config.compileShader) log(['gl.compileShader'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.compileShader.apply(this.gl, arguments); }
    createBuffer() { if (config.logAll || config.createBuffer) log(['gl.createBuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.createBuffer.apply(this.gl, arguments); }
    createFramebuffer() { if (config.logAll || config.createFramebuffer) log(['gl.createFramebuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.createFramebuffer.apply(this.gl, arguments); }
    createProgram() { if (config.logAll || config.createProgram) log(['gl.createProgram'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.createProgram.apply(this.gl, arguments); }
    createRenderbuffer() { if (config.logAll || config.createRenderbuffer) log(['gl.createRenderbuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.createRenderbuffer.apply(this.gl, arguments); }
    createShader() { if (config.logAll || config.createShader) log(['gl.createShader'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.createShader.apply(this.gl, arguments); }
    createTexture() { if (config.logAll || config.createTexture) log(['gl.createTexture'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.createTexture.apply(this.gl, arguments); }
    deleteBuffer() { if (config.logAll || config.deleteBuffer) log(['gl.deleteBuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.deleteBuffer.apply(this.gl, arguments); }
    deleteFramebuffer() { if (config.logAll || config.deleteFramebuffer) log(['gl.deleteFramebuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.deleteFramebuffer.apply(this.gl, arguments); }
    deleteRenderbuffer() { if (config.logAll || config.deleteRenderbuffer) log(['gl.deleteRenderbuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.deleteRenderbuffer.apply(this.gl, arguments); }
    deleteTexture() { if (config.logAll || config.deleteTexture) log(['gl.deleteTexture'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.deleteTexture.apply(this.gl, arguments); }
    depthFunc() { if (config.logAll || config.depthFunc) log(['gl.depthFunc'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.depthFunc.apply(this.gl, arguments); }
    depthMask() { if (config.logAll || config.depthMask) log(['gl.depthMask'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.depthMask.apply(this.gl, arguments); }
    depthRange() { if (config.logAll || config.depthRange) log(['gl.depthRange'].concat(Array.from(arguments))); return this.gl.depthRange.apply(this.gl, arguments); }
    disable() { if (config.logAll || config.disable) log(['gl.disable'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.disable.apply(this.gl, arguments); }
    disableVertexAttribArray() { if (config.logAll || config.disableVertexAttribArray) log(['gl.disableVertexAttribArray'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.disableVertexAttribArray.apply(this.gl, arguments); }
    drawArrays() { if (config.logAll || config.drawArrays) log(['gl.drawArrays'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.drawArrays.apply(this.gl, arguments); }
    drawElements() { if (config.logAll || config.drawElements) log(['gl.drawElements'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.drawElements.apply(this.gl, arguments); }
    drawingBufferHeight() { if (config.logAll || config.drawingBufferHeight) log(['gl.drawingBufferHeight'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.drawingBufferHeight.apply(this.gl, arguments); }
    drawingBufferWidth() { if (config.logAll || config.drawingBufferWidth) log(['gl.drawingBufferWidth'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.drawingBufferWidth.apply(this.gl, arguments); }
    enable() { if (config.logAll || config.enable) log(['gl.enable'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.enable.apply(this.gl, arguments); }
    enableVertexAttribArray() { if (config.logAll || config.enableVertexAttribArray) log(['gl.enableVertexAttribArray'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.enableVertexAttribArray.apply(this.gl, arguments); }
    framebufferRenderbuffer() { if (config.logAll || config.framebufferRenderbuffer) log(['gl.framebufferRenderbuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.framebufferRenderbuffer.apply(this.gl, arguments); }
    framebufferTexture2D() { if (config.logAll || config.framebufferTexture2D) log(['gl.framebufferTexture2D'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.framebufferTexture2D.apply(this.gl, arguments); }
    generateMipmap() { if (config.logAll || config.generateMipmap) log(['gl.generateMipmap'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.generateMipmap.apply(this.gl, arguments); }
    getActiveAttrib() { if (config.logAll || config.getActiveAttrib) log(['gl.getActiveAttrib'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getActiveAttrib.apply(this.gl, arguments); }
    getActiveUniform() { if (config.logAll || config.getActiveUniform) log(['gl.getActiveUniform'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getActiveUniform.apply(this.gl, arguments); }
    getAttribLocation() { if (config.logAll || config.getAttribLocation) log(['gl.getAttribLocation'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getAttribLocation.apply(this.gl, arguments); }
    getExtension() { if (config.logAll || config.getExtension) log(['gl.getExtension'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getExtension.apply(this.gl, arguments); }
    getParameter() { if (config.logAll || config.getParameter) log(['gl.getParameter'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getParameter.apply(this.gl, arguments); }
    getProgramInfoLog() { if (config.logAll || config.getProgramInfoLog) log(['gl.getProgramInfoLog'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getProgramInfoLog.apply(this.gl, arguments); }
    getProgramParameter() { if (config.logAll || config.getProgramParameter) log(['gl.getProgramParameter'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getProgramParameter.apply(this.gl, arguments); }
    getShaderInfoLog() { if (config.logAll || config.getShaderInfoLog) log(['gl.getShaderInfoLog'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getShaderInfoLog.apply(this.gl, arguments); }
    getShaderParameter() { if (config.logAll || config.getShaderParameter) log(['gl.getShaderParameter'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getShaderParameter.apply(this.gl, arguments); }
    getUniformLocation() { if (config.logAll || config.getUniformLocation) log(['gl.getUniformLocation'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.getUniformLocation.apply(this.gl, arguments); }
    lineWidth() { if (config.logAll || config.lineWidth) log(['gl.lineWidth'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.lineWidth.apply(this.gl, arguments); }
    linkProgram() { if (config.logAll || config.linkProgram) log(['gl.linkProgram'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.linkProgram.apply(this.gl, arguments); }
    pixelStorei() { if (config.logAll || config.pixelStorei) log(['gl.pixelStorei'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.pixelStorei.apply(this.gl, arguments); }
    renderbufferStorage() { if (config.logAll || config.renderbufferStorage) log(['gl.renderbufferStorage'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.renderbufferStorage.apply(this.gl, arguments); }
    shaderSource() { if (config.logAll || config.shaderSource) log(['gl.shaderSource'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.shaderSource.apply(this.gl, arguments); }
    stencilFunc() { if (config.logAll || config.stencilFunc) log(['gl.stencilFunc'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.stencilFunc.apply(this.gl, arguments); }
    stencilMask() { if (config.logAll || config.stencilMask) log(['gl.stencilMask'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.stencilMask.apply(this.gl, arguments); }
    stencilOp() { if (config.logAll || config.stencilOp) log(['gl.stencilOp'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.stencilOp.apply(this.gl, arguments); }
    texImage2D() { if (config.logAll || config.texImage2D) log(['gl.texImage2D'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.texImage2D.apply(this.gl, arguments); }
    texParameterf() { if (config.logAll || config.texParameterf) log(['gl.texParameterf'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.texParameterf.apply(this.gl, arguments); }
    texParameteri() { if (config.logAll || config.texParameteri) log(['gl.texParameteri'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.texParameteri.apply(this.gl, arguments); }
    texSubImage2D() { if (config.logAll || config.texSubImage2D) log(['gl.texSubImage2D'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.texSubImage2D.apply(this.gl, arguments); }
    uniform1f() { if (config.logAll || config.uniform1f) log(['gl.uniform1f'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.uniform1f.apply(this.gl, arguments); }
    uniform1i() { if (config.logAll || config.uniform1i) log(['gl.uniform1i'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.uniform1i.apply(this.gl, arguments); }
    uniform2f() { if (config.logAll || config.uniform2f) log(['gl.uniform2f'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.uniform2f.apply(this.gl, arguments); }
    uniform2fv() { if (config.logAll || config.uniform2fv) log(['gl.uniform2fv'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.uniform2fv.apply(this.gl, arguments); }
    uniform3fv() { if (config.logAll || config.uniform3fv) log(['gl.uniform3fv'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.uniform3fv.apply(this.gl, arguments); }
    uniform4f() { if (config.logAll || config.uniform4f) log(['gl.uniform4f'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.uniform4f.apply(this.gl, arguments); }
    uniform4fv() { if (config.logAll || config.uniform4fv) log(['gl.uniform4fv'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.uniform4fv.apply(this.gl, arguments); }
    uniformMatrix4fv() { if (config.logAll || config.uniformMatrix4fv) log(['gl.uniformMatrix4fv'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.uniformMatrix4fv.apply(this.gl, arguments); }
    useProgram() { if (config.logAll || config.useProgram) log(['gl.useProgram'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.useProgram.apply(this.gl, arguments); }
    viewport() { if (config.logAll || config.viewport) log(['gl.viewport'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.viewport.apply(this.gl, arguments); }
    // bindBuffer() { if (config.logAll || config.bindBuffer) log(['gl.bindBuffer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.bindBuffer.apply(this.gl, arguments); }
    // bufferData() { if (config.logAll || config.bufferData) log(['gl.bufferData'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.bufferData.apply(this.gl, arguments); }
    // extVertexArrayObject() { return this.gl.extVertexArrayObject.apply(this.gl, arguments); }
    // vertexAttribPointer() { if (config.logAll || config.vertexAttribPointer) log(['gl.vertexAttribPointer'].concat(Array.from(arguments).map(a => typeof a === 'number' ? (this[a.toString()] || a) : a))); return this.gl.vertexAttribPointer.apply(this.gl, arguments); }
}

module.exports = WebGLWrapper;
