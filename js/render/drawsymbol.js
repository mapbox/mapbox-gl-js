'use strict';

var browser = require('../util/browser.js');
var mat4 = require('../lib/glmatrix.js').mat4;

module.exports = drawSymbols;

function drawSymbols(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite) {
    if (bucket.elementGroups.text.groups.length) {
        drawSymbol(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite, 'text');
    }
    if (bucket.elementGroups.icon.groups.length) {
        drawSymbol(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite, 'icon');
    }
}

var defaultSizes = {
    icon: 1,
    text: 24
};

function drawSymbol(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite, prefix) {

    posMatrix = painter.translateMatrix(posMatrix, layerStyle[prefix + '-translate'], params.z);

    var info = bucket.info;

    var exMatrix = mat4.clone(painter.projectionMatrix);
    var angleOffset = (info[prefix + '-rotation-alignment'] === 'map' ? painter.transform.angle : 0) -
            (info[prefix + '-rotate'] || 0) * Math.PI / 180;

    if (angleOffset) {
        mat4.rotateZ(exMatrix, exMatrix, angleOffset);
    }

    // If layerStyle.size > info[prefix + '-max-size'] then labels may collide
    var fontSize = layerStyle[prefix + '-size'] || info[prefix + '-max-size'];
    var fontScale = fontSize / defaultSizes[prefix];
    mat4.scale(exMatrix, exMatrix, [ fontScale, fontScale, 1 ]);

    var text = prefix === 'text';
    var sdf = text || bucket.elementGroups.sdfIcons;
    var shader, buffer, texsize;

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
        imageSprite.bind(gl, angleOffset !== undefined || params.rotating || params.zooming || fontScale != 1 || sdf);
        buffer = bucket.buffers.iconVertex;
        texsize = [imageSprite.img.width, imageSprite.img.height];
    }

    gl.switchShader(shader, posMatrix, exMatrix);
    gl.uniform1i(shader.u_image, 0);
    gl.uniform2fv(shader.u_texsize, texsize);

    buffer.bind(gl);

    var ubyte = gl.UNSIGNED_BYTE;

    var stride = text ? 16 : 20;

    gl.vertexAttribPointer(shader.a_pos,          2, gl.SHORT, false, stride, 0);
    gl.vertexAttribPointer(shader.a_offset,       2, gl.SHORT, false, stride, 4);
    gl.vertexAttribPointer(shader.a_labelminzoom, 1, ubyte,    false, stride, 8);
    gl.vertexAttribPointer(shader.a_minzoom,      1, ubyte,    false, stride, 9);
    gl.vertexAttribPointer(shader.a_maxzoom,      1, ubyte,    false, stride, 10);
    gl.vertexAttribPointer(shader.a_angle,        1, ubyte,    false, stride, 11);
    gl.vertexAttribPointer(shader.a_rangeend,     1, ubyte,    false, stride, 12);
    gl.vertexAttribPointer(shader.a_rangestart,   1, ubyte,    false, stride, 13);

    if (text) {
        gl.vertexAttribPointer(shader.a_tex,          2, ubyte,     false, stride, 14);
    } else {
        gl.vertexAttribPointer(shader.a_tex,          2, gl.SHORT,  false, stride, 16);
    }

    // Convert the -pi..pi to an int8 range.
    var angle = Math.round((painter.transform.angle) / Math.PI * 128);

    // adjust min/max zooms for variable font sies
    var zoomAdjust = Math.log(fontSize / info[prefix + '-max-size']) / Math.LN2 || 0;

    var flip = info['symbol-rotation-alignment'] !== 'viewport' && info[prefix + '-keep-upright'];
    gl.uniform1f(shader.u_flip, flip ? 1 : 0);
    gl.uniform1f(shader.u_angle, (angle + 256) % 256);
    gl.uniform1f(shader.u_zoom, (painter.transform.zoom - zoomAdjust) * 10); // current zoom level

    var f = painter.frameHistory.getFadeProperties(300);
    gl.uniform1f(shader.u_fadedist, f.fadedist * 10);
    gl.uniform1f(shader.u_minfadezoom, Math.floor(f.minfadezoom * 10));
    gl.uniform1f(shader.u_maxfadezoom, Math.floor(f.maxfadezoom * 10));
    gl.uniform1f(shader.u_fadezoom, (painter.transform.zoom + f.bump) * 10);

    var sdfFontSize = text ? 24 : 1;
    var sdfPx = 8;
    var blurOffset = 1.19;
    var haloOffset = 6;

    if (sdf) {

        gl.uniform1f(shader.u_gamma, 0.105 * sdfFontSize / fontSize / browser.devicePixelRatio);
        gl.uniform4fv(shader.u_color, layerStyle[prefix + '-color']);
        gl.uniform1f(shader.u_buffer, (256 - 64) / 256);
    }

    var begin = bucket.elementGroups[prefix].groups[0].vertexStartIndex,
        len = bucket.elementGroups[prefix].groups[0].vertexLength;

    gl.drawArrays(gl.TRIANGLES, begin, len);

    if (sdf && layerStyle[prefix + '-halo-color']) {
        // Draw halo underneath the text.
        gl.uniform1f(shader.u_gamma, (layerStyle[prefix + '-halo-blur'] * blurOffset / (fontSize / sdfFontSize) / sdfPx) + (0.105 * sdfFontSize / fontSize) / browser.devicePixelRatio);
        gl.uniform4fv(shader.u_color, layerStyle[prefix + '-halo-color']);
        gl.uniform1f(shader.u_buffer, (haloOffset - layerStyle[prefix + '-halo-width'] / (fontSize / sdfFontSize)) / sdfPx);

        gl.drawArrays(gl.TRIANGLES, begin, len);
    }
    // gl.enable(gl.STENCIL_TEST);
}
