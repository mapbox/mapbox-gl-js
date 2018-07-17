// @flow

export default drawCustom;

import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import {drawToOffscreenFramebuffer, drawOffscreenTexture} from './offscreen';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type CustomStyleLayer from '../style/style_layer/custom_style_layer';

function drawCustom(painter: Painter, sourceCache: SourceCache, layer: CustomStyleLayer) {

    const context = painter.context;

    if (painter.renderPass === 'translucent') {
        if (layer.implementation.render) {
            context.setStencilMode(StencilMode.disabled);
            context.setDepthMode(DepthMode.disabled);
            context.unbindVAO();

            layer.implementation.render(context.gl, painter.transform.customLayerMatrix());

            context.setDirty();
            painter.setBaseState();
        }

        if (layer.implementation.render3D) {
            drawOffscreenTexture(painter, layer, 1);
        }

    } else if (painter.renderPass === 'offscreen' && layer.implementation.render3D) {

        drawToOffscreenFramebuffer(painter, layer);
        const context = painter.context;

        context.unbindVAO();

        layer.implementation.render3D(context.gl, painter.transform.customLayerMatrix());

        context.setDirty();
        painter.setBaseState();
    }
}
