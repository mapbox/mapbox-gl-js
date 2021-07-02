// @flow

export default drawCustom;

import DepthMode from '../gl/depth_mode.js';
import StencilMode from '../gl/stencil_mode.js';

import type Painter from './painter.js';
import type SourceCache from '../source/source_cache.js';
import type CustomStyleLayer from '../style/style_layer/custom_style_layer.js';

function drawCustom(painter: Painter, sourceCache: SourceCache, layer: CustomStyleLayer) {

    const context = painter.context;
    const implementation = layer.implementation;

    if (painter.renderPass === 'offscreen') {

        const prerender = implementation.prerender;
        if (prerender) {
            painter.setCustomLayerDefaults();
            context.setColorMode(painter.colorModeForRenderPass());

            prerender.call(implementation, context.gl, painter.transform.customLayerMatrix());

            context.setDirty();
            painter.setBaseState();
        }

    } else if (painter.renderPass === 'translucent') {

        painter.setCustomLayerDefaults();

        context.setColorMode(painter.colorModeForRenderPass());
        context.setStencilMode(StencilMode.disabled);

        const depthMode = implementation.renderingMode === '3d' ?
            new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D) :
            painter.depthModeForSublayer(0, DepthMode.ReadOnly);

        context.setDepthMode(depthMode);

        implementation.render(context.gl, painter.transform.customLayerMatrix());

        context.setDirty();
        painter.setBaseState();
        context.bindFramebuffer.set(null);
    }
}
