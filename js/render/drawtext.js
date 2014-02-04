'use strict';

var glmatrix = require('../lib/glmatrix.js');
var mat4 = glmatrix.mat4;

module.exports = drawText;

function drawText(gl, painter, layer, layerStyle, tile, stats, params, bucket_info) {
    var exMatrix = mat4.create();
    mat4.identity(exMatrix);
    mat4.multiply(exMatrix, painter.projectionMatrix, exMatrix);
    if (bucket_info.path == 'curve') {
        mat4.rotateZ(exMatrix, exMatrix, painter.transform.angle);
    }
    mat4.scale(exMatrix, exMatrix, [ bucket_info.fontSize / 24, bucket_info.fontSize / 24, 1 ]);

    gl.switchShader(painter.sdfShader, painter.translatedMatrix || painter.posMatrix, exMatrix);
    // gl.disable(gl.STENCIL_TEST);

    painter.glyphAtlas.updateTexture(gl);

    gl.uniform2f(painter.sdfShader.u_texsize, painter.glyphAtlas.width, painter.glyphAtlas.height);

    tile.geometry.glyphVertex.bind(gl);
    gl.vertexAttribPointer(painter.sdfShader.a_pos, 2, gl.SHORT, false, 24, 0);
    gl.vertexAttribPointer(painter.sdfShader.a_offset, 2, gl.SHORT, false, 24, 4);
    gl.vertexAttribPointer(painter.sdfShader.a_tex, 2, gl.UNSIGNED_SHORT, false, 24, 8);
    gl.vertexAttribPointer(painter.sdfShader.a_angle, 1, gl.UNSIGNED_SHORT, false, 24, 12);
    gl.vertexAttribPointer(painter.sdfShader.a_minzoom, 1, gl.UNSIGNED_SHORT, false, 24, 14);
    gl.vertexAttribPointer(painter.sdfShader.a_rangeend, 1, gl.UNSIGNED_SHORT, false, 24, 16);
    gl.vertexAttribPointer(painter.sdfShader.a_rangestart, 1, gl.UNSIGNED_SHORT, false, 24, 18);
    gl.vertexAttribPointer(painter.sdfShader.a_maxzoom, 1, gl.UNSIGNED_SHORT, false, 24, 20);
    gl.vertexAttribPointer(painter.sdfShader.a_labelminzoom, 1, gl.UNSIGNED_SHORT, false, 24, 22);

    if (!params.antialiasing) {
        gl.uniform1f(painter.sdfShader.u_gamma, 0);
    } else {
        gl.uniform1f(painter.sdfShader.u_gamma, 2.5 / bucket_info.fontSize / window.devicePixelRatio);
    }

    // Convert the -pi/2..pi/2 to an int16 range.
    var angle = painter.transform.angle * 32767 / (Math.PI / 2);
    gl.uniform1f(painter.sdfShader.u_angle, angle);

    gl.uniform1f(painter.sdfShader.u_flip, bucket_info.path === 'curve' ? 1 : 0);

    // current zoom level
    gl.uniform1f(painter.sdfShader.u_zoom, Math.floor(painter.transform.z * 10));

    var begin = layer.glyphVertexIndex;
    var end = layer.glyphVertexIndexEnd;


    var duration = 200;
    var currentTime = frameHistory[frameHistory.length - 1].time;

    while (frameHistory[0].time + duration < currentTime) {
        frameHistory.shift();
    }

    var fade = painter.transform.z - frameHistory[0].z;

    gl.uniform1f(painter.sdfShader.u_fadedist, fade * 10 || 0);

    // Draw text first.
    gl.uniform4fv(painter.sdfShader.u_color, layerStyle.color.gl());
    gl.uniform1f(painter.sdfShader.u_buffer, (256 - 64) / 256);
    gl.drawArrays(gl.TRIANGLES, begin, end - begin);

    stats.triangles += end - begin;

    if (layerStyle.stroke) {
        // Draw halo underneath the text.
        gl.uniform4fv(painter.sdfShader.u_color, layerStyle.stroke.gl());
        gl.uniform1f(painter.sdfShader.u_buffer, 64 / 256);
        gl.drawArrays(gl.TRIANGLES, begin, end - begin);
    }

    // gl.enable(gl.STENCIL_TEST);
}

// Store previous render times
var frameHistory = [];

drawText.frame = function(painter) {
    var currentTime = (new Date()).getTime();

    if (frameHistory.length === 0) {
        frameHistory.push({ time: currentTime, z: painter.transform.z });
    }

    frameHistory.push({
        time: currentTime,
        z: painter.transform.z
    });
};
