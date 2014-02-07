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
    gl.uniform1f(painter.sdfShader.u_zoom, painter.transform.z * 10);

    var begin = layer.glyphVertexIndex;
    var end = layer.glyphVertexIndexEnd;


    // Label fading

    var duration = 300;
    var currentTime = (new Date()).getTime();

    // Remove frames until only one is outside the duration, or until there are only three
    while (frameHistory.length > 3 && frameHistory[1].time + duration < currentTime) {
        frameHistory.shift();
    }

    if (frameHistory[1].time + duration < currentTime) {
        frameHistory[0].z = frameHistory[1].z;
    }

    var len = frameHistory.length;
    if (len < 3) throw('there should never be less than three frames in the history');

    // Find the range of zoom levels we want to fade between
    var startingZ = frameHistory[0].z;
    var endingZ = frameHistory[len - 1].z;
    var lowZ = Math.min(startingZ, endingZ);
    var highZ = Math.max(startingZ, endingZ);

    // Calculate the speed of zooming, and how far it would zoom
    // in terms of zoom levels in one duration
    var zoomDiff = frameHistory[len - 1].z - frameHistory[1].z;
    var timeDiff = frameHistory[len - 1].time - frameHistory[1].time;
    if (timeDiff > duration) timeDiff = 1;
    var portion = timeDiff / duration;
    var fadedist = zoomDiff / portion;

    if (isNaN(fadedist)) throw('fadedist should never be NaN');
    if (fadedist === 0) throw('fadedist should never be 0');

    // At end of a zoom when the zoom stops changing continue pretending to zoom at that speed
    // bump is how much farther it would have been if it had continued zooming at the same rate
    var timeSinceLastZoomChange = currentTime - frameHistory[len - 1].time;
    var bump = timeSinceLastZoomChange / duration * fadedist;

    gl.uniform1f(painter.sdfShader.u_fadedist, fadedist * 10);
    gl.uniform1f(painter.sdfShader.u_minfadezoom, Math.floor(lowZ * 10));
    gl.uniform1f(painter.sdfShader.u_maxfadezoom, Math.floor(highZ * 10));
    gl.uniform1f(painter.sdfShader.u_fadezoombump, bump* 10);

    // Draw text first.
    gl.uniform4fv(painter.sdfShader.u_color, layerStyle.color);
    gl.uniform1f(painter.sdfShader.u_buffer, (256 - 64) / 256);
    gl.drawArrays(gl.TRIANGLES, begin, end - begin);

    stats.triangles += end - begin;

    if (layerStyle.stroke) {
        // Draw halo underneath the text.
        gl.uniform4fv(painter.sdfShader.u_color, layerStyle.stroke);
        gl.uniform1f(painter.sdfShader.u_buffer, 64 / 256);
        gl.drawArrays(gl.TRIANGLES, begin, end - begin);
    }

    // gl.enable(gl.STENCIL_TEST);
}

// Store previous render times
var frameHistory = [];

// Record frame history that will be used to calculate fading params
drawText.frame = function(painter) {
    var currentTime = (new Date()).getTime();

    // first frame ever
    if (!frameHistory.length) {
        frameHistory.push({
            time: 0,
            z: 0
        }, {
            time: 0,
            z: 0
        });
    }

    if (frameHistory.length === 2 || frameHistory[frameHistory.length - 1].z !== painter.transform.z) {
        frameHistory.push({
            time: currentTime,
            z: painter.transform.z
        });
    } else {
    }
};

