'use strict';

var mat4 = require('../lib/glmatrix.js').mat4;

module.exports = drawText;

function drawText(gl, painter, bucket, layerStyle, params) {

    var exMatrix = mat4.clone(painter.projectionMatrix);
    if (bucket.info.path == 'curve') {
        mat4.rotateZ(exMatrix, exMatrix, painter.transform.angle);
    }

    var rotate = layerStyle.rotate || 0;
    if (rotate) {
        mat4.rotateZ(exMatrix, exMatrix, rotate);
    }

    // If layerStyle.size > bucket.info.fontSize then labels may collide
    var fontSize = layerStyle.size || bucket.info.fontSize;
    mat4.scale(exMatrix, exMatrix, [ fontSize / 24, fontSize / 24, 1 ]);

    var shader = painter.sdfShader;

    gl.switchShader(shader, painter.translatedMatrix || painter.posMatrix, exMatrix);
    // gl.disable(gl.STENCIL_TEST);

    painter.glyphAtlas.updateTexture(gl);
    gl.uniform2f(shader.u_texsize, painter.glyphAtlas.width, painter.glyphAtlas.height);

    bucket.geometry.glyphVertex.bind(gl);

    var ubyte = gl.UNSIGNED_BYTE;

    gl.vertexAttribPointer(shader.a_pos,          2, gl.SHORT, false, 16, 0);
    gl.vertexAttribPointer(shader.a_offset,       2, gl.SHORT, false, 16, 4);
    gl.vertexAttribPointer(shader.a_tex,          2, ubyte,    false, 16, 8);
    gl.vertexAttribPointer(shader.a_labelminzoom, 1, ubyte,    false, 16, 10);
    gl.vertexAttribPointer(shader.a_minzoom,      1, ubyte,    false, 16, 11);
    gl.vertexAttribPointer(shader.a_maxzoom,      1, ubyte,    false, 16, 12);
    gl.vertexAttribPointer(shader.a_angle,        1, ubyte,    false, 16, 13);
    gl.vertexAttribPointer(shader.a_rangeend,     1, ubyte,    false, 16, 14);
    gl.vertexAttribPointer(shader.a_rangestart,   1, ubyte,    false, 16, 15);

    gl.uniform1f(shader.u_gamma, params.antialiasing ? 2.5 / bucket.info.fontSize / window.devicePixelRatio : 0);

    // Convert the -pi..pi to an int8 range.
    var angle = Math.round((painter.transform.angle + rotate) / Math.PI * 128);

    // adjust min/max zooms for variable font sies
    var zoomAdjust = Math.log(fontSize / bucket.info.fontSize) / Math.LN2;

    gl.uniform1f(shader.u_angle, (angle + 256) % 256);
    gl.uniform1f(shader.u_flip, bucket.info.path === 'curve' ? 1 : 0);
    gl.uniform1f(shader.u_zoom, (painter.transform.z - zoomAdjust) * 10); // current zoom level

    // Label fading

    var duration = 300,
        currentTime = (new Date()).getTime();

    // Remove frames until only one is outside the duration, or until there are only three
    while (frameHistory.length > 3 && frameHistory[1].time + duration < currentTime) {
        frameHistory.shift();
    }

    if (frameHistory[1].time + duration < currentTime) {
        frameHistory[0].z = frameHistory[1].z;
    }

    var frameLen = frameHistory.length;
    if (frameLen < 3) console.warn('there should never be less than three frames in the history');

    // Find the range of zoom levels we want to fade between
    var startingZ = frameHistory[0].z,
        lastFrame = frameHistory[frameLen - 1],
        endingZ = lastFrame.z,
        lowZ = Math.min(startingZ, endingZ),
        highZ = Math.max(startingZ, endingZ);

    // Calculate the speed of zooming, and how far it would zoom in terms of zoom levels in one duration
    var zoomDiff = lastFrame.z - frameHistory[1].z,
        timeDiff = lastFrame.time - frameHistory[1].time;
    if (timeDiff > duration) timeDiff = 1;
    var fadedist = zoomDiff / (timeDiff / duration);

    if (isNaN(fadedist)) console.warn('fadedist should never be NaN');

    // At end of a zoom when the zoom stops changing continue pretending to zoom at that speed
    // bump is how much farther it would have been if it had continued zooming at the same rate
    var bump = (currentTime - lastFrame.time) / duration * fadedist;

    gl.uniform1f(shader.u_fadedist, fadedist * 10);
    gl.uniform1f(shader.u_minfadezoom, Math.floor(lowZ * 10));
    gl.uniform1f(shader.u_maxfadezoom, Math.floor(highZ * 10));
    gl.uniform1f(shader.u_fadezoom, (painter.transform.z + bump) * 10);

    // Draw text first.
    gl.uniform4fv(shader.u_color, layerStyle.color);
    gl.uniform1f(shader.u_buffer, (256 - 64) / 256);

    var begin = bucket.indices.glyphVertexIndex,
        len = bucket.indices.glyphVertexIndexEnd - begin;

    gl.drawArrays(gl.TRIANGLES, begin, len);

    if (layerStyle.stroke) {
        // Draw halo underneath the text.
        gl.uniform4fv(shader.u_color, layerStyle.stroke);
        gl.uniform1f(shader.u_buffer, 64 / 256);

        gl.drawArrays(gl.TRIANGLES, begin, len);
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
        frameHistory.push({time: 0, z: 0}, {time: 0, z: 0});
    }

    if (frameHistory.length === 2 || frameHistory[frameHistory.length - 1].z !== painter.transform.z) {
        frameHistory.push({
            time: currentTime,
            z: painter.transform.z
        });
    }
};

