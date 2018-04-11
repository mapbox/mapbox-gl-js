// @flow

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type CustomWebGLLayer from '../style/style_layer/custom_webgl_layer';

export default drawCustomWebGL;

function drawCustomWebGL(painter: Painter, sourceCache: SourceCache, layer: CustomWebGLLayer) {
    if (painter.renderPass !== 'translucent') return;

    /*
        invalidateCurrentWebGLState allows external custom WebGL renderers to asynchronously use the WebGL context in a safe way.
        External renderers can/should call invalidateCurrentWebGLState when/if they modify the WebGL context state asynchronously.

        For example, if the external renderer receives some data from an AJAX request,
        it can upload data to the WebGL context asynchronously (regarding Mapbox GL rendering,
        it would synchronous respect WebGL) and call invalidateCurrentWebGLState afterwards
        to ensure that in the next Mapbox GL rendering pass the WebGL tracked is not stale (which would produce rendering artifacts).
    */
    function invalidateCurrentWebGLState() {
        const context :Object = painter.context;
        Object.keys(context).forEach((key) => {
            if (context[key].current !== undefined) {
                context[key].current = {};
            }
        });
    }

    const drawCallbacks = painter.customWebGLDrawCallbacks;
    if (drawCallbacks.hasOwnProperty(layer.id)) {
        const callback = drawCallbacks[layer.id];
        if (callback) {
            callback(painter.context.gl, invalidateCurrentWebGLState);
            invalidateCurrentWebGLState();
        }
    }
}
