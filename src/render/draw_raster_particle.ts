import browser from '../util/browser';
import Color from '../style-spec/util/color';
import ColorMode from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import {rasterParticleUniformValues, rasterParticleTextureUniformValues, rasterParticleDrawUniformValues, rasterParticleUpdateUniformValues,
    RASTER_PARTICLE_POS_OFFSET,
    RASTER_PARTICLE_POS_SCALE,
} from './program/raster_particle_program';
import {computeRasterColorMix, computeRasterColorOffset} from './raster';
import {COLOR_RAMP_RES} from '../style/style_layer/raster_particle_style_layer';
import RasterArrayTile from '../source/raster_array_tile';
import RasterArrayTileSource from '../source/raster_array_tile_source';
import {neighborCoord} from '../source/tile_id';
import {
    calculateGlobeMercatorMatrix,
    getGridMatrix,
    globeNormalizeECEF,
    globeTileBounds,
    globeToMercatorTransition,
    getLatitudinalLod,
    tileCornersToBounds} from '../geo/projection/globe_util';
import RasterParticleState from './raster_particle_state';
import Texture from './texture';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate';
import rasterFade from './raster_fade';
import assert from 'assert';
import {RGBAImage} from '../util/image';
import {smoothstep} from '../util/util';
import {GLOBE_ZOOM_THRESHOLD_MAX} from '../geo/projection/globe_constants';

import type Transform from '../geo/transform';
import type {OverscaledTileID} from '../source/tile_id';
import type RasterParticleStyleLayer from '../style/style_layer/raster_particle_style_layer';
import type SourceCache from '../source/source_cache';
import type Painter from './painter';
import type {DynamicDefinesType} from './program/program_uniforms';

export default drawRasterParticle;

const VELOCITY_TEXTURE_UNIT = 0;
const RASTER_PARTICLE_TEXTURE_UNIT = 1;
const RASTER_COLOR_TEXTURE_UNIT = 2;
const SPEED_MAX_VALUE = 0.15;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawRasterParticle(painter: Painter, sourceCache: SourceCache, layer: RasterParticleStyleLayer, tileIDs: Array<OverscaledTileID>, _: any, isInitialLoad: boolean) {
    if (painter.renderPass === 'offscreen') {
        renderParticlesToTexture(painter, sourceCache, layer, tileIDs);
    }

    if (painter.renderPass === 'translucent') {
        renderTextureToMap(painter, sourceCache, layer, tileIDs, isInitialLoad);
        painter.style.map.triggerRepaint();
    }
}

function createPositionRGBAData(textureDimension: number): Uint8Array {
    const numParticles = textureDimension * textureDimension;
    const RGBAPositions = new Uint8Array(4 * numParticles);
    // Hash function from https://www.shadertoy.com/view/XlGcRh
    const esgtsa = function (s: number): number {
        s |= 0;
        s = Math.imul(s ^ 2747636419, 2654435769);
        s = Math.imul(s ^ (s >>> 16), 2654435769);
        s = Math.imul(s ^ (s >>> 16), 2654435769);
        return (s >>> 0) / 4294967296;
    };
    // Pack random positions in [0, 1] into RGBA pixels. Matches the GLSL
    // `pack_pos_to_rgba` behavior.
    const invScale = 1.0 / RASTER_PARTICLE_POS_SCALE;
    for (let i = 0; i < numParticles; i++) {
        const x = invScale * (esgtsa(2 * i + 0) + RASTER_PARTICLE_POS_OFFSET);
        const y = invScale * (esgtsa(2 * i + 1) + RASTER_PARTICLE_POS_OFFSET);

        const rx = x;
        const ry = (x * 255.0) % 1;
        const rz = y;
        const rw = (y * 255.0) % 1;

        const px = rx - ry / 255.0;
        const py = ry;
        const pz = rz - rw / 255.0;
        const pw = rw;

        RGBAPositions[4 * i + 0] = 255.0 * px;
        RGBAPositions[4 * i + 1] = 255.0 * py;
        RGBAPositions[4 * i + 2] = 255.0 * pz;
        RGBAPositions[4 * i + 3] = 255.0 * pw;
    }

    return RGBAPositions;
}

function renderParticlesToTexture(painter: Painter, sourceCache: SourceCache, layer: RasterParticleStyleLayer, tileIDs: Array<OverscaledTileID>) {
    if (!tileIDs.length) {
        return;
    }

    const context = painter.context;
    const gl = context.gl;
    const source = sourceCache.getSource();
    if (!(source instanceof RasterArrayTileSource)) return;

    // update layer resources

    const particleTextureDimension = Math.ceil(Math.sqrt(layer.paint.get('raster-particle-count')));

    let particlePositionRGBAImage = layer.particlePositionRGBAImage;
    if (!particlePositionRGBAImage || particlePositionRGBAImage.width !== particleTextureDimension) {
        const RGBAData = createPositionRGBAData(particleTextureDimension);
        const imageSize = {width: particleTextureDimension, height: particleTextureDimension};
        particlePositionRGBAImage = layer.particlePositionRGBAImage = new RGBAImage(imageSize, RGBAData);
    }

    let particleFramebuffer = layer.particleFramebuffer;
    if (!particleFramebuffer) {
        particleFramebuffer = layer.particleFramebuffer = context.createFramebuffer(particleTextureDimension, particleTextureDimension, true, null);
    } else if (particleFramebuffer.width !== particleTextureDimension) {
        assert(particleFramebuffer.width === particleFramebuffer.height);
        particleFramebuffer.destroy();
        particleFramebuffer = layer.particleFramebuffer = context.createFramebuffer(particleTextureDimension, particleTextureDimension, true, null);
    }

    // acquire and update tiles

    const tiles: Array<[OverscaledTileID, TileData, RasterParticleState, boolean]> = [];
    for (const id of tileIDs) {
        const tile = sourceCache.getTile(id);
        if (!(tile instanceof RasterArrayTile)) continue;

        const data = getTileData(tile, source, layer);
        if (!data) continue;
        assert(data.texture);

        const textureSize: [number, number] = [tile.tileSize, tile.tileSize];
        let tileFramebuffer = layer.tileFramebuffer;
        if (!tileFramebuffer) {
            const fbWidth = textureSize[0];
            const fbHeight = textureSize[1];
            tileFramebuffer = layer.tileFramebuffer = context.createFramebuffer(fbWidth, fbHeight, true, null);
        }
        assert(tileFramebuffer.width === textureSize[0] && tileFramebuffer.height === textureSize[1]);

        let state = tile.rasterParticleState;
        if (!state) {
            state = tile.rasterParticleState = new RasterParticleState(context, id, textureSize, particlePositionRGBAImage);
        }

        const renderBackground = state.update(layer.lastInvalidatedAt);

        if (state.particleTextureDimension !== particleTextureDimension) {
            state.updateParticleTexture(id, particlePositionRGBAImage);
        }

        const t = state.targetColorTexture;
        state.targetColorTexture = state.backgroundColorTexture;
        state.backgroundColorTexture = t;

        const p = state.particleTexture0;
        state.particleTexture0 = state.particleTexture1;
        state.particleTexture1 = p;

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
        if (!tex) tex = layer.colorRampTexture = new Texture(context, layer.colorRamp, gl.RGBA8);
        tex.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
    }

    // render and update the particle state

    context.bindFramebuffer.set(layer.tileFramebuffer.framebuffer);
    renderBackground(painter, layer, tiles);
    renderParticles(painter, sourceCache, layer, tiles);
    context.bindFramebuffer.set(layer.particleFramebuffer.framebuffer);
    updateParticles(painter, layer, tiles, frameDeltaSeconds);
}

type TileData = {
    texture: Texture;
    textureOffset: [number, number];
    tileSize: number;
    scalarData: boolean;
    scale: [number, number, number, number];
    offset: number;
    defines: DynamicDefinesType[];
};

function getTileData(
    tile: RasterArrayTile,
    source: RasterArrayTileSource,
    layer: RasterParticleStyleLayer,
): TileData | null | undefined {
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
    }[format] as DynamicDefinesType;

    return {
        texture,
        textureOffset: [buffer / (tileSize + 2 * buffer), tileSize / (tileSize + 2 * buffer)],
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
        const [targetTileID, targetTileData, targetTileState,] = targetTile;

        context.activeTexture.set(gl.TEXTURE0 + VELOCITY_TEXTURE_UNIT);
        targetTileData.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        framebuffer.colorAttachment.set(targetTileState.targetColorTexture.texture);
        const defines = targetTileData.defines;
        const program = painter.getOrCreateProgram('rasterParticleDraw', {defines, overrideFog: false});

        context.activeTexture.set(gl.TEXTURE0 + RASTER_PARTICLE_TEXTURE_UNIT);
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

            state.particleTexture0.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
            const rasterParticleTextureRes = state.particleTexture0.size;
            assert(rasterParticleTextureRes[0] === rasterParticleTextureRes[1]);
            const rasterParticleTextureSideLen = rasterParticleTextureRes[0];
            const tileOffset: [number, number] = [nx - x, ny - y];
            const uniforms = rasterParticleDrawUniformValues(
                RASTER_PARTICLE_TEXTURE_UNIT,
                rasterParticleTextureSideLen,
                tileOffset,
                VELOCITY_TEXTURE_UNIT,
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
                state.particleIndexBuffer,
                undefined,
                state.particleSegment
            );
        }
    }
}

function updateParticles(painter: Painter, layer: RasterParticleStyleLayer, tiles: Array<[OverscaledTileID, TileData, RasterParticleState, boolean]>, frameDeltaSeconds: number) {
    const context = painter.context;
    const gl = context.gl;

    const maxSpeed = layer.paint.get('raster-particle-max-speed');

    const speedFactor = frameDeltaSeconds * layer.paint.get('raster-particle-speed-factor') * SPEED_MAX_VALUE;
    const resetRateFactor = layer.paint.get('raster-particle-reset-rate-factor');

    const resetRate = resetRateCurve(0.01 + resetRateFactor * 1.0);
    const particleFramebuffer = layer.particleFramebuffer;
    context.viewport.set([0, 0, particleFramebuffer.width, particleFramebuffer.height]);

    for (const tile of tiles) {
        const [, data, state,] = tile;

        context.activeTexture.set(gl.TEXTURE0 + VELOCITY_TEXTURE_UNIT);
        data.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        context.activeTexture.set(gl.TEXTURE0 + RASTER_PARTICLE_TEXTURE_UNIT);
        const particleTexture = state.particleTexture0;
        particleTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
        const uniforms = rasterParticleUpdateUniformValues(
            RASTER_PARTICLE_TEXTURE_UNIT,
            particleTexture.size[0],
            VELOCITY_TEXTURE_UNIT,
            data.texture.size,

            maxSpeed,
            speedFactor,
            resetRate,
            data.textureOffset,
            data.scale,
            data.offset
        );
        particleFramebuffer.colorAttachment.set(state.particleTexture1.texture);
        context.clear({color: Color.transparent});
        const updateProgram = painter.getOrCreateProgram('rasterParticleUpdate', {defines: data.defines});
        updateProgram.draw(
            painter,
            gl.TRIANGLES,
            DepthMode.disabled,
            StencilMode.disabled,
            ColorMode.unblended,
            CullFaceMode.disabled,
            uniforms,
            layer.id,
            painter.viewportBuffer,
            painter.quadTriangleIndexBuffer,
            painter.viewportSegments);
    }
}

function renderTextureToMap(painter: Painter, sourceCache: SourceCache, layer: RasterParticleStyleLayer, tileIDs: Array<OverscaledTileID>, _: boolean) {
    const context = painter.context;
    const gl = context.gl;

    // Add minimum elevation for globe zoom level to avoid clipping with globe tiles
    const tileSize = sourceCache.getSource().tileSize;
    const minLiftForZoom = (1.0 - smoothstep(GLOBE_ZOOM_THRESHOLD_MAX, GLOBE_ZOOM_THRESHOLD_MAX + 1.0, painter.transform.zoom)) * 5.0 * tileSize;
    const rasterElevation = minLiftForZoom + layer.paint.get('raster-particle-elevation');
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

    const stencilMode = painter.stencilModeFor3D();

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
            projMatrix as Float32Array,
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
            const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);
            const skirtHeightValue = 0;
            const sharedBuffers = painter.globeSharedBuffers;
            if (sharedBuffers) {
                const [buffer, indexBuffer, segments] = sharedBuffers.getGridBuffers(latitudinalLod, skirtHeightValue !== 0);
                assert(buffer);
                assert(indexBuffer);
                assert(segments);
                program.draw(painter, gl.TRIANGLES, depthMode, stencilMode, ColorMode.alphaBlended, painter.renderElevatedRasterBackface ? CullFaceMode.frontCCW : CullFaceMode.backCCW, uniformValues, layer.id, buffer, indexBuffer, segments);
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

    // @ts-expect-error - TS2322 - Type 'Tile[]' is not assignable to type 'RasterArrayTile[]'.
    const tiles: Array<RasterArrayTile> = sourceCache.getIds().map(id => sourceCache.getTileByID(id));
    for (const tile of tiles) {
        if (tile.updateNeeded(sourceLayer, band)) {
            source.prepareTile(tile, sourceLayer, band);
        }
    }
}
