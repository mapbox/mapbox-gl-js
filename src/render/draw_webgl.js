// @flow

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type WebGLLayer from '../style/style_layer/webgl_layer';

module.exports = drawWebGL;

function drawWebGL(painter: Painter, sourceCache: SourceCache, layer: WebGLLayer) {
    if (painter.renderPass !== 'translucent') return;
    const drawData = painter.webGLDrawData;
    if (drawData.hasOwnProperty(layer.id)) {
        const callback = drawData[layer.id];
        if (callback) {
            callback(painter.context.gl, painter.invalidate.bind(painter));
            painter.invalidate();
        }
    }
}
