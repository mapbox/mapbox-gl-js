'use strict';

const mat3 = require('gl-matrix').mat3;
const mat4 = require('gl-matrix').mat4;
const vec3 = require('gl-matrix').vec3;
const Buffer = require('../data/buffer');
const VertexArrayObject = require('./vertex_array_object');
const PosArray = require('../data/pos_array');
const pattern = require('./pattern');

module.exports = draw;

function draw(painter, source, layer, coords) {
    if (layer.paint['fill-extrusion-opacity'] === 0) return;
    const gl = painter.gl;
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.DEPTH_TEST);
    painter.depthMask(true);

    // Create a new texture to which to render the extrusion layer. This approach
    // allows us to adjust opacity on a per-layer basis (eliminating the interior
    // walls per-feature opacity problem)
    const texture = new ExtrusionTexture(gl, painter, layer);
    texture.bindFramebuffer();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (let i = 0; i < coords.length; i++) {
        drawExtrusion(painter, source, layer, coords[i]);
    }

    // Unbind the framebuffer as a render target and render it to the map
    texture.unbindFramebuffer();
    texture.renderToMap();
}

function ExtrusionTexture(gl, painter, layer) {
    this.gl = gl;
    this.width = painter.width;
    this.height = painter.height;
    this.painter = painter;
    this.layer = layer;

    this.texture = null;
    this.fbo = null;
    this.fbos = this.painter.preFbos[this.width] && this.painter.preFbos[this.width][this.height];
}

ExtrusionTexture.prototype.bindFramebuffer = function() {
    const gl = this.gl;

    this.texture = this.painter.getViewportTexture(this.width, this.height);

    gl.activeTexture(gl.TEXTURE1);
    if (!this.texture) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        this.texture.width = this.width;
        this.texture.height = this.height;
    } else {
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }

    if (!this.fbos) {
        this.fbo = gl.createFramebuffer();
        const stencil = gl.createRenderbuffer();
        const depthRenderBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, this.width, this.height);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, stencil);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    } else {
        this.fbo = this.fbos.pop();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    }
};

ExtrusionTexture.prototype.unbindFramebuffer = function() {
    this.painter.bindDefaultFramebuffer();
    if (this.fbos) {
        this.fbos.push(this.fbo);
    } else {
        if (!this.painter.preFbos[this.width]) this.painter.preFbos[this.width] = {};
        this.painter.preFbos[this.width][this.height] = [this.fbo];
    }
    this.painter.saveViewportTexture(this.texture);
};

ExtrusionTexture.prototype.renderToMap = function() {
    const gl = this.gl;
    const painter = this.painter;
    const program = painter.useProgram('extrusionTexture');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.uniform1f(program.u_opacity, this.layer.paint['fill-extrusion-opacity']);
    gl.uniform1i(program.u_texture, 1);

    gl.uniformMatrix4fv(program.u_matrix, false, mat4.ortho(
        mat4.create(),
        0,
        painter.width,
        painter.height,
        0,
        0,
        1)
    );

    gl.disable(gl.DEPTH_TEST);

    gl.uniform1i(program.u_xdim, painter.width);
    gl.uniform1i(program.u_ydim, painter.height);

    const array = new PosArray();
    array.emplaceBack(0, 0);
    array.emplaceBack(painter.width, 0);
    array.emplaceBack(0, painter.height);
    array.emplaceBack(painter.width, painter.height);
    const buffer = Buffer.fromStructArray(array, Buffer.BufferType.VERTEX);

    const vao = new VertexArrayObject();
    vao.bind(gl, program, buffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.DEPTH_TEST);
};

function drawExtrusion(painter, source, layer, coord) {
    if (painter.isOpaquePass) return;

    const tile = source.getTile(coord);
    const bucket = tile.getBucket(layer);
    if (!bucket) return;

    const buffers = bucket.buffers;
    const gl = painter.gl;

    const image = layer.paint['fill-extrusion-pattern'];

    const layerData = buffers.layerData[layer.id];
    const programConfiguration = layerData.programConfiguration;
    const program = painter.useProgram(image ? 'fillExtrusionPattern' : 'fillExtrusion', programConfiguration);
    programConfiguration.setUniforms(gl, program, layer, {zoom: painter.transform.zoom});

    if (image) {
        pattern.prepare(image, painter, program);
        pattern.setTile(tile, painter, program);
        gl.uniform1f(program.u_height_factor, -Math.pow(2, coord.z) / tile.tileSize / 8);
    }

    painter.gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['fill-extrusion-translate'],
        layer.paint['fill-extrusion-translate-anchor']
    ));

    setLight(program, painter);

    for (const segment of buffers.segments) {
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, layerData.paintVertexBuffer, segment.vertexOffset);
        gl.drawElements(gl.TRIANGLES, segment.primitiveLength * 3, gl.UNSIGNED_SHORT, segment.primitiveOffset * 3 * 2);
    }
}

function setLight(program, painter) {
    const gl = painter.gl;
    const light = painter.style.light;

    const _lp = light.calculated.position,
        lightPos = [_lp.x, _lp.y, _lp.z];
    const lightMat = mat3.create();
    if (light.calculated.anchor === 'viewport') mat3.fromRotation(lightMat, -painter.transform.angle);
    vec3.transformMat3(lightPos, lightPos, lightMat);

    gl.uniform3fv(program.u_lightpos, lightPos);
    gl.uniform1f(program.u_lightintensity, light.calculated.intensity);
    gl.uniform3fv(program.u_lightcolor, light.calculated.color.slice(0, 3));
}
