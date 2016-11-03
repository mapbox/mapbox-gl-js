'use strict';

const pattern = require('./pattern');

module.exports = drawBackground;

function drawBackground(painter, sourceCache, layer) {
    const gl = painter.gl;
    const color = layer.paint['background-color'];
    const image = layer.paint['background-pattern'];
    const opacity = layer.paint['background-opacity'];

    const isOpaque = !image && color[3] === 1 && opacity === 1;
    if (painter.isOpaquePass !== isOpaque) return;

    // if the background layer is bottommost and not patterned,
    // we render it with gl.clearColor earlier
    if (!image && painter.currentLayer === 0) return;

    gl.disable(gl.STENCIL_TEST);

    painter.setDepthSublayer(0);

    let program;
    if (image) {
        program = painter.useProgram('fillPattern');
        pattern.prepare(image, painter, program);
        painter.tileExtentPatternVAO.bind(gl, program, painter.tileExtentBuffer);
    } else {
        program = painter.useProgram('fill', painter.basicFillProgramConfiguration);
        gl.uniform4fv(program.u_color, color);
        painter.tileExtentVAO.bind(gl, program, painter.tileExtentBuffer);
    }

    gl.uniform1f(program.u_opacity, opacity);

    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const coords = transform.coveringTiles({tileSize});

    for (const coord of coords) {
        if (image) {
            pattern.setTile({coord, tileSize}, painter, program);
        }
        gl.uniformMatrix4fv(program.u_matrix, false, painter.transform.calculatePosMatrix(coord));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.tileExtentBuffer.length);
    }
}
