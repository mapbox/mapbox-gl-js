// @flow

import browser from '../util/browser.js';
import Color from '../style-spec/util/color.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import DepthMode from '../gl/depth_mode.js';
import StencilMode from '../gl/stencil_mode.js';
import {rasterParticleUniformValues, rasterParticleTextureUniformValues, rasterParticleDrawUniformValues, rasterParticleUpdateUniformValues} from './program/raster_particle_program.js';
import {computeRasterColorMix, computeRasterColorOffset} from './raster.js';
import {COLOR_RAMP_RES} from '../style/style_layer/raster_particle_style_layer.js';
import RasterArrayTile from '../source/raster_array_tile.js';
import RasterArrayTileSource from '../source/raster_array_tile_source.js';

import type {DynamicDefinesType} from "./program/program_uniforms";
import type Painter from './painter.js';
import type SourceCache from '../source/source_cache.js';
import type RasterParticleStyleLayer from '../style/style_layer/raster_particle_style_layer.js';
import {OverscaledTileID, neighborCoord} from '../source/tile_id.js';
import {
    calculateGlobeMercatorMatrix,
    getGridMatrix,
    globeNormalizeECEF,
    globeTileBounds,
    globeToMercatorTransition,
    getLatitudinalLod,
    tileCornersToBounds} from "../geo/projection/globe_util.js";
import RasterParticleState from './raster_particle_state.js';
import Texture from './texture.js';
import {mercatorXfromLng, mercatorYfromLat} from "../geo/mercator_coordinate.js";
import Transform from '../geo/transform.js';
import rasterFade from './raster_fade.js';
import assert from 'assert';

export default drawRasterParticle;

const RASTER_COLOR_TEXTURE_UNIT = 2;
const SPEED_MAX_VALUE = 0.3;

function drawRasterParticle(painter: Painter, sourceCache: SourceCache, layer: RasterParticleStyleLayer, tileIDs: Array<OverscaledTileID>, _: any, isInitialLoad: boolean) {
    if (painter.renderPass === 'offscreen') {
        renderParticlesToTexture(painter, sourceCache, layer, tileIDs);
    }

    if (painter.renderPass === 'translucent') {
        renderTextureToMap(painter, sourceCache, layer, tileIDs, isInitialLoad);
        painter.style.map.triggerRepaint();
    }
}

function renderParticlesToTexture(painter: Painter, sourceCache: SourceCache, layer: RasterParticleStyleLayer, tileIDs: Array<OverscaledTileID>) {
    if (!tileIDs.length) {
        return;
    }

    const context = painter.context;
    const gl = context.gl;
    const source = sourceCache.getSource();
    if (!(source instanceof RasterArrayTileSource)) return;

    // acquire and update tiles

    const tiles: Array<[OverscaledTileID, TileData, RasterParticleState, boolean]> = [];
    for (const id of tileIDs) {
        const tile = sourceCache.getTile(id);
        if (!(tile instanceof RasterArrayTile)) continue;

        const data = getTileData(tile, source, layer);
        if (!data) continue;
        assert(data.texture);

        const textureSize = [data.tileSize, data.tileSize];
        let framebuffer = layer.tileFramebuffer;
        if (!framebuffer) {
            const fbWidth = textureSize[0];
            const fbHeight = textureSize[1];
            framebuffer = layer.tileFramebuffer = context.createFramebuffer(fbWidth, fbHeight, true, null);
        }
        assert(framebuffer.width === textureSize[0] && framebuffer.height === textureSize[1]);

        let state = tile.rasterParticleState;
        const layerParticleCount = layer.paint.get('raster-particle-count');
        if (!state) {
            state = tile.rasterParticleState = new RasterParticleState(context, id, textureSize, layerParticleCount);
        }

        const renderBackground = state.update(layer.lastInvalidatedAt);

        if (state.numParticles !== layerParticleCount) {
            state.setNumParticles(id, layerParticleCount);
        }

        const t = state.targetColorTexture;
        state.targetColorTexture = state.backgroundColorTexture;
        state.backgroundColorTexture = t;

        const p = state.particleVertices0;
        state.particleVertices0 = state.particleVertices1;
        state.particleVertices1 = p;

        tiles.push([id, data, state, renderBackground]);
    }

    if (tiles.length === 0) {
        return;
    }

    const now = browser.now();
    const frameDeltaSeconds = layer.previousDrawTimestamp ? 0.001 * (now - layer.previousDrawTimestamp) : 0.0167;
    layer.previousDrawTimestamp = now;

    if (layer.hasColorMap()) {
        // Allocate a texture if not allocated
        context.activeTexture.set(gl.TEXTURE0 + RASTER_COLOR_TEXTURE_UNIT);
        let tex = layer.colorRampTexture;
        if (!tex) tex = layer.colorRampTexture = new Texture(context, layer.colorRamp, gl.RGBA);
        tex.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }

    // render and update the particle state

    const framebuffer = layer.tileFramebuffer;
    context.bindFramebuffer.set(framebuffer.framebuffer);
    context.activeTexture.set(gl.TEXTURE0);

    renderBackground(painter, layer, tiles);
    renderParticles(painter, sourceCache, layer, tiles);
    updateParticles(painter, layer, tiles, frameDeltaSeconds);
}

type TileData = {|
    texture: Texture,
    textureOffset: [number, number],
    tileSize: number,
    scalarData: boolean,
    scale: [number, number, number, number],
    offset: number,
    defines: DynamicDefinesType[]
|};

function getTileData(tile: RasterArrayTile, source: RasterArrayTileSource, layer: RasterParticleStyleLayer): ?TileData {
    if (!tile) {
        return null;
    }

    const textureDesc = source.getTextureDescriptor(tile, layer, true);

    if (!textureDesc) {
        return null;
    }
    let {texture, mix, offset, tileSize, buffer, format} = textureDesc;
    if (!texture || !format) {
        return null;
    }

    let scalarData = false;
    if (format === 'uint32') {
        scalarData = true;
        mix[3] = 0;
        mix = computeRasterColorMix(COLOR_RAMP_RES, mix, [0, layer.paint.get('raster-particle-max-speed')]);
        offset = computeRasterColorOffset(COLOR_RAMP_RES, offset, [0, layer.paint.get('raster-particle-max-speed')]);
    }
    const dataFormatDefine = {
        uint8: 'DATA_FORMAT_UINT8',
        uint16: 'DATA_FORMAT_UINT16',
        uint32: 'DATA_FORMAT_UINT32',
    }[format];

    return {
        texture,
        textureOffset: [ buffer / (tileSize + 2 * buffer), tileSize / (tileSize + 2 * buffer)],
        tileSize,
        scalarData,
        scale: mix,
        offset,
        defines: ['RASTER_ARRAY', dataFormatDefine]
    };
}

function renderBackground(painter: Painter, layer: RasterParticleStyleLayer, tiles: Array<[OverscaledTileID, TileData, RasterParticleState, boolean]>) {
    const context = painter.context;
    const gl = context.gl;
    const framebuffer = layer.tileFramebuffer;

    context.activeTexture.set(gl.TEXTURE0);

    const textureUnit = 0;
    const opacityValue = fadeOpacityCurve(layer.paint.get('raster-particle-fade-opacity-factor'));
    const uniforms = rasterParticleTextureUniformValues(textureUnit, opacityValue);
    const program = painter.getOrCreateProgram('rasterParticleTexture', {defines: [], overrideFog: false});

    for (const tile of tiles) {
        const [, , particleState, renderBackground] = tile;
        framebuffer.colorAttachment.set(particleState.targetColorTexture.texture);
        context.viewport.set([0, 0, framebuffer.width, framebuffer.height]);
        context.clear({color: Color.transparent});
        if (!renderBackground) continue;
        particleState.backgroundColorTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        program.draw(
            painter,
            gl.TRIANGLES,
            DepthMode.disabled,
            StencilMode.disabled,
            ColorMode.alphaBlended,
            CullFaceMode.disabled,
            uniforms,
            layer.id,
            painter.viewportBuffer,
            painter.quadTriangleIndexBuffer,
            painter.viewportSegments);
    }
}

function fadeOpacityCurve(fadeOpacityFactor: number): number {
    // The opacity factor has a very non-linear visual effect in its linear [0, 1] range. Particle trails
    // are visible only roughly after a value of 0.7. Applying a curve which significantly boosts values
    // close to 0 ensures that linearly increasing the fade opacity factor from 0 to 1 results in a visually
    // linear increase in trail length.
    //
    // A curve of the form (1 + a)(x / (x + a)) boosts values close to 0, and results in a number in the
    // [0, 1] range.

    const x = fadeOpacityFactor;
    const a = 0.05;
    return (1.0 + a) * x / (x + a);
}

function resetRateCurve(resetRate: number): number {
    // Even small reset rates (close to zero) result in fast reset period. Values at >0.4 visually appear to
    // respawn very fast. Applying a power curve (x^n) to the reset rate ensures that we can linearly increase
    // the reset rate from 0 to 1 and see a more gradual increase in the reset rate.

    return Math.pow(resetRate, 6.0);
}

function renderParticles(painter: Painter, sourceCache: SourceCache, layer: RasterParticleStyleLayer, tiles: Array<[OverscaledTileID, TileData, RasterParticleState, boolean]>) {
    const context = painter.context;
    const gl = context.gl;

    const framebuffer = layer.tileFramebuffer;
    const isGlobeProjection = painter.transform.projection.name === 'globe';
    const maxSpeed = layer.paint.get('raster-particle-max-speed');
    for (const targetTile of tiles) {
        const [targetTileID, targetTileData, targetTileState, ] = targetTile;

        targetTileData.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        framebuffer.colorAttachment.set(targetTileState.targetColorTexture.texture);
        const defines = targetTileData.defines;
        const program = painter.getOrCreateProgram('rasterParticleDraw', {defines, overrideFog: false});

        const tileIDs = targetTileData.scalarData ? [] : [0, 1, 2, 3].map(idx => neighborCoord[idx](targetTileID));
        tileIDs.push(targetTileID);
        const x = targetTileID.canonical.x;
        const y = targetTileID.canonical.y;
        for (const tileID of tileIDs) {
            const tile = sourceCache.getTile(isGlobeProjection ? tileID.wrapped() : tileID);
            if (!tile) continue;
            const state = tile.rasterParticleState;
            if (!state) continue;
            // NOTE: tiles adjacent to the antimeridian need their x coordinates shifted by (2^z) in order for (nx - x)
            // to be contained in [-1, 1].
            const wrapDelta = tileID.wrap - targetTileID.wrap;
            const nx = tileID.canonical.x + (1 << tileID.canonical.z) * wrapDelta;
            const ny = tileID.canonical.y;

            const tileOffset = [nx - x, ny - y];
            const velocityTextureUnit = 0;
            const uniforms = rasterParticleDrawUniformValues(
                tileOffset,
                velocityTextureUnit,
                targetTileData.texture.size,
                RASTER_COLOR_TEXTURE_UNIT,
                maxSpeed,
                targetTileData.textureOffset,
                targetTileData.scale,
                targetTileData.offset
            );
            program.draw(
                painter,
                gl.POINTS,
                DepthMode.disabled,
                StencilMode.disabled,
                ColorMode.alphaBlended,
                CullFaceMode.disabled,
                uniforms,
                layer.id,
                state.particleVertices0,
                undefined,
                state.particleSegment
            );
        }
    }
}

function updateParticles(painter: Painter, layer: RasterParticleStyleLayer, tiles: Array<[OverscaledTileID, TileData, RasterParticleState, boolean]>, frameDeltaSeconds: number) {
    const context = painter.context;
    const gl = context.gl;

    let transformFeedbackObject = layer.transformFeedbackObject;
    if (!transformFeedbackObject) {
        // $FlowFixMe[prop-missing]
        transformFeedbackObject = layer.transformFeedbackObject = gl.createTransformFeedback();
    }
    // $FlowFixMe[prop-missing]
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, layer.transformFeedbackObject);

    const velocityTextureUnit = 0;
    const maxSpeed = layer.paint.get('raster-particle-max-speed');
    const speedFactor = frameDeltaSeconds * layer.paint.get('raster-particle-speed-factor') * SPEED_MAX_VALUE;
    const lifetimeDelta = resetRateCurve(layer.paint.get('raster-particle-reset-rate-factor'));
    for (const tile of tiles) {
        const [, data, state, ] = tile;

        data.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        const uniforms = rasterParticleUpdateUniformValues(
            velocityTextureUnit,
            data.texture.size,
            maxSpeed,
            speedFactor,
            lifetimeDelta,
            data.textureOffset,
            data.scale,
            data.offset
        );
        const updateProgram = painter.getOrCreateProgram('rasterParticleUpdate', {defines: data.defines, transformFeedback: {bufferMode: gl.SEPARATE_ATTRIBS, shaderVaryings: ['v_new_particle']}});
        updateProgram.draw(
            painter,
            gl.POINTS,
            DepthMode.disabled,
            StencilMode.disabled,
            ColorMode.disabled,
            CullFaceMode.disabled,
            uniforms,
            layer.id,
            state.particleVertices0,
            undefined,
            state.particleSegment,
            {},
            undefined,
            undefined,
            undefined,
            undefined,
            [{
                buffer: state.particleVertices1,
                targetIndex: 0
            }]
        );
    }

    // $FlowFixMe[prop-missing]
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
}

function renderTextureToMap(painter: Painter, sourceCache: SourceCache, layer: RasterParticleStyleLayer, tileIDs: Array<OverscaledTileID>, _: boolean) {
    const context = painter.context;
    const gl = context.gl;

    const rasterElevation = 250.0;
    const align = !painter.options.moving;
    const isGlobeProjection = painter.transform.projection.name === 'globe';

    if (!tileIDs.length) {
        return;
    }
    const [stencilModes, coords] = painter.stencilConfigForOverlap(tileIDs);

    const defines: DynamicDefinesType[] = [];
    if (isGlobeProjection) {
        defines.push("PROJECTION_GLOBE_VIEW");
    }

    for (const coord of coords) {
        const unwrappedTileID = coord.toUnwrapped();
        const tile = sourceCache.getTile(coord);
        if (!tile.rasterParticleState) continue;
        const particleState = tile.rasterParticleState;

        // NOTE: workaround for https://mapbox.atlassian.net/browse/GLJS-675
        const rasterFadeDuration = 100;
        tile.registerFadeDuration(rasterFadeDuration);

        const parentTile = sourceCache.findLoadedParent(coord, 0);
        const fade = rasterFade(tile, parentTile, sourceCache, painter.transform, rasterFadeDuration);
        if (painter.terrain) painter.terrain.prepareDrawTile();

        context.activeTexture.set(gl.TEXTURE0);
        particleState.targetColorTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

        context.activeTexture.set(gl.TEXTURE1);

        let parentScaleBy, parentTL;
        if (parentTile && parentTile.rasterParticleState) {
            parentTile.rasterParticleState.targetColorTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
            parentTL = [tile.tileID.canonical.x * parentScaleBy % 1, tile.tileID.canonical.y * parentScaleBy % 1];
        } else  {
            particleState.targetColorTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }

        const projMatrix = isGlobeProjection ? Float32Array.from(painter.transform.expandedFarZProjMatrix) : painter.transform.calculateProjMatrix(unwrappedTileID, align);

        const tr = painter.transform;
        const cutoffParams = cutoffParamsForElevation(tr);
        const tileBounds = tileCornersToBounds(coord.canonical);
        const latitudinalLod = getLatitudinalLod(tileBounds.getCenter().lat);

        let normalizeMatrix: Float32Array;
        let globeMatrix: Float32Array;
        let globeMercatorMatrix: Float32Array;
        let mercatorCenter: [number, number];
        let gridMatrix: Float32Array;

        if (isGlobeProjection) {
            normalizeMatrix = Float32Array.from(globeNormalizeECEF(globeTileBounds(coord.canonical)));
            globeMatrix = Float32Array.from(tr.globeMatrix);
            globeMercatorMatrix = Float32Array.from(calculateGlobeMercatorMatrix(tr));
            mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];
            gridMatrix = Float32Array.from(getGridMatrix(coord.canonical, tileBounds, latitudinalLod, tr.worldSize / tr._pixelsPerMercatorPixel));
        } else {
            normalizeMatrix = new Float32Array(16);
            globeMatrix = new Float32Array(9);
            globeMercatorMatrix = new Float32Array(16);
            mercatorCenter = [0, 0];
            gridMatrix = new Float32Array(9);
        }

        const uniformValues = rasterParticleUniformValues(
            projMatrix,
            normalizeMatrix,
            globeMatrix,
            globeMercatorMatrix,
            gridMatrix,
            parentTL || [0, 0],
            globeToMercatorTransition(painter.transform.zoom),
            mercatorCenter,
            cutoffParams,
            parentScaleBy || 1,
            fade,
            rasterElevation
        );
        const overrideFog = painter.isTileAffectedByFog(coord);
        const program = painter.getOrCreateProgram('rasterParticle', {defines, overrideFog});

        painter.uploadCommonUniforms(context, program, unwrappedTileID);

        if (isGlobeProjection) {
            const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
            const skirtHeightValue = 0;
            const sharedBuffers = painter.globeSharedBuffers;
            if (sharedBuffers) {
                const [buffer, indexBuffer, segments] = sharedBuffers.getGridBuffers(latitudinalLod, skirtHeightValue !== 0);
                assert(buffer);
                assert(indexBuffer);
                assert(segments);
                program.draw(painter, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.alphaBlended, CullFaceMode.backCCW, uniformValues, layer.id, buffer, indexBuffer, segments);
            }
        } else {
            const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
            const stencilMode = stencilModes[coord.overscaledZ];
            const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = painter.getTileBoundsBuffers(tile);

            program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, ColorMode.alphaBlended, CullFaceMode.disabled,
                uniformValues, layer.id, tileBoundsBuffer,
                tileBoundsIndexBuffer, tileBoundsSegments);
        }
    }

    painter.resetStencilClippingMasks();
}

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

export function prepare(layer: RasterParticleStyleLayer, sourceCache: SourceCache, _: Painter): void {
    const source = sourceCache.getSource();
    if (!(source instanceof RasterArrayTileSource) || !source.loaded()) return;

    const sourceLayer = layer.sourceLayer || (source.rasterLayerIds && source.rasterLayerIds[0]);
    if (!sourceLayer) return;

    const band = layer.paint.get('raster-particle-array-band') || source.getInitialBand(sourceLayer);
    if (band == null) return;

    // $FlowFixMe[incompatible-type]
    const tiles: Array<RasterArrayTile> = sourceCache.getIds().map(id => sourceCache.getTileByID(id));
    for (const tile of tiles) {
        if (tile.updateNeeded(sourceLayer, band)) {
            source.prepareTile(tile, sourceLayer, band);
        }
    }
}
