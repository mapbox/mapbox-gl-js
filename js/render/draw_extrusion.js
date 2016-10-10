'use strict';

var mat3 = require('gl-matrix').mat3;
var mat4 = require('gl-matrix').mat4;
var vec3 = require('gl-matrix').vec3;
var Buffer = require('../data/buffer');
var VertexArrayObject = require('./vertex_array_object');
var StructArrayType = require('../util/struct_array');
var setPattern = require('./set_pattern');

module.exports = draw;

function draw(painter, source, layer, coords) {
    if (layer.paint['fill-opacity'] === 0) return;
    var gl = painter.gl;
    gl.disable(gl.STENCIL_TEST);
    painter.depthMask(true);

    // Create a new texture to which to render the extrusion layer. This approach
    // allows us to adjust opacity on a per-layer basis (eliminating the interior
    // walls per-feature opacity problem)
    var texture = new ExtrusionTexture(gl, painter, layer);
    texture.bindFramebuffer();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (var i = 0; i < coords.length; i++) {
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
    var gl = this.gl;

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
        var stencil = gl.createRenderbuffer();
        var depthRenderBuffer = gl.createRenderbuffer();
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

ExtrusionTexture.prototype.TextureBoundsArray = new StructArrayType({
    members: [
        { name: 'a_pos', type: 'Int16', components: 2 }
    ]
});

ExtrusionTexture.prototype.renderToMap = function() {
    var gl = this.gl;
    var painter = this.painter;
    var program = painter.useProgram('fillExtrudeTexture');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.uniform1f(program.u_opacity, this.layer.paint['fill-opacity']);
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

    var array = new this.TextureBoundsArray();
    array.emplaceBack(0, 0);
    array.emplaceBack(painter.width, 0);
    array.emplaceBack(0, painter.height);
    array.emplaceBack(painter.width, painter.height);
    var buffer = new Buffer(array.serialize(), this.TextureBoundsArray.serialize(), Buffer.BufferType.VERTEX);

    var vao = new VertexArrayObject();
    vao.bind(gl, program, buffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.DEPTH_TEST);
};

function drawExtrusion(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;
    var bufferGroups = bucket.bufferGroups.fillextrusion;
    if (!bufferGroups) return;

    if (painter.isOpaquePass) return;

    var gl = painter.gl;

    var image = layer.paint['fill-pattern'];

    var programOptions = bucket.paintAttributes.fillextrusion[layer.id];
    var program = painter.useProgram(
        image ? 'fillExtrudePattern' : 'fillExtrude',
        programOptions.defines,
        programOptions.vertexPragmas,
        programOptions.fragmentPragmas
    );

    if (image) {
        setPattern(image, tile, coord, painter, program, true);
    }

    setMatrix(program, painter, coord, tile, layer);
    setLight(program, painter);

    bucket.setUniforms(gl, 'fillextrusion', program, layer, {zoom: painter.transform.zoom});

    for (var i = 0; i < bufferGroups.length; i++) {
        var group = bufferGroups[i];
        group.vaos[layer.id].bind(gl, program, group.layoutVertexBuffer, group.elementBuffer, group.paintVertexBuffers[layer.id]);
        gl.drawElements(gl.TRIANGLES, group.elementBuffer.length * 3, gl.UNSIGNED_SHORT, 0);
    }
}

function setMatrix(program, painter, coord, tile, layer) {
    var zScale = Math.pow(2, painter.transform.zoom) / 50000;

    painter.gl.uniformMatrix4fv(program.u_matrix, false, mat4.scale(
        mat4.create(),
        painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint['fill-translate'],
            layer.paint['fill-translate-anchor']
        ),
        [1, 1, zScale, 1])
    );
}

function setLight(program, painter) {
    var gl = painter.gl;
    var light = painter.style.light;

    var _lp = light.calculated.position,
        lightPos = [_lp.x, _lp.y, _lp.z];
    var lightMat = mat3.create();
    if (light.calculated.anchor === 'viewport') mat3.fromRotation(lightMat, -painter.transform.angle);
    vec3.transformMat3(lightPos, lightPos, lightMat);

    gl.uniform3fv(program.u_lightpos, lightPos);
    gl.uniform1f(program.u_lightintensity, light.calculated.intensity);
    gl.uniform3fv(program.u_lightcolor, light.calculated.color.slice(0, 3));
}
