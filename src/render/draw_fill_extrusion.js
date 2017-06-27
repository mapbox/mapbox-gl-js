
const glMatrix = require('@mapbox/gl-matrix');
const Buffer = require('../data/buffer');
const VertexArrayObject = require('./vertex_array_object');
const PosArray = require('../data/pos_array');
const pattern = require('./pattern');
const mat3 = glMatrix.mat3;
const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

module.exports = draw;

function draw(painter, source, layer, coords) {
    if (painter.isOpaquePass) return;
    if (layer.paint['fill-extrusion-opacity'] === 0) return;

    const gl = painter.gl;
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.DEPTH_TEST);
    painter.depthMask(true);

    // Create a new texture to which to render the extrusion layer. This approach
    // allows us to adjust opacity on a per-layer basis (eliminating the interior
    // walls per-feature opacity problem)
    const texture = renderToTexture(gl, painter);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (let i = 0; i < coords.length; i++) {
        drawExtrusion(painter, source, layer, coords[i]);
    }

    // Unbind the framebuffer as a render target and render it to the map
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderTextureToMap(gl, painter, layer, texture);
}

function renderToTexture(gl, painter) {
    gl.activeTexture(gl.TEXTURE1);

    let texture = painter.viewportTexture;
    if (!texture) {
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, painter.width, painter.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        painter.viewportTexture = texture;
    } else {
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    let fbo = painter.viewportFbo;
    if (!fbo) {
        fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const depthRenderBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, painter.width, painter.height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);
        painter.viewportFbo = fbo;
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    }

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    return texture;
}

function renderTextureToMap(gl, painter, layer, texture) {
    const program = painter.useProgram('extrusionTexture');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1f(program.u_opacity, layer.paint['fill-extrusion-opacity']);
    gl.uniform1i(program.u_image, 1);

    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);
    gl.uniformMatrix4fv(program.u_matrix, false, matrix);

    gl.disable(gl.DEPTH_TEST);

    gl.uniform2f(program.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    const array = new PosArray();
    array.emplaceBack(0, 0);
    array.emplaceBack(1, 0);
    array.emplaceBack(0, 1);
    array.emplaceBack(1, 1);
    const buffer = Buffer.fromStructArray(array, Buffer.BufferType.VERTEX);

    const vao = new VertexArrayObject();
    vao.bind(gl, program, buffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.DEPTH_TEST);
}

function drawExtrusion(painter, source, layer, coord) {
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
        if (pattern.isPatternMissing(image, painter)) return;
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
