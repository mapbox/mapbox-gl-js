// @flow

const pattern = require('./pattern');
const StencilMode = require('../gl/stencil_mode');
const DepthMode = require('../gl/depth_mode');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type WebGLLayer from '../style/style_layer/webgl_layer';

module.exports = drawWebGL;

function drawWebGL(painter: Painter, sourceCache: SourceCache, layer: WebGLLayer) {
    if (painter.renderPass !== 'translucent') return;

    const invalidateCurrentWebGLState = () => {
        const names = Object.keys(painter.context).filter(name => painter.context[name].current !== undefined);
        names.map((name, index) => painter.context[name].current = {});
    };
    const fn = window[layer.layout._values.callback];
    if (fn) {
        fn(painter.context.gl, invalidateCurrentWebGLState);
        invalidateCurrentWebGLState();
    }
}
