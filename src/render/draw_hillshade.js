// @flow

import Texture from './texture';
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
} from './program/hillshade_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type Tile from '../source/tile';
import type HillshadeStyleLayer from '../style/style_layer/hillshade_style_layer';
import type {OverscaledTileID} from '../source/tile_id';
import assert from 'assert';
import DEMData from '../data/dem_data';

export default drawHillshade;

function drawHillshade(painter: Painter, sourceCache: SourceCache, layer: HillshadeStyleLayer, tileIDs: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'offscreen' && painter.renderPass !== 'translucent') return;

    const context = painter.context;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    // When rendering to texture, coordinates are already sorted: primary by
    // proxy id and secondary sort is by Z.
    const renderingToTexture = painter.terrain && painter.terrain.renderingToTexture;
    const [stencilModes, coords] = painter.renderPass === 'translucent' && !renderingToTexture ?
        painter.stencilConfigForOverlap(tileIDs) : [{}, tileIDs];

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (tile.needsHillshadePrepare && painter.renderPass === 'offscreen') {
            prepareHillshade(painter, tile, layer, depthMode, StencilMode.disabled, colorMode);
        } else if (painter.renderPass === 'translucent') {
            const stencilMode = renderingToTexture && painter.terrain ?
                painter.terrain.stencilModeForRTTOverlap(coord) : stencilModes[coord.overscaledZ];
            renderHillshade(painter, coord, tile, layer, depthMode, stencilMode, colorMode);
        }
    }

    context.viewport.set([0, 0, painter.width, painter.height]);
}

function renderHillshade(painter, coord, tile, layer, depthMode, stencilMode, colorMode) {
    const context = painter.context;
    const gl = context.gl;
    const fbo = tile.fbo;
    if (!fbo) return;
    painter.prepareDrawTile(coord);

    const program = painter.useProgram('hillshade');

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    const uniformValues = hillshadeUniformValues(painter, tile, layer, painter.terrain ? coord.posMatrix : null);

    program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
        uniformValues, layer.id, painter.rasterBoundsBuffer,
        painter.quadTriangleIndexBuffer, painter.rasterBoundsSegments);
}

export function prepareDEMTexture(painter: Painter, tile: Tile, dem: DEMData) {
    if (!tile.needsDEMTextureUpload) return;

    const context = painter.context;
    const gl = context.gl;

    context.pixelStoreUnpackPremultiplyAlpha.set(false);
    const textureStride = dem.stride;
    tile.demTexture = tile.demTexture || painter.getTileTexture(textureStride);
    const pixelData = dem.getPixels();
    if (tile.demTexture) {
        tile.demTexture.update(pixelData, {premultiply: false});
    } else {
        tile.demTexture = new Texture(context, pixelData, gl.RGBA, {premultiply: false});
    }
    tile.needsDEMTextureUpload = false;
}

// hillshade rendering is done in two steps. the prepare step first calculates the slope of the terrain in the x and y
// directions for each pixel, and saves those values to a framebuffer texture in the r and g channels.
function prepareHillshade(painter, tile, layer, depthMode, stencilMode, colorMode) {
    const context = painter.context;
    const gl = context.gl;
    if (!tile.dem) return;
    const dem: DEMData = tile.dem;

    context.activeTexture.set(gl.TEXTURE1);
    prepareDEMTexture(painter, tile, dem);
    assert(tile.demTexture);
    if (!tile.demTexture) return; // Silence flow.
    tile.demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
    const tileSize = dem.dim;

    context.activeTexture.set(gl.TEXTURE0);
    let fbo = tile.fbo;
    if (!fbo) {
        const renderTexture = new Texture(context, {width: tileSize, height: tileSize, data: null}, gl.RGBA);
        renderTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

        fbo = tile.fbo = context.createFramebuffer(tileSize, tileSize, true);
        fbo.colorAttachment.set(renderTexture.texture);
    }

    context.bindFramebuffer.set(fbo.framebuffer);
    context.viewport.set([0, 0, tileSize, tileSize]);

    painter.useProgram('hillshadePrepare').draw(context, gl.TRIANGLES,
        depthMode, stencilMode, colorMode, CullFaceMode.disabled,
        hillshadeUniformPrepareValues(tile.tileID, dem),
        layer.id, painter.rasterBoundsBuffer,
        painter.quadTriangleIndexBuffer, painter.rasterBoundsSegments);

    tile.needsHillshadePrepare = false;
}
