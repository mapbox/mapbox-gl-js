// @flow

import ImageSource from '../source/image_source.js';
import StencilMode from '../gl/stencil_mode.js';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import Texture from './texture.js';
import {rasterPoleUniformValues, rasterUniformValues} from './program/raster_program.js';

import type Context from '../gl/context.js';
import type Painter from './painter.js';
import type SourceCache from '../source/source_cache.js';
import type RasterStyleLayer from '../style/style_layer/raster_style_layer.js';
import {OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import rasterFade from './raster_fade.js';
import {
    calculateGlobeMercatorMatrix,
    globeNormalizeECEF,
    globePoleMatrixForTile,
    globeTileBounds,
    globeToMercatorTransition,
    getGridMatrix} from "../geo/projection/globe_util.js";
import {mat4} from "gl-matrix";
import LngLatBounds from '../geo/lng_lat_bounds.js';
import {mercatorXfromLng, mercatorYfromLat} from "../geo/mercator_coordinate.js";
import Transform from '../geo/transform.js';

export default drawRaster;

const RASTER_COLOR_TEXTURE_UNIT = 2;

function drawRaster(painter: Painter, sourceCache: SourceCache, layer: RasterStyleLayer, tileIDs: Array<OverscaledTileID>, variableOffsets: any, isInitialLoad: boolean) {
    if (painter.renderPass !== 'translucent') return;
    if (layer.paint.get('raster-opacity') === 0) return;

    const context = painter.context;
    const gl = context.gl;
    const source = sourceCache.getSource();

    const rasterConfig = configureRaster(layer, context, gl);
    const defines = rasterConfig.defines;
    const isGlobeProjection = painter.transform.projection.name === 'globe';

    let drawAsGlobePole = false;
    if (source instanceof ImageSource && !tileIDs.length) {
        if (!isGlobeProjection) {
            return;
        }
        if (source.onNorthPole) {
            drawAsGlobePole = true;
            defines.push("GLOBE_POLES");
        } else if (source.onSouthPole) {
            drawAsGlobePole = true;
            defines.push("GLOBE_POLES");
        } else {
            // Image source without tile ID can only be rendered on the poles
            return;
        }
    }

    const emissiveStrength = layer.paint.get('raster-emissive-strength');
    const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);

    // When rendering to texture, coordinates are already sorted: primary by
    // proxy id and secondary sort is by Z.
    const renderingToTexture = painter.terrain && painter.terrain.renderingToTexture;
    const renderingWithElevation = source instanceof ImageSource && layer.paint.get('raster-elevation') !== 0.0;

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
        const projMatrix = Float32Array.from(painter.transform.expandedFarZProjMatrix);
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
        const uniformValues = rasterPoleUniformValues(projMatrix, normalizeMatrix, globeMatrix, fade, layer, perspectiveTransform || [0, 0], layer.paint.get('raster-elevation'), RASTER_COLOR_TEXTURE_UNIT, rasterConfig.mix, rasterConfig.offset, rasterConfig.range, emissiveStrength);
        const program = painter.getOrCreateProgram('raster', {defines: rasterConfig.defines});

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
    const renderingElevatedOnGlobe = renderingWithElevation && isGlobeProjection;

    if (renderingElevatedOnGlobe) {
        rasterConfig.defines.push("PROJECTION_GLOBE_VIEW");
    }
    if (renderingWithElevation) {
        rasterConfig.defines.push("RENDER_CUTOFF");
    }

    for (const coord of coords) {
        const unwrappedTileID = coord.toUnwrapped();
        const tile = sourceCache.getTile(coord);
        if (renderingToTexture && !(tile && tile.hasData())) continue;
        if (!tile.texture) continue;

        let depthMode;
        let projMatrix;
        if (renderingToTexture) {
            depthMode = DepthMode.disabled;
            projMatrix = coord.projMatrix;
        } else if (renderingWithElevation) {
            depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
            projMatrix = isGlobeProjection ? Float32Array.from(painter.transform.expandedFarZProjMatrix) : painter.transform.calculateProjMatrix(unwrappedTileID, align);
        } else {
            // Set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
            // Use gl.LESS to prevent double drawing in areas where tiles overlap.
            depthMode = painter.depthModeForSublayer(coord.overscaledZ - minTileZ,
                layer.paint.get('raster-opacity') === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);
            projMatrix = painter.transform.calculateProjMatrix(unwrappedTileID, align);
        }

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
        if (tile.texture) {
            tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE);
        }

        context.activeTexture.set(gl.TEXTURE1);

        if (parentTile) {
            if (parentTile.texture) {
                parentTile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE);
            }
            parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
            parentTL = [tile.tileID.canonical.x * parentScaleBy % 1, tile.tileID.canonical.y * parentScaleBy % 1];

        } else if (tile.texture) {
            tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE);
        }

        // Enable trilinear filtering on tiles only beyond 20 degrees pitch,
        // to prevent it from compromising image crispness on flat or low tilted maps.
        if (tile.texture && tile.texture.useMipmap && context.extTextureFilterAnisotropic && painter.transform.pitch > 20) {
            gl.texParameterf(gl.TEXTURE_2D, context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT, context.extTextureFilterAnisotropicMax);
        }

        const tr = painter.transform;
        const perspectiveTransform = source instanceof ImageSource ? source.perspectiveTransform : [0, 0];
        const cutoffParams = renderingWithElevation ? cutoffParamsForElevation(tr) : [0, 0, 0, 0];
        let normalizeMatrix: Float32Array;
        let globeMatrix: Float32Array;
        let globeMercatorMatrix: Float32Array;
        let mercatorCenter: [number, number];
        let gridMatrix: Float32Array;
        let globeTlBr: [number, number, number, number];

        if (renderingElevatedOnGlobe && source instanceof ImageSource && source.coordinates.length > 3) {
            normalizeMatrix = Float32Array.from(globeNormalizeECEF(globeTileBounds(new CanonicalTileID(0, 0, 0))));
            globeMatrix = Float32Array.from(tr.globeMatrix);
            globeMercatorMatrix = Float32Array.from(calculateGlobeMercatorMatrix(tr));
            mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];
            globeTlBr = [
                mercatorXfromLng(source.coordinates[1][0]), mercatorYfromLat(source.coordinates[1][1]),
                mercatorXfromLng(source.coordinates[3][0]), mercatorYfromLat(source.coordinates[3][1])
            ];
            const tileBounds = new LngLatBounds(source.coordinates[1], source.coordinates[3]);
            gridMatrix = Float32Array.from(getGridMatrix(new CanonicalTileID(0, 0, 0), tileBounds, 0, tr.worldSize / painter.transform._pixelsPerMercatorPixel));
        } else {
            normalizeMatrix = new Float32Array(16);
            globeMatrix = new Float32Array(9);
            globeMercatorMatrix = new Float32Array(16);
            mercatorCenter = [0, 0];
            gridMatrix = new Float32Array(16);
            globeTlBr = [0, 0, 0, 0];
        }

        const uniformValues = rasterUniformValues(
            projMatrix,
            normalizeMatrix,
            globeMatrix,
            globeMercatorMatrix,
            gridMatrix,
            parentTL || [0, 0],
            globeTlBr,
            globeToMercatorTransition(painter.transform.zoom),
            mercatorCenter,
            cutoffParams,
            parentScaleBy || 1,
            fade,
            layer,
            perspectiveTransform,
            renderingWithElevation ? layer.paint.get('raster-elevation') : 0.0,
            RASTER_COLOR_TEXTURE_UNIT,
            rasterConfig.mix,
            rasterConfig.offset,
            rasterConfig.range,
            1,
            0,
            emissiveStrength
        );
        const affectedByFog = painter.isTileAffectedByFog(coord);

        const program = painter.getOrCreateProgram('raster', {defines: rasterConfig.defines, overrideFog: affectedByFog});

        painter.uploadCommonUniforms(context, program, unwrappedTileID);

        if (source instanceof ImageSource) {
            if (renderingToTexture || !isGlobeProjection) {
                if (source.boundsBuffer && source.boundsSegments) program.draw(
                    painter, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled,
                    uniformValues, layer.id, source.boundsBuffer,
                    painter.quadTriangleIndexBuffer, source.boundsSegments);
            } else if (painter.globeSharedBuffers) {
                const [buffer, indexBuffer, segments] = painter.globeSharedBuffers.getGridBuffers(0, false);
                // Render both the front and back faces of the elevated raster layer
                // On globe, we need two separate draws to avoid z-fighting with itself when the geometry is curved
                program.draw(
                    painter, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.frontCCW,
                    uniformValues, layer.id, buffer,
                    indexBuffer, segments);
                program.draw(
                    painter, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.backCCW,
                    uniformValues, layer.id, buffer,
                    indexBuffer, segments);
            }
        } else {
            const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = painter.getTileBoundsBuffers(tile);

            program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                uniformValues, layer.id, tileBoundsBuffer,
                tileBoundsIndexBuffer, tileBoundsSegments);
        }
    }

    painter.resetStencilClippingMasks();
}

// Configure a fade out effect for elevated raster layers when they're close to the camera
function cutoffParamsForElevation(tr: Transform): [number, number, number, number] {
    const near = tr._nearZ;
    const far = tr.projection.farthestPixelDistance(tr);
    const zRange = far - near;
    const fadeRangePixels = tr.height * 0.2;
    const cutoffDistance = near + fadeRangePixels;
    const relativeCutoffDistance = ((cutoffDistance - near) / zRange);
    const relativeCutoffFadeDistance = ((cutoffDistance - fadeRangePixels - near) / zRange);
    return [near, far, relativeCutoffFadeDistance, relativeCutoffDistance];
}

function configureRaster(layer: RasterStyleLayer, context: Context, gl: WebGL2RenderingContext) {
    const isRasterColor = layer.paint.get('raster-color');

    const defines = [];
    const inputResampling = layer.paint.get('raster-resampling');
    const inputMix = layer.paint.get('raster-color-mix');
    const range = layer.paint.get('raster-color-range');

    // Unpack the offset for use in a separate uniform
    const mix = [inputMix[0], inputMix[1], inputMix[2], 0];
    const offset = inputMix[3];

    const resampling = inputResampling === 'nearest' ? gl.NEAREST : gl.LINEAR;

    if (isRasterColor) defines.push('RASTER_COLOR');

    if (isRasterColor) {
        // Allocate a texture if not allocated
        context.activeTexture.set(gl.TEXTURE2);
        let tex = layer.colorRampTexture;
        if (!tex) tex = layer.colorRampTexture = new Texture(context, layer.colorRamp, gl.RGBA);
        tex.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }
    return {mix, range, offset, defines, resampling};
}
