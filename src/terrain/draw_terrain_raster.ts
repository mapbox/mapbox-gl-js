import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {terrainRasterUniformValues} from './terrain_raster_program';
import {globeRasterUniformValues} from './globe_raster_program';
import assert from 'assert';
import {easeCubicInOut} from '../util/util';
import browser from '../util/browser';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate';
import StencilMode from '../gl/stencil_mode';
import {mat4} from 'gl-matrix';
import {
    calculateGlobeMercatorMatrix,
    globeToMercatorTransition,
    globePoleMatrixForTile,
    getGridMatrix,
    tileCornersToBounds,
    globeNormalizeECEF,
    globeTileBounds,
    globeUseCustomAntiAliasing,
    getLatitudinalLod
} from '../geo/projection/globe_util';
import extend from '../style-spec/util/extend';
import {calculateGroundShadowFactor} from '../../3d-style/render/shadow_renderer';
import {getCutoffParams} from '../render/cutoff';

import type Program from '../render/program';
import type VertexBuffer from '../gl/vertex_buffer';
import type {Terrain} from './terrain';
import type {OverscaledTileID, CanonicalTileID} from '../source/tile_id';
import type SourceCache from '../source/source_cache';
import type Painter from '../render/painter';
import type Tile from '../source/tile';
import type {DynamicDefinesType} from '../render/program/program_uniforms';
import type {GlobeRasterUniformsType} from './globe_raster_program';
import type {TerrainRasterUniformsType} from './terrain_raster_program';

export {
    drawTerrainRaster
};

type DEMChain = {
    startTime: number;
    phase: number;
    duration: number   // Interpolation duration in milliseconds;
    from: Tile;
    to: Tile;
    queued: Tile | null | undefined;
};

class VertexMorphing {
    operations: Partial<Record<string | number, DEMChain>>;

    constructor() {
        this.operations = {};
    }

    newMorphing(key: number, from: Tile, to: Tile, now: number, duration: number) {
        assert(from.demTexture && to.demTexture);
        assert(from.tileID.key !== to.tileID.key);

        if (key in this.operations) {
            const op = this.operations[key];
            assert(op.from && op.to);
            // Queue the target tile unless it's being morphed to already
            if (op.to.tileID.key !== to.tileID.key)
                op.queued = to;
        } else {
            this.operations[key] = {
                startTime: now,
                phase: 0.0,
                duration,
                from,
                to,
                queued: null
            };
        }
    }

    getMorphValuesForProxy(key: number): {
        from: Tile;
        to: Tile;
        phase: number;
    } | null | undefined {
        if (!(key in this.operations))
            return null;

        const op = this.operations[key];
        const from = op.from;
        const to = op.to;
        assert(from && to);

        return {from, to, phase: op.phase};
    }

    update(now: number) {
        for (const key in this.operations) {
            const op = this.operations[key];
            assert(op.from && op.to);

            op.phase = (now - op.startTime) / op.duration;

            // Start the queued operation if the current one is finished or the data has expired
            while (op.phase >= 1.0 || !this._validOp(op)) {
                if (!this._nextOp(op, now)) {
                    delete this.operations[key];
                    break;
                }
            }
        }
    }

    _nextOp(op: DEMChain, now: number): boolean {
        if (!op.queued)
            return false;
        op.from = op.to;
        op.to = op.queued;
        op.queued = null;
        op.phase = 0.0;
        op.startTime = now;
        return true;
    }

    _validOp(op: DEMChain): boolean {
        return op.from.hasData() && op.to.hasData();
    }
}

function demTileChanged(prev?: Tile | null, next?: Tile | null): boolean {
    if (prev == null || next == null)
        return false;
    if (!prev.hasData() || !next.hasData())
        return false;
    if (prev.demTexture == null || next.demTexture == null)
        return false;
    return prev.tileID.key !== next.tileID.key;
}

const vertexMorphing = new VertexMorphing();
const SHADER_DEFAULT = 0;
const SHADER_MORPHING = 1;
const defaultDuration = 250;

const shaderDefines = {
    "0": null,
    "1": 'TERRAIN_VERTEX_MORPHING'
};

function drawTerrainForGlobe(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>, now: number) {
    const context = painter.context;
    const gl = context.gl;

    let program: Program<GlobeRasterUniformsType>;
    let programMode: number;
    const tr = painter.transform;
    const useCustomAntialiasing = globeUseCustomAntiAliasing(painter, context, tr);

    const setShaderMode = (coord: OverscaledTileID, mode: number) => {
        if (programMode === mode) return;
        const defines = [shaderDefines[mode], 'PROJECTION_GLOBE_VIEW'];

        if (useCustomAntialiasing) defines.push('CUSTOM_ANTIALIASING');

        const affectedByFog = painter.isTileAffectedByFog(coord);
        program = painter.getOrCreateProgram('globeRaster', {defines, overrideFog: affectedByFog});
        programMode = mode;
    };

    const colorMode = painter.colorModeForRenderPass();
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    vertexMorphing.update(now);
    const globeMercatorMatrix = calculateGlobeMercatorMatrix(tr);
    const mercatorCenter: [number, number] = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];
    const sharedBuffers = painter.globeSharedBuffers;
    const viewport: [number, number] = [tr.width * browser.devicePixelRatio, tr.height * browser.devicePixelRatio];
    const globeMatrix = Float32Array.from(tr.globeMatrix);
    const elevationOptions = {useDenormalizedUpVectorScale: true};

    {
        const tr = painter.transform;
        const skirtHeightValue = skirtHeight(tr.zoom, terrain.exaggeration(), terrain.sourceCache._source.tileSize);

        programMode = -1;

        const primitive = gl.TRIANGLES;

        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);
            const stencilMode = StencilMode.disabled;

            const prevDemTile = terrain.prevTerrainTileForTile[coord.key];
            const nextDemTile = terrain.terrainTileForTile[coord.key];

            if (demTileChanged(prevDemTile, nextDemTile)) {
                vertexMorphing.newMorphing(coord.key, prevDemTile, nextDemTile, now, defaultDuration);
            }

            // Bind the main draped texture
            context.activeTexture.set(gl.TEXTURE0);
            if (tile.texture) {
                tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            }

            const morph = vertexMorphing.getMorphValuesForProxy(coord.key);
            const shaderMode = morph ? SHADER_MORPHING : SHADER_DEFAULT;

            if (morph) {
                extend(elevationOptions, {morphing: {srcDemTile: morph.from, dstDemTile: morph.to, phase: easeCubicInOut(morph.phase)}});
            }

            const tileBounds = tileCornersToBounds(coord.canonical);
            const latitudinalLod = getLatitudinalLod(tileBounds.getCenter().lat);
            const gridMatrix = getGridMatrix(coord.canonical, tileBounds, latitudinalLod, tr.worldSize / tr._pixelsPerMercatorPixel);
            const normalizeMatrix = globeNormalizeECEF(globeTileBounds(coord.canonical));
            const uniformValues = globeRasterUniformValues(
                tr.expandedFarZProjMatrix, globeMatrix, globeMercatorMatrix, normalizeMatrix, globeToMercatorTransition(tr.zoom),
                mercatorCenter, tr.frustumCorners.TL, tr.frustumCorners.TR, tr.frustumCorners.BR,
                tr.frustumCorners.BL, tr.globeCenterInViewSpace, tr.globeRadius, viewport, skirtHeightValue, tr._farZ, gridMatrix);

            setShaderMode(coord, shaderMode);
            if (!program) {
                continue;
            }

            terrain.setupElevationDraw(tile, program, elevationOptions);

            painter.uploadCommonUniforms(context, program, coord.toUnwrapped());

            if (sharedBuffers) {
                const [buffer, indexBuffer, segments] = sharedBuffers.getGridBuffers(latitudinalLod, skirtHeightValue !== 0);

                program.draw(painter, primitive, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
                    uniformValues, "globe_raster", buffer, indexBuffer, segments);
            }
        }
    }

    // Render the poles.
    if (sharedBuffers && (painter.renderDefaultNorthPole || painter.renderDefaultSouthPole)) {
        const defines: DynamicDefinesType[] = ['GLOBE_POLES', 'PROJECTION_GLOBE_VIEW'];
        if (useCustomAntialiasing) defines.push('CUSTOM_ANTIALIASING');

        program = painter.getOrCreateProgram('globeRaster', {defines});
        for (const coord of tileIDs) {
            // Fill poles by extrapolating adjacent border tiles
            const {x, y, z} = coord.canonical;
            const topCap = y === 0;
            const bottomCap = y === (1 << z) - 1;

            const [northPoleBuffer, southPoleBuffer, indexBuffer, segment] = sharedBuffers.getPoleBuffers(z, false);

            if (segment && (topCap || bottomCap)) {
                const tile = sourceCache.getTile(coord);

                // Bind the main draped texture
                context.activeTexture.set(gl.TEXTURE0);
                if (tile.texture) {
                    tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
                }

                let poleMatrix = globePoleMatrixForTile(z, x, tr);
                const normalizeMatrix = globeNormalizeECEF(globeTileBounds(coord.canonical));

                const drawPole = (program: Program<GlobeRasterUniformsType>, vertexBuffer: VertexBuffer) => program.draw(
                    painter, gl.TRIANGLES, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled,
                    globeRasterUniformValues(tr.expandedFarZProjMatrix, poleMatrix, poleMatrix, normalizeMatrix, 0.0, mercatorCenter,
                    tr.frustumCorners.TL, tr.frustumCorners.TR, tr.frustumCorners.BR, tr.frustumCorners.BL,
                    tr.globeCenterInViewSpace, tr.globeRadius, viewport, 0, tr._farZ), "globe_pole_raster", vertexBuffer,
                    indexBuffer, segment);

                terrain.setupElevationDraw(tile, program, elevationOptions);

                painter.uploadCommonUniforms(context, program, coord.toUnwrapped());

                if (topCap && painter.renderDefaultNorthPole) {
                    drawPole(program, northPoleBuffer);
                }
                if (bottomCap && painter.renderDefaultSouthPole) {
                    poleMatrix = mat4.scale(mat4.create(), poleMatrix, [1, -1, 1]);
                    drawPole(program, southPoleBuffer);
                }
            }
        }
    }
}

function drawTerrainRaster(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>, now: number) {
    if (painter.transform.projection.name === 'globe') {
        drawTerrainForGlobe(painter, terrain, sourceCache, tileIDs, now);
    } else {
        const context = painter.context;
        const gl = context.gl;

        let program: Program<TerrainRasterUniformsType>;
        let programMode: number;
        const shadowRenderer = painter.shadowRenderer;
        const cutoffParams = getCutoffParams(painter, painter.longestCutoffRange);

        const setShaderMode = (mode: number) => {
            if (programMode === mode)
                return;
            const modes: DynamicDefinesType[] = [];
            modes.push(shaderDefines[mode]);
            if (cutoffParams.shouldRenderCutoff) {
                modes.push('RENDER_CUTOFF');
            }
            if (shadowRenderer) {
                modes.push('RENDER_SHADOWS', 'DEPTH_TEXTURE');
                if (shadowRenderer.useNormalOffset) {
                    modes.push('NORMAL_OFFSET');
                }
            }
            program = painter.getOrCreateProgram('terrainRaster', {defines: modes});
            programMode = mode;
        };

        const colorMode = painter.colorModeForRenderPass();
        const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
        vertexMorphing.update(now);
        const tr = painter.transform;
        const skirt = skirtHeight(tr.zoom, terrain.exaggeration(), terrain.sourceCache._source.tileSize);

        let groundShadowFactor: [number, number, number] = [0, 0, 0];
        if (shadowRenderer) {
            const directionalLight = painter.style.directionalLight;
            const ambientLight = painter.style.ambientLight;
            if (directionalLight && ambientLight) {
                groundShadowFactor = calculateGroundShadowFactor(painter.style, directionalLight, ambientLight);
            }
        }

        {
            programMode = -1;

            const primitive = gl.TRIANGLES;
            const [buffer, segments] = [terrain.gridIndexBuffer, terrain.gridSegments];

            for (const coord of tileIDs) {
                const tile = sourceCache.getTile(coord);
                const stencilMode = StencilMode.disabled;

                const prevDemTile = terrain.prevTerrainTileForTile[coord.key];
                const nextDemTile = terrain.terrainTileForTile[coord.key];

                if (demTileChanged(prevDemTile, nextDemTile)) {
                    vertexMorphing.newMorphing(coord.key, prevDemTile, nextDemTile, now, defaultDuration);
                }

                // Bind the main draped texture
                context.activeTexture.set(gl.TEXTURE0);
                if (tile.texture) {
                    tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
                }

                const morph = vertexMorphing.getMorphValuesForProxy(coord.key);
                const shaderMode = morph ? SHADER_MORPHING : SHADER_DEFAULT;
                let elevationOptions;

                if (morph) {
                    elevationOptions = {morphing: {srcDemTile: morph.from, dstDemTile: morph.to, phase: easeCubicInOut(morph.phase)}};
                }

                const uniformValues = terrainRasterUniformValues(coord.projMatrix, isEdgeTile(coord.canonical, tr.renderWorldCopies) ? skirt / 10 : skirt, groundShadowFactor);
                setShaderMode(shaderMode);
                if (!program) {
                    continue;
                }

                terrain.setupElevationDraw(tile, program, elevationOptions);

                const unwrappedId = coord.toUnwrapped();

                if (shadowRenderer) {
                    shadowRenderer.setupShadows(unwrappedId, program);
                }

                painter.uploadCommonUniforms(context, program, unwrappedId, null, cutoffParams);

                program.draw(painter, primitive, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
                    uniformValues, "terrain_raster", terrain.gridBuffer, buffer, segments);
            }
        }
    }
}

function skirtHeight(zoom: number, terrainExaggeration: number, tileSize: number) {
    // Skirt height calculation is heuristic: provided value hides
    // seams between tiles and it is not too large: 9 at zoom 22, ~20000m at zoom 0.
    if (terrainExaggeration === 0) return 0;
    const exaggerationFactor = (terrainExaggeration < 1.0 && tileSize === 514) ? 0.25 / terrainExaggeration : 1.0;
    return 6 * Math.pow(1.5, 22 - zoom) * Math.max(terrainExaggeration, 1.0) * exaggerationFactor;
}

function isEdgeTile(cid: CanonicalTileID, renderWorldCopies: boolean): boolean {
    const numTiles = 1 << cid.z;
    return (!renderWorldCopies && (cid.x === 0 || cid.x === numTiles - 1)) || cid.y === 0 || cid.y === numTiles - 1;
}

export {
    VertexMorphing
};
