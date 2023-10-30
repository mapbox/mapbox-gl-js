// @flow

import ImageSource from '../source/image_source.js';
import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import Texture from './texture.js';
import {rasterUniformValues} from './program/raster_program.js';

import type Context from '../gl/context.js';
import type Painter from './painter.js';
import type SourceCache from '../source/source_cache.js';
import type RasterStyleLayer from '../style/style_layer/raster_style_layer.js';
import {OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import rasterFade from './raster_fade.js';
import {
    globeNormalizeECEF,
    globePoleMatrixForTile,
    globeTileBounds,
} from "../geo/projection/globe_util.js";
import {mat4} from "gl-matrix";

export default drawRaster;

const RASTER_COLOR_TEXTURE_UNIT = 2;

function drawRaster(painter: Painter, sourceCache: SourceCache, layer: RasterStyleLayer, tileIDs: Array<OverscaledTileID>, variableOffsets: any, isInitialLoad: boolean) {
    if (painter.renderPass !== 'translucent') return;
    if (layer.paint.get('raster-opacity') === 0) return;

    const context = painter.context;
    const gl = context.gl;
    const source = sourceCache.getSource();

    const rasterColor = configureRasterColor(layer, context, gl);
    const defines = rasterColor.defines;
    let drawAsGlobePole = false;
    if (source instanceof ImageSource && !tileIDs.length) {
        if (painter.transform.projection.name !== 'globe') {
            return;
        }
        if (source.onNorthPole) {
            drawAsGlobePole = true;
            defines.push("PROJECTION_GLOBE_VIEW");
        } else if (source.onSouthPole) {
            drawAsGlobePole = true;
            defines.push("PROJECTION_GLOBE_VIEW");
        } else {
            // Image source without tile ID can only be rendered on the poles
            return;
        }
    }

    const colorMode = painter.colorModeForDrapableLayerRenderPass();

    // When rendering to texture, coordinates are already sorted: primary by
    // proxy id and secondary sort is by Z.
    const renderingToTexture = painter.terrain && painter.terrain.renderingToTexture;

    const align = !painter.options.moving;
    const textureFilter = layer.paint.get('raster-resampling') === 'nearest' ? gl.NEAREST : gl.LINEAR;

    if (drawAsGlobePole) {
        const source = sourceCache.getSource();
        if (!(source instanceof ImageSource)) return;
        const texture = source.texture;
        if (!texture) return;
        const sharedBuffers = painter.globeSharedBuffers;
        if (!sharedBuffers) return;

        const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
        const projMatrix = Float32Array.from(painter.transform.projMatrix);
        let globeMatrix = globePoleMatrixForTile(0, 0, painter.transform);
        const normalizeMatrix = Float32Array.from(globeNormalizeECEF(globeTileBounds(new CanonicalTileID(0, 0, 0))));
        const fade = {opacity: 1, mix: 0};

        if (painter.terrain) painter.terrain.prepareDrawTile();

        context.activeTexture.set(gl.TEXTURE0);
        texture.bind(textureFilter, gl.CLAMP_TO_EDGE);
        context.activeTexture.set(gl.TEXTURE1);
        texture.bind(textureFilter, gl.CLAMP_TO_EDGE);

        // Enable trilinear filtering on tiles only beyond 20 degrees pitch,
        // to prevent it from compromising image crispness on flat or low tilted maps.
        if (texture.useMipmap && context.extTextureFilterAnisotropic && painter.transform.pitch > 20) {
            gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, context.extTextureFilterAnisotropicMax);
        }

        const [
            northPoleBuffer,
            southPoleBuffer,
            indexBuffer,
            segment
        ] = sharedBuffers.getPoleBuffers(0, true);
        let vertexBuffer;
        if (source.onNorthPole) {
            vertexBuffer = northPoleBuffer;
            painter.renderDefaultNorthPole = false;
        } else {
            globeMatrix = mat4.scale(mat4.create(), globeMatrix, [1, -1, 1]);
            vertexBuffer = southPoleBuffer;
            painter.renderDefaultSouthPole = false;
        }
        const perspectiveTransform = source.perspectiveTransform;
        const uniformValues = rasterUniformValues(projMatrix, normalizeMatrix, globeMatrix, [0, 0], 1, fade, layer, perspectiveTransform || [0, 0], RASTER_COLOR_TEXTURE_UNIT, rasterColor.mix || [0, 0, 0, 0], rasterColor.range || [0, 0]);
        const program = painter.getOrCreateProgram('raster', {defines: rasterColor.defines});

        painter.uploadCommonUniforms(context, program, null);
        program.draw(
            painter, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled,
            uniformValues, layer.id, vertexBuffer,
            indexBuffer, segment);
        return;
    }

    if (!tileIDs.length) {
        return;
    }
    const [stencilModes, coords] = source instanceof ImageSource || renderingToTexture ? [{}, tileIDs] :
        painter.stencilConfigForOverlap(tileIDs);
    const minTileZ = coords[coords.length - 1].overscaledZ;

    for (const coord of coords) {
        // Set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
        // Use gl.LESS to prevent double drawing in areas where tiles overlap.
        const depthMode = renderingToTexture ? DepthMode.disabled : painter.depthModeForSublayer(coord.overscaledZ - minTileZ,
            layer.paint.get('raster-opacity') === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);

        const unwrappedTileID = coord.toUnwrapped();
        const tile = sourceCache.getTile(coord);
        if (renderingToTexture && !(tile && tile.hasData())) continue;
        if (!tile.texture) continue;

        const projMatrix = (renderingToTexture) ? coord.projMatrix :
            painter.transform.calculateProjMatrix(unwrappedTileID, align);

        const stencilMode = painter.terrain && renderingToTexture ?
            painter.terrain.stencilModeForRTTOverlap(coord) :
            stencilModes[coord.overscaledZ];

        const rasterFadeDuration = isInitialLoad ? 0 : layer.paint.get('raster-fade-duration');
        tile.registerFadeDuration(rasterFadeDuration);

        const parentTile = sourceCache.findLoadedParent(coord, 0);
        const fade = rasterFade(tile, parentTile, sourceCache, painter.transform, rasterFadeDuration);
        if (painter.terrain) painter.terrain.prepareDrawTile();

        let parentScaleBy, parentTL;

        context.activeTexture.set(gl.TEXTURE0);
        tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE);

        context.activeTexture.set(gl.TEXTURE1);

        if (parentTile) {
            parentTile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE);
            parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
            parentTL = [tile.tileID.canonical.x * parentScaleBy % 1, tile.tileID.canonical.y * parentScaleBy % 1];

        } else {
            tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE);
        }

        // Enable trilinear filtering on tiles only beyond 20 degrees pitch,
        // to prevent it from compromising image crispness on flat or low tilted maps.
        if (tile.texture.useMipmap && context.extTextureFilterAnisotropic && painter.transform.pitch > 20) {
            gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, context.extTextureFilterAnisotropicMax);
        }

        const perspectiveTransform = source instanceof ImageSource ? source.perspectiveTransform : [0, 0];
        const emptyMatrix = new Float32Array(16);
        const uniformValues = rasterUniformValues(projMatrix, emptyMatrix, emptyMatrix, parentTL || [0, 0], parentScaleBy || 1, fade, layer, perspectiveTransform, RASTER_COLOR_TEXTURE_UNIT, rasterColor.mix || [0, 0, 0, 0], rasterColor.range || [0, 0]);
        const affectedByFog = painter.isTileAffectedByFog(coord);

        const program = painter.getOrCreateProgram('raster', {defines: rasterColor.defines, overrideFog: affectedByFog});

        painter.uploadCommonUniforms(context, program, unwrappedTileID);

        if (source instanceof ImageSource) {
            if (source.boundsBuffer && source.boundsSegments) program.draw(
                painter, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled,
                uniformValues, layer.id, source.boundsBuffer,
                painter.quadTriangleIndexBuffer, source.boundsSegments);
        } else {
            const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = painter.getTileBoundsBuffers(tile);

            program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                uniformValues, layer.id, tileBoundsBuffer,
                tileBoundsIndexBuffer, tileBoundsSegments);
        }
    }

    painter.resetStencilClippingMasks();
}

function configureRasterColor (layer: RasterStyleLayer, context: Context, gl: WebGL2RenderingContext) {
    const defines = [];
    let mix;
    let range;

    if (layer.paint.get('raster-color')) {
        defines.push('RASTER_COLOR');
        mix = layer.paint.get('raster-color-mix');
        range = layer.paint.get('raster-color-range');

        // Allocate a texture if not allocated
        context.activeTexture.set(gl.TEXTURE2);
        let tex = layer.colorRampTexture;
        if (!tex) tex = layer.colorRampTexture = new Texture(context, layer.colorRamp, gl.RGBA);
        tex.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }
    return {mix, range, defines};
}
