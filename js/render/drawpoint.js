'use strict';

var mat2 = require('../lib/glmatrix.js').mat2;

module.exports = function drawPoint(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite) {
    var type = bucket.info['icon-image'] ? 'icon' : 'circle';

    var begin = bucket.elementGroups.icon.current.vertexStartIndex,
        count = bucket.elementGroups.icon.current.vertexLength,
        shader = type === 'icon' ? painter.pointShader : painter.dotShader;

    var opacity = layerStyle['icon-opacity'];
    if (opacity === 0) return;

    bucket.buffers.pointVertex.bind(gl);

    gl.switchShader(shader, posMatrix, painter.tile.exMatrix);
    gl.uniform4fv(shader.u_color, layerStyle['icon-color'] || [opacity, opacity, opacity, opacity]);

    if (type === 'circle') {
        var diameter = layerStyle['icon-size'] * 2.0 * window.devicePixelRatio;
        gl.uniform1f(shader.u_size, diameter);
        gl.uniform1f(shader.u_blur, layerStyle['point-blur'] / diameter);

        gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 16, 0);

        gl.drawArrays(gl.POINTS, begin, count);

    } else {
        var size = bucket.info['icon-size'] || 12,
            ratio = window.devicePixelRatio;

        gl.uniform2f(shader.u_texsize, imageSprite.img.width, imageSprite.img.height);
        gl.uniform2fv(shader.u_size, [size * ratio, size * ratio]);
        gl.uniform1i(shader.u_invert, layerStyle['icon-invert']);
        gl.uniform1f(shader.u_zoom, (painter.transform.zoom - params.z) * 10.0);
        gl.uniform1i(shader.u_image, 0);

        var rotate = layerStyle['icon-rotate-anchor'] && layerStyle['icon-rotate-anchor'] !== 'viewport';
        var rotationMatrix = rotate ? mat2.clone(painter.tile.rotationMatrix) : mat2.create();
        if (layerStyle['icon-rotate']) {
            mat2.rotate(rotationMatrix, rotationMatrix, layerStyle['icon-rotate']);
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
