export default drawCustom;

import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import {warnOnce} from '../util/util';
import {globeToMercatorTransition} from './../geo/projection/globe_util';
import assert from 'assert';

import type Painter from './painter';
import type {OverscaledTileID} from '../source/tile_id';
import type SourceCache from '../source/source_cache';
import type CustomStyleLayer from '../style/style_layer/custom_style_layer';

function drawCustom(painter: Painter, sourceCache: SourceCache, layer: CustomStyleLayer, coords: Array<OverscaledTileID>) {

    const context = painter.context;
    const implementation = layer.implementation;

    if (painter.transform.projection.unsupportedLayers && painter.transform.projection.unsupportedLayers.includes("custom") &&
        !(painter.terrain && (painter.terrain.renderingToTexture || painter.renderPass === 'offscreen') && layer.isDraped(sourceCache))) {
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
                const renderCoords = {
                    /*
                     * We intentionally baked wrap into x coordinate before and
                     * we need to keep backward-compatibility.
                     *
                     * https://github.com/mapbox/mapbox-gl-js/pull/12182/commits/8b9071f751b9ed9ae4389dce7fb2e30aae984f9d
                     */
                    x: c.x + coords[0].wrap * (implementation.wrapTileId ? 0 : (1 << c.z)),
                    y: c.y,
                    z: c.z
                };

                context.setDepthMode(DepthMode.disabled);
                context.setStencilMode(StencilMode.disabled);
                context.setColorMode(painter.colorModeForRenderPass());
                painter.setCustomLayerDefaults();

                renderToTile.call(implementation, context.gl, renderCoords);
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
            implementation.render(context.gl, painter.transform.customLayerMatrix() as number[], painter.transform.getProjection(), painter.transform.globeToMercatorMatrix(), globeToMercatorTransition(painter.transform.zoom), [center.x, center.y], painter.transform.pixelsPerMeterRatio);
        } else {
            implementation.render(context.gl, painter.transform.customLayerMatrix() as number[]);
        }

        context.setDirty();
        painter.setBaseState();
        context.bindFramebuffer.set(null);
    }
}
