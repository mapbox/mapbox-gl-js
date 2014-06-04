'use strict';

var mat2 = require('../lib/glmatrix.js').mat2;

module.exports = function drawPoint(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite) {
    var type = bucket.info['point-image'] ? 'point' : 'circle';

    var begin = bucket.indices.pointVertexIndex,
        count = bucket.indices.pointVertexIndexEnd - begin,
        shader = type === 'point' ? painter.pointShader : painter.dotShader;

    var opacity = layerStyle['point-opacity'];
    if (opacity === 0) return;

    bucket.geometry.pointVertex.bind(gl);

    gl.switchShader(shader, posMatrix, painter.tile.exMatrix);
    gl.uniform4fv(shader.u_color, layerStyle['point-color'] || [opacity, opacity, opacity, opacity]);
    gl.uniform2f(shader.u_texsize, imageSprite.img.width, imageSprite.img.height);

    if (type === 'circle') {
        var diameter = (layerStyle['point-radius'] * 2.0 || 8.0) * window.devicePixelRatio;
        gl.uniform1f(shader.u_size, diameter);
        gl.uniform1f(shader.u_blur, (layerStyle['point-blur'] || 1.5) / diameter);

        gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 16, 0);

        gl.drawArrays(gl.POINTS, begin, count);

    } else {
        var size = bucket.info['point-size'] || [12,12];
        size[0] *= window.devicePixelRatio;
        size[1] *= window.devicePixelRatio;

        gl.uniform2fv(shader.u_size, size);
        gl.uniform1i(shader.u_invert, layerStyle['point-invert']);
        gl.uniform1f(shader.u_zoom, (painter.transform.zoom - params.z) * 10.0);
        gl.uniform1i(shader.u_image, 0);

        var rotate = layerStyle['point-alignment'] && layerStyle['point-alignment'] !== 'screen';
        var rotationMatrix = rotate ? mat2.clone(painter.tile.rotationMatrix) : mat2.create();
        if (layerStyle['point-rotate']) {
            mat2.rotate(rotationMatrix, rotationMatrix, layerStyle['point-rotate']);
        }
        gl.uniformMatrix2fv(shader.u_rotationmatrix, false, rotationMatrix);

        // if icons are drawn rotated, or of the map is rotating use linear filtering for textures
        gl.activeTexture(gl.TEXTURE0);
        imageSprite.bind(gl, rotate || params.rotating || params.zooming);

        gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 16, 0);
        gl.vertexAttribPointer(shader.a_tl, 4, gl.SHORT, false, 16, 4);
        gl.vertexAttribPointer(shader.a_br, 4, gl.SHORT, false, 16, 8);
        gl.vertexAttribPointer(shader.a_minzoom, 1, gl.BYTE, false, 16, 12);
        gl.vertexAttribPointer(shader.a_angle, 1, gl.BYTE, false, 16, 13);

        gl.drawArrays(gl.POINTS, begin, count);
    }
};
