// @flow

const pattern = require('./pattern');
const {ProgramConfiguration} = require('../data/program_configuration');
const {PossiblyEvaluated, PossiblyEvaluatedPropertyValue} = require('../style/properties');
const fillLayerPaintProperties = require('../style/style_layer/fill_style_layer_properties').paint;

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type BackgroundStyleLayer from '../style/style_layer/background_style_layer';

module.exports = drawBackground;

function drawBackground(painter: Painter, sourceCache: SourceCache, layer: BackgroundStyleLayer) {
    const color = layer.paint.get('background-color');
    const opacity = layer.paint.get('background-opacity');

    if (opacity === 0) return;

    const gl = painter.gl;
    const transform = painter.transform;
    const tileSize = transform.tileSize;
    const image = layer.paint.get('background-pattern');
    const globals = {zoom: transform.zoom};

    const pass = (!image && color.a === 1 && opacity === 1) ? 'opaque' : 'translucent';
    if (painter.renderPass !== pass) return;

    gl.disable(gl.STENCIL_TEST);

    painter.setDepthSublayer(0);

    const properties = new PossiblyEvaluated(fillLayerPaintProperties);

    (properties._values: any)['background-color'] = new PossiblyEvaluatedPropertyValue(
        fillLayerPaintProperties.properties['fill-color'], {kind: 'constant', value: color}, globals);
    (properties._values: any)['background-opacity'] = new PossiblyEvaluatedPropertyValue(
        fillLayerPaintProperties.properties['fill-opacity'], {kind: 'constant', value: opacity}, globals);

    let program;
    if (image) {
        if (pattern.isPatternMissing(image, painter)) return;
        const configuration = ProgramConfiguration.forBackgroundPattern(opacity);
        program = painter.useProgram('fillPattern', configuration);
        configuration.setUniforms(gl, program, properties, globals);
        pattern.prepare(image, painter, program);
        painter.tileExtentPatternVAO.bind(gl, program, painter.tileExtentBuffer);
    } else {
        const configuration = ProgramConfiguration.forBackgroundColor(color, opacity);
        program = painter.useProgram('fill', configuration);
        configuration.setUniforms(gl, program, properties, globals);
        painter.tileExtentVAO.bind(gl, program, painter.tileExtentBuffer);
    }

    const coords = transform.coveringTiles({tileSize});

    for (const coord of coords) {
        if (image) {
            pattern.setTile({coord, tileSize}, painter, program);
        }
        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, painter.transform.calculatePosMatrix(coord));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.tileExtentBuffer.length);
    }
}
