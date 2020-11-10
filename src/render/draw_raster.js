// @flow

import ImageSource from '../source/image_source';
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {rasterUniformValues} from './program/raster_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type RasterStyleLayer from '../style/style_layer/raster_style_layer';
import type {OverscaledTileID} from '../source/tile_id';
import rasterFade from './raster_fade';

export default drawRaster;

function drawRaster(painter: Painter, sourceCache: SourceCache, layer: RasterStyleLayer, tileIDs: Array<OverscaledTileID>, variableOffsets: any, isInitialLoad: boolean) {
    if (painter.renderPass !== 'translucent') return;
    if (layer.paint.get('raster-opacity') === 0) return;
    if (!tileIDs.length) return;

    const context = painter.context;
    const gl = context.gl;
    const source = sourceCache.getSource();
    const program = painter.useProgram('raster');

    const colorMode = painter.colorModeForRenderPass();

    // When rendering to texture, coordinates are already sorted: primary by
    // proxy id and secondary sort is by Z.
    const renderingToTexture = painter.terrain && painter.terrain.renderingToTexture;

    const [stencilModes, coords] = source instanceof ImageSource || renderingToTexture ? [{}, tileIDs] :
        painter.stencilConfigForOverlap(tileIDs);

    const minTileZ = coords[coords.length - 1].overscaledZ;

    const align = !painter.options.moving;
    for (const coord of coords) {
        // Set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
        // Use gl.LESS to prevent double drawing in areas where tiles overlap.
        const depthMode = renderingToTexture ? DepthMode.disabled : painter.depthModeForSublayer(coord.overscaledZ - minTileZ,
            layer.paint.get('raster-opacity') === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);

        const tile = sourceCache.getTile(coord);
        if (renderingToTexture && !(tile && tile.hasData())) continue;

        const posMatrix = (renderingToTexture) ? coord.posMatrix :
            painter.transform.calculatePosMatrix(coord.toUnwrapped(), align);

        const stencilMode = painter.terrain && renderingToTexture ?
            painter.terrain.stencilModeForRTTOverlap(coord) :
            stencilModes[coord.overscaledZ];

        const rasterFadeDuration = isInitialLoad ? 0 : layer.paint.get('raster-fade-duration');
        tile.registerFadeDuration(rasterFadeDuration);

        const parentTile = sourceCache.findLoadedParent(coord, 0);
        const fade = rasterFade(tile, parentTile, sourceCache, painter.transform, rasterFadeDuration);
        if (painter.terrain) painter.terrain.prepareDrawTile(coord);

        let parentScaleBy, parentTL;

        const textureFilter = layer.paint.get('raster-resampling') === 'nearest' ?  gl.NEAREST : gl.LINEAR;

        context.activeTexture.set(gl.TEXTURE0);
        tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

        context.activeTexture.set(gl.TEXTURE1);

        if (parentTile) {
            parentTile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
            parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
            parentTL = [tile.tileID.canonical.x * parentScaleBy % 1, tile.tileID.canonical.y * parentScaleBy % 1];

        } else {
            tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
        }

        const uniformValues = rasterUniformValues(posMatrix, parentTL || [0, 0], parentScaleBy || 1, fade, layer);

        if (source instanceof ImageSource) {
            program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled,
                uniformValues, layer.id, source.boundsBuffer,
                painter.quadTriangleIndexBuffer, source.boundsSegments);
        } else {
            program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                uniformValues, layer.id, painter.rasterBoundsBuffer,
                painter.quadTriangleIndexBuffer, painter.rasterBoundsSegments);
        }
    }
}

