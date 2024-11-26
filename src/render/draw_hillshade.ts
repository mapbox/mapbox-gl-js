import Texture from './texture';
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    hillshadeUniformValues,
    hillshadeUniformPrepareValues
} from './program/hillshade_program';
import ColorMode from '../gl/color_mode';
import assert from 'assert';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type Tile from '../source/tile';
import type HillshadeStyleLayer from '../style/style_layer/hillshade_style_layer';
import type {OverscaledTileID} from '../source/tile_id';
import type DEMData from '../data/dem_data';
import type {DynamicDefinesType} from './program/program_uniforms';

export default drawHillshade;

function drawHillshade(painter: Painter, sourceCache: SourceCache, layer: HillshadeStyleLayer, tileIDs: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'offscreen' && painter.renderPass !== 'translucent') return;
    if (painter.style.disableElevatedTerrain) return;

    const context = painter.context;

    // When rendering to texture, coordinates are already sorted: primary by
    // proxy id and secondary sort is by Z.
    const renderingToTexture = painter.terrain && painter.terrain.renderingToTexture;
    const [stencilModes, coords] = painter.renderPass === 'translucent' && !renderingToTexture ?
        painter.stencilConfigForOverlap(tileIDs) : [{}, tileIDs];

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (tile.needsHillshadePrepare && painter.renderPass === 'offscreen') {
            prepareHillshade(painter, tile, layer);
        } else if (painter.renderPass === 'translucent') {
            const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
            const emissiveStrength = layer.paint.get('hillshade-emissive-strength');

            const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);
            const stencilMode = renderingToTexture && painter.terrain ?
                painter.terrain.stencilModeForRTTOverlap(coord) : stencilModes[coord.overscaledZ];
            renderHillshade(painter, coord, tile, layer, depthMode, stencilMode, colorMode);
        }
    }

    context.viewport.set([0, 0, painter.width, painter.height]);

    painter.resetStencilClippingMasks();
}

function renderHillshade(painter: Painter, coord: OverscaledTileID, tile: Tile, layer: HillshadeStyleLayer, depthMode: DepthMode, stencilMode: StencilMode, colorMode: ColorMode) {
    const context = painter.context;
    const gl = context.gl;
    const fbo = tile.hillshadeFBO;
    if (!fbo) return;
    painter.prepareDrawTile();

    const affectedByFog = painter.isTileAffectedByFog(coord);
    const program = painter.getOrCreateProgram('hillshade', {overrideFog: affectedByFog});

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());

    const uniformValues = hillshadeUniformValues(painter, tile, layer, painter.terrain ? coord.projMatrix : null);

    painter.uploadCommonUniforms(context, program, coord.toUnwrapped());

    const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = painter.getTileBoundsBuffers(tile);

    // @ts-expect-error - TS2554 - Expected 12-16 arguments, but got 11.
    program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
        uniformValues, layer.id, tileBoundsBuffer,
        tileBoundsIndexBuffer, tileBoundsSegments);
}

export function prepareDEMTexture(painter: Painter, tile: Tile, dem: DEMData) {
    if (!tile.needsDEMTextureUpload) return;

    const context = painter.context;
    const gl = context.gl;

    context.pixelStoreUnpackPremultiplyAlpha.set(false);
    const textureStride = dem.stride;
    tile.demTexture = tile.demTexture || painter.getTileTexture(textureStride);
    const demImage = dem.getPixels();

    // Dem encoding should match painters expectations about floating point DEM usage
    if (tile.demTexture) {
        tile.demTexture.update(demImage, {premultiply: false});
    } else {
        tile.demTexture = new Texture(context, demImage, gl.R32F, {premultiply: false});
    }
    tile.needsDEMTextureUpload = false;
}

// hillshade rendering is done in two steps. the prepare step first calculates the slope of the terrain in the x and y
// directions for each pixel, and saves those values to a framebuffer texture in the r and g channels.
function prepareHillshade(painter: Painter, tile: Tile, layer: HillshadeStyleLayer) {
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
    let fbo = tile.hillshadeFBO;
    if (!fbo) {
        const renderTexture = new Texture(context, {width: tileSize, height: tileSize, data: null}, gl.RGBA8);
        renderTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

        fbo = tile.hillshadeFBO = context.createFramebuffer(tileSize, tileSize, true, 'renderbuffer');
        fbo.colorAttachment.set(renderTexture.texture);
    }

    context.bindFramebuffer.set(fbo.framebuffer);
    context.viewport.set([0, 0, tileSize, tileSize]);

    const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = painter.getMercatorTileBoundsBuffers();

    const definesValues: DynamicDefinesType[] = [];
    if (painter.linearFloatFilteringSupported()) definesValues.push('TERRAIN_DEM_FLOAT_FORMAT');

    // @ts-expect-error - TS2554 - Expected 12-16 arguments, but got 11.
    painter.getOrCreateProgram('hillshadePrepare', {defines: definesValues}).draw(painter, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, ColorMode.unblended, CullFaceMode.disabled,
        hillshadeUniformPrepareValues(tile.tileID, dem),
        layer.id, tileBoundsBuffer,
        tileBoundsIndexBuffer, tileBoundsSegments);

    tile.needsHillshadePrepare = false;
}
