// @flow

const pattern = require('./pattern');
const StencilMode = require('../gl/stencil_mode');
const DepthMode = require('../gl/depth_mode');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type WebGLLayer from '../style/style_layer/webgl_layer';

module.exports = drawCustomWebGL;

function drawCustomWebGL(painter: Painter, sourceCache: SourceCache, layer: WebGLLayer) {
    if (painter.renderPass !== 'translucent') return;

    /*
        invalidateCurrentWebGLState allows external custom WebGL renderers to asynchronously use the WebGL context in a safe way.
        External renderers can/should call invalidateCurrentWebGLState when/if they modify the WebGL context state asynchronously.

        For example, if the external renderer receives some data from an AJAX request,
        it can upload data to the WebGL context asynchronously (regarding Mapbox GL rendering,
        it would synchronous respect WebGL) and call invalidateCurrentWebGLState afterwards
         to ensure that in the next Mapbox GL rendering pass the WebGL tracked is not stale (which would produce rendering artifacts).
    */
    const invalidateCurrentWebGLState = () => {
        const names = Object.keys(painter.context).filter(name => painter.context[name].current !== undefined);
        names.map((name, index) => painter.context[name].current = {});
    };
    const callback = window[layer.layout._values.callback];
    if (callback) {
        callback(painter.context.gl, invalidateCurrentWebGLState);
        invalidateCurrentWebGLState();
    }
}
