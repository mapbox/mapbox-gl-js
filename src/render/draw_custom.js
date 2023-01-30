// @flow

export default drawCustom;

import DepthMode from '../gl/depth_mode.js';
import StencilMode from '../gl/stencil_mode.js';
import {warnOnce} from '../util/util.js';
import {globeToMercatorTransition} from './../geo/projection/globe_util.js';

import type Painter from './painter.js';
import type {OverscaledTileID} from '../source/tile_id.js';
import type SourceCache from '../source/source_cache.js';
import type CustomStyleLayer from '../style/style_layer/custom_style_layer.js';
import MercatorCoordinate from '../geo/mercator_coordinate.js';
import assert from 'assert';

function drawCustom(painter: Painter, sourceCache: SourceCache, layer: CustomStyleLayer, coords: Array<OverscaledTileID>) {

    const context = painter.context;
    const implementation = layer.implementation;

    if (painter.transform.projection.unsupportedLayers && painter.transform.projection.unsupportedLayers.includes("custom") &&
        !(painter.terrain && (painter.terrain.renderingToTexture || painter.renderPass === 'offscreen') && layer.isLayerDraped())) {
        warnOnce('Custom layers are not yet supported with this projection. Use mercator or globe to enable usage of custom layers.');
        return;
    }

    if (painter.renderPass === 'offscreen') {

        const prerender = implementation.prerender;
        if (prerender) {
            painter.setCustomLayerDefaults();
            context.setColorMode(painter.colorModeForRenderPass());

            if (painter.transform.projection.name === "globe") {
                const center = painter.transform.pointMerc;
                prerender.call(implementation, context.gl, painter.transform.customLayerMatrix(), painter.transform.getProjection(), painter.transform.globeToMercatorMatrix(),  globeToMercatorTransition(painter.transform.zoom), [center.x, center.y], painter.transform.pixelsPerMeterRatio);
            } else {
                prerender.call(implementation, context.gl, painter.transform.customLayerMatrix());
            }

            context.setDirty();
            painter.setBaseState();
        }

    } else if (painter.renderPass === 'translucent') {

        if (painter.terrain && painter.terrain.renderingToTexture) {
            assert(implementation.renderToTile);
            assert(coords.length === 1);
            const renderToTile = implementation.renderToTile;
            if (renderToTile) {
                const c = coords[0].canonical;
                const unwrapped = new MercatorCoordinate(c.x + coords[0].wrap * (1 << c.z), c.y, c.z);

                context.setDepthMode(DepthMode.disabled);
                context.setStencilMode(StencilMode.disabled);
                context.setColorMode(painter.colorModeForRenderPass());
                painter.setCustomLayerDefaults();

                renderToTile.call(implementation, context.gl, unwrapped);
                context.setDirty();
                painter.setBaseState();
            }
            return;
        }

        painter.setCustomLayerDefaults();

        context.setColorMode(painter.colorModeForRenderPass());
        context.setStencilMode(StencilMode.disabled);

        const depthMode = implementation.renderingMode === '3d' ?
            new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D) :
            painter.depthModeForSublayer(0, DepthMode.ReadOnly);

        context.setDepthMode(depthMode);

        if (painter.transform.projection.name === "globe") {
            const center = painter.transform.pointMerc;
            implementation.render(context.gl, painter.transform.customLayerMatrix(), painter.transform.getProjection(), painter.transform.globeToMercatorMatrix(), globeToMercatorTransition(painter.transform.zoom), [center.x, center.y], painter.transform.pixelsPerMeterRatio);
        } else {
            implementation.render(context.gl, painter.transform.customLayerMatrix());
        }

        context.setDirty();
        painter.setBaseState();
        context.bindFramebuffer.set(null);
    }
}
