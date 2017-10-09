// @flow

const pattern = require('./pattern');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type StyleLayer from '../style/style_layer';

module.exports = drawBackground;

function drawBackground(painter: Painter, sourceCache: SourceCache, layer: StyleLayer) {
    const gl = painter.gl;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const color = layer.paint['background-color'];
    const image = layer.paint['background-pattern'];
    const opacity = layer.paint['background-opacity'];

    const pass = (!image && color[3] === 1 && opacity === 1) ? 'opaque' : 'translucent';
    if (painter.renderPass !== pass) return;

    gl.disable(gl.STENCIL_TEST);

    painter.setDepthSublayer(0);

    let program;
    if (image) {
        if (pattern.isPatternMissing(image, painter)) return;
        program = painter.useProgram('fillPattern', painter.basicFillProgramConfiguration);
        pattern.prepare(image, painter, program);
        painter.tileExtentPatternVAO.bind(gl, program, painter.tileExtentBuffer);
    } else {
        program = painter.useProgram('fill', painter.basicFillProgramConfiguration);
        gl.uniform4fv(program.uniforms.u_color, color);
        painter.tileExtentVAO.bind(gl, program, painter.tileExtentBuffer);
    }

    gl.uniform1f(program.uniforms.u_opacity, opacity);

    const coords = transform.coveringTiles({tileSize});

    for (const coord of coords) {
        if (image) {
            pattern.setTile({coord, tileSize}, painter, program);
        }
        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, painter.transform.calculatePosMatrix(coord));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.tileExtentBuffer.length);
    }
}
