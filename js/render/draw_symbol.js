'use strict';

var browser = require('../util/browser');
var mat4 = require('gl-matrix').mat4;

module.exports = drawSymbols;

function drawSymbols(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite) {
    gl.disable(gl.STENCIL_TEST);
    if (bucket.elementGroups.text.groups.length) {
        drawSymbol(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite, 'text');
    }
    if (bucket.elementGroups.icon.groups.length) {
        drawSymbol(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite, 'icon');
    }
    gl.enable(gl.STENCIL_TEST);
}

var defaultSizes = {
    icon: 1,
    text: 24
};

function drawSymbol(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite, prefix) {

    posMatrix = painter.translateMatrix(posMatrix, params.z, layerStyle[prefix + '-translate'], layerStyle[prefix + '-translate-anchor']);

    var layoutProperties = bucket.layoutProperties;

    var exMatrix = mat4.clone(painter.projectionMatrix);
    var alignedWithMap = layoutProperties[prefix + '-rotation-alignment'] === 'map';
    var angleOffset = (alignedWithMap ? painter.transform.angle : 0);

    if (angleOffset) {
        mat4.rotateZ(exMatrix, exMatrix, angleOffset);
    }

    // If layerStyle.size > layoutProperties[prefix + '-max-size'] then labels may collide
    var fontSize = layerStyle[prefix + '-size'] || layoutProperties[prefix + '-max-size'];
    var fontScale = fontSize / defaultSizes[prefix];
    mat4.scale(exMatrix, exMatrix, [ fontScale, fontScale, 1 ]);

    var text = prefix === 'text';
    var sdf = text || bucket.elementGroups.sdfIcons;
    var shader, buffer, texsize;

    if (!text && !imageSprite.loaded())
        return;

    gl.activeTexture(gl.TEXTURE0);

    if (sdf) {
        shader = painter.sdfShader;
    } else {
        shader = painter.iconShader;
    }

    if (text) {
        painter.glyphAtlas.updateTexture(gl);
        buffer = bucket.buffers.glyphVertex;
        texsize = [painter.glyphAtlas.width / 4, painter.glyphAtlas.height / 4];
    } else {
        painter.spriteAtlas.setSprite(imageSprite);
        painter.spriteAtlas.bind(gl, alignedWithMap || params.rotating || params.zooming || fontScale != 1 || sdf);
        buffer = bucket.buffers.iconVertex;
        texsize = [painter.spriteAtlas.width / 4, painter.spriteAtlas.height / 4];
    }

    gl.switchShader(shader, posMatrix, exMatrix);
    gl.uniform1i(shader.u_texture, 0);
    gl.uniform2fv(shader.u_texsize, texsize);

    buffer.bind(gl, shader);

    // Convert the -pi..pi to an int8 range.
    var angle = Math.round(painter.transform.angle / Math.PI * 128);

    // adjust min/max zooms for variable font sies
    var zoomAdjust = Math.log(fontSize / layoutProperties[prefix + '-max-size']) / Math.LN2 || 0;

    var flip = alignedWithMap && layoutProperties[prefix + '-keep-upright'];
    gl.uniform1f(shader.u_flip, flip ? 1 : 0);
    gl.uniform1f(shader.u_angle, (angle + 256) % 256);
    gl.uniform1f(shader.u_zoom, (painter.transform.zoom - zoomAdjust) * 10); // current zoom level

    var f = painter.frameHistory.getFadeProperties(300);
    gl.uniform1f(shader.u_fadedist, f.fadedist * 10);
    gl.uniform1f(shader.u_minfadezoom, Math.floor(f.minfadezoom * 10));
    gl.uniform1f(shader.u_maxfadezoom, Math.floor(f.maxfadezoom * 10));
    gl.uniform1f(shader.u_fadezoom, (painter.transform.zoom + f.bump) * 10);

    var begin = bucket.elementGroups[prefix].groups[0].vertexStartIndex,
        len = bucket.elementGroups[prefix].groups[0].vertexLength;

    if (sdf) {
        var sdfPx = 8;
        var blurOffset = 1.19;
        var haloOffset = 6;
        var gamma = 0.105 * defaultSizes[prefix] / fontSize / browser.devicePixelRatio;

        gl.uniform1f(shader.u_gamma, gamma);
        gl.uniform4fv(shader.u_color, layerStyle[prefix + '-color']);
        gl.uniform1f(shader.u_buffer, (256 - 64) / 256);
        gl.drawArrays(gl.TRIANGLES, begin, len);

        if (layerStyle[prefix + '-halo-color']) {
            // Draw halo underneath the text.
            gl.uniform1f(shader.u_gamma, layerStyle[prefix + '-halo-blur'] * blurOffset / fontScale / sdfPx + gamma);
            gl.uniform4fv(shader.u_color, layerStyle[prefix + '-halo-color']);
            gl.uniform1f(shader.u_buffer, (haloOffset - layerStyle[prefix + '-halo-width'] / fontScale) / sdfPx);
            gl.drawArrays(gl.TRIANGLES, begin, len);
        }
    } else {
        gl.uniform1f(shader.u_opacity, layerStyle['icon-opacity']);
        gl.drawArrays(gl.TRIANGLES, begin, len);
    }
}
