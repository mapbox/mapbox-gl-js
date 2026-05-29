import {MAX_FRC_LEVELS} from './frc_coverage_renderer';
import StencilMode from '../../src/gl/stencil_mode';
import ColorMode from '../../src/gl/color_mode';
import DepthMode from '../../src/gl/depth_mode';
import CullFaceMode from '../../src/gl/cull_face_mode';
import {clippingMaskUniformValues} from '../../src/render/program/clipping_mask_program';
import {CanonicalTileID, UnwrappedTileID} from '../../src/source/tile_id';

import type {OverscaledTileID} from '../../src/source/tile_id';
import type Painter from '../../src/render/painter';

/// Stencil mode for rendering outside coverage polygon (covered roads not inside polygon).
/// Equal to tileClipID means we're outside the polygon (polygon inverted stencil).
export function stencilModeForFrcCoverage(painter: Painter, tileID: OverscaledTileID): Readonly<StencilMode> {
    const gl = painter.context.gl;
    const clipId = painter._tileClippingMaskIDs[tileID.key] || 0;
    return new StencilMode({func: gl.EQUAL, mask: 0xFF}, clipId, 0x00, gl.KEEP, gl.KEEP, gl.KEEP);
}

/// Stencil mode for rendering inside coverage polygon (faded roads inside polygon).
/// Inside polygon has stencil = ~clipId (after INVERT carve in renderFrcCoverageMasks).
function stencilModeInsideFrcCoverage(painter: Painter, tileID: OverscaledTileID): Readonly<StencilMode> {
    const gl = painter.context.gl;
    const clipId = painter._tileClippingMaskIDs[tileID.key] || 0;
    return new StencilMode({func: gl.EQUAL, mask: 0xFF}, ~clipId & 0xFF, 0x00, gl.KEEP, gl.KEEP, gl.KEEP);
}

/// Scale a road tile's canonical ID to coverage zoom and find coverage buffers.
/// Mirrors C++ drawFrcCoveragePolygons: renderTile.id.canonical.scaledTo(coverageZoom).
function getCoverageBuffersForTile(painter: Painter, coord: OverscaledTileID) {
    if (!painter.frcCoverageSnapshot || !painter.frcCoverageRenderer) return null;
    const coverageTile = painter.frcCoverageSnapshot.getTileOrParent(coord.canonical);
    if (!coverageTile || coverageTile.frcMask === 0) return null;

    const buffers = painter.frcCoverageRenderer.getBuffers(coverageTile.tileId);
    if (!buffers) return null;

    const coverageCanonical = new CanonicalTileID(coverageTile.tileId.z, coverageTile.tileId.x, coverageTile.tileId.y);
    const coverageUnwrapped = new UnwrappedTileID(coord.wrap, coverageCanonical);
    const projMatrix = painter.transform.calculateProjMatrix(coverageUnwrapped);

    return {buffers, projMatrix, coverageTile};
}

/// Render coverage polygons for a specific FRC level into the stencil buffer.
/// Uses per-FRC-level segments so only polygons covering that level are drawn.
/// After this, pixels inside polygon have stencil = clipID ^ 0xFF, outside = clipID.
function renderFrcCoverageMasks(painter: Painter, coords: Array<OverscaledTileID>, frcLevel: number) {
    if (!painter.frcCoverageSnapshot) return;
    const context = painter.context;
    const gl = context.gl;
    const program = painter.getOrCreateProgram('clippingMask');

    context.setColorMode(ColorMode.disabled);
    context.setDepthMode(DepthMode.disabled);

    for (const coord of coords) {
        const info = getCoverageBuffersForTile(painter, coord);
        if (!info) continue;

        const levelSegments = info.buffers.frcLevelSegments[frcLevel];
        if (!levelSegments) continue;

        const clipId = painter._tileClippingMaskIDs[coord.key] || 0;
        program.draw(painter, gl.TRIANGLES, DepthMode.disabled,
            new StencilMode({func: gl.EQUAL, mask: 0xFF}, clipId, 0xFF, gl.KEEP, gl.KEEP, gl.INVERT),
            ColorMode.disabled, CullFaceMode.disabled,
            clippingMaskUniformValues(info.projMatrix),
            `$frc_coverage_${frcLevel}`, info.buffers.vertexBuffer, info.buffers.indexBuffer, levelSegments);
    }
}

/// Restore stencil for a specific FRC level by inverting inside-polygon pixels back to clipId.
function restoreFrcCoverageMasks(painter: Painter, coords: Array<OverscaledTileID>, frcLevel: number) {
    if (!painter.frcCoverageSnapshot) return;
    const context = painter.context;
    const gl = context.gl;
    const program = painter.getOrCreateProgram('clippingMask');

    context.setColorMode(ColorMode.disabled);
    context.setDepthMode(DepthMode.disabled);

    for (const coord of coords) {
        const info = getCoverageBuffersForTile(painter, coord);
        if (!info) continue;

        const levelSegments = info.buffers.frcLevelSegments[frcLevel];
        if (!levelSegments) continue;

        const clipId = painter._tileClippingMaskIDs[coord.key] || 0;
        program.draw(painter, gl.TRIANGLES, DepthMode.disabled,
            new StencilMode({func: gl.EQUAL, mask: 0xFF}, ~clipId & 0xFF, 0xFF, gl.KEEP, gl.KEEP, gl.INVERT),
            ColorMode.disabled, CullFaceMode.disabled,
            clippingMaskUniformValues(info.projMatrix),
            `$frc_coverage_restore_${frcLevel}`, info.buffers.vertexBuffer, info.buffers.indexBuffer, levelSegments);
    }
}

/**
 * Per-FRC-level stencil pass for partial-coverage tiles. Mirrors the C++
 * `renderFrcCoverageSecondPass` helper in `frc_coverage_render.hpp`. Consumers
 * (draw_line, draw_fill) supply the per-tile draw callbacks; this helper owns
 * the stencil setup, the per-FRC iteration and the outside / inside dispatch.
 *
 * @param painter        Painter (for stencil mask helpers).
 * @param tiles          Tiles to render in the second pass; each carries its frcMask.
 * @param fadeFactor     Multiplier (0..1) for the inside-polygon overpaint. 0 skips it.
 * @param drawOutside    Per-tile draw outside the polygon (full opacity). null = skip.
 * @param drawInside     Per-tile draw inside the polygon (faded). Called only when fadeFactor > 0.
 * @private
 */
export function renderFrcCoverageSecondPass<TileInfo extends {coord: OverscaledTileID; frcMask: number}>(
    painter: Painter,
    tiles: Array<TileInfo>,
    fadeFactor: number,
    drawOutside: ((info: TileInfo, frc: number, stencilMode: Readonly<StencilMode>) => void) | null,
    drawInside: ((info: TileInfo, frc: number, stencilMode: Readonly<StencilMode>) => void) | null,
): void {
    if (tiles.length === 0) return;

    let allMasks = 0;
    for (const info of tiles) {
        allMasks |= info.frcMask;
    }
    const coverageCoords = tiles.map(t => t.coord);

    for (let frc = 0; frc < MAX_FRC_LEVELS; ++frc) {
        if ((allMasks & (1 << frc)) === 0) continue;

        renderFrcCoverageMasks(painter, coverageCoords, frc);

        if (drawOutside) {
            for (const info of tiles) {
                if ((info.frcMask & (1 << frc)) === 0) continue;
                drawOutside(info, frc, stencilModeForFrcCoverage(painter, info.coord));
            }
        }

        if (fadeFactor > 0 && drawInside) {
            for (const info of tiles) {
                if ((info.frcMask & (1 << frc)) === 0) continue;
                drawInside(info, frc, stencilModeInsideFrcCoverage(painter, info.coord));
            }
        }

        restoreFrcCoverageMasks(painter, coverageCoords, frc);
    }
}
