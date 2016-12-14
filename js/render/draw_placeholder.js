'use strict';

const pattern = require('./pattern');

module.exports = function drawPlaceholder(painter, sourceCache, layer) {
    if (painter.isOpaquePass) return;

    const loadingCoords = sourceCache.getLoadingCoords(Date.now() - layer.paint['placeholder-fade-duration']);
    for (let i = 0; i < loadingCoords.length; i++) {
        const loadingCoord = loadingCoords[i];
        drawPlaceholderLoadingTile(painter, sourceCache, layer, loadingCoord);
    }
};

function drawPlaceholderLoadingTile(painter, sourceCache, layer, coord) {
    const gl = painter.gl;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const color = layer.paint['placeholder-loading-color'];
    const image = layer.paint['placeholder-loading-pattern'];

    const tile = sourceCache.getTile(coord);

    tile.setAnimationLoop(painter.style.animationLoop, layer.paint['placeholder-fade-duration']);

    let opacityT;
    if (tile.timeAdded) {
        opacityT = 1 - (Date.now() - sourceCache.getTile(coord).timeAdded) / layer.paint['placeholder-fade-duration'];
    } else {
        opacityT = 1;
    }
    const opacity = layer.paint['placeholder-loading-opacity'] * opacityT;

    gl.disable(gl.STENCIL_TEST);

    let program;
    if (image) {
        program = painter.useProgram('fillPattern', painter.basicFillProgramConfiguration);
        pattern.prepare(image, painter, program);
        painter.tileExtentPatternVAO.bind(gl, program, painter.tileExtentBuffer);
    } else {
        program = painter.useProgram('fill', painter.basicFillProgramConfiguration);
        gl.uniform4fv(program.u_color, color);
        painter.tileExtentVAO.bind(gl, program, painter.tileExtentBuffer);
    }

    gl.uniform1f(program.u_opacity, opacity);

    if (image) {
        pattern.setTile({coord, tileSize}, painter, program);
    }
    gl.uniformMatrix4fv(program.u_matrix, false, painter.transform.calculatePosMatrix(coord));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.tileExtentBuffer.length);
}
