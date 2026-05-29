import CullFaceMode from '../../src/gl/cull_face_mode';
import {renderFrcCoverageSecondPass} from './frc_coverage_second_pass';

import type {OverscaledTileID} from '../../src/source/tile_id';
import type Painter from '../../src/render/painter';
import type Program from '../../src/render/program';
import type ProgramConfiguration from '../../src/data/program_configuration';
import type IndexBuffer from '../../src/gl/index_buffer';
import type VertexBuffer from '../../src/gl/vertex_buffer';
import type StencilMode from '../../src/gl/stencil_mode';
import type SegmentVector from '../../src/data/segment';
import type DepthMode from '../../src/gl/depth_mode';
import type ColorMode from '../../src/gl/color_mode';
import type FillStyleLayer from '../../src/style/style_layer/fill_style_layer';
import type LineStyleLayer from '../../src/style/style_layer/line_style_layer';
import type FillBucket from '../../src/data/bucket/fill_bucket';
import type LineBucket from '../../src/data/bucket/line_bucket';
import type {UniformValues, UniformBindings} from '../../src/render/uniform_binding';
import type {DrawMode} from '../../src/render/program';
import type FillBufferData from '../../src/data/bucket/fill_buffer_data';
import type ElevatedFillBufferData from '../data/bucket/elevated_fill_buffer_data';
import type {FrcCoveragePolygons, FrcCoverageTile} from '../../src/source/frc_coverage_snapshot';

/// Check if any polygon in the array has geometry (partial coverage).
/// Lives in HD so core's draw_fill/draw_line stop pulling frc_coverage_snapshot
/// runtime when FRC is inactive.
function polygonsHaveGeometry(polygons: FrcCoveragePolygons): boolean {
    for (const p of polygons) {
        if (p.rings.length > 0 && p.rings[0].length > 0) return true;
    }
    return false;
}

/// Compute the FRC-coverage opacity multiplier for the inside-polygon overpaint.
/// 1.0 = fully opaque, 0 = fully transparent (no overpaint needed).
export function frcCoverageFadeFactor(painter: Painter): number {
    const fr = painter.frcCoverageFadeRange;
    if (!fr || fr[1] <= fr[0]) return 0;
    const zoom = painter.transform.zoom;
    return 1.0 - Math.max(0, Math.min(1, (zoom - fr[0]) / (fr[1] - fr[0])));
}

interface FillCoverageTileInfo {
    coord: OverscaledTileID;
    bufferData: FillBufferData;
    program: Program<UniformBindings>;
    programConfiguration: ProgramConfiguration;
    uniformValues: UniformValues<UniformBindings>;
    depthMode: Readonly<DepthMode>;
    dynamicBuffers: VertexBuffer[];
    indexBuffer: IndexBuffer;
    segments: SegmentVector;
    frcMask: number;
}

/// Outside-full + inside-faded second pass for partial-coverage structure fills.
/// Mirrors C++ `render_fill_layer` second pass.
export function drawFillFrcCoverageSecondPass(
    painter: Painter,
    layer: FillStyleLayer,
    tiles: FillCoverageTileInfo[],
    drawMode: DrawMode,
    colorMode: Readonly<ColorMode>,
): void {
    if (tiles.length === 0) return;
    const fadeFactor = frcCoverageFadeFactor(painter);
    const zoom = painter.transform.zoom;

    const drawAt = (info: FillCoverageTileInfo, stencilMode: Readonly<StencilMode>, opacityMul: number) => {
        if (opacityMul !== 1.0) info.uniformValues['u_opacity_multiplier'] = opacityMul;
        info.program.draw(painter, drawMode, info.depthMode,
            stencilMode, colorMode, CullFaceMode.disabled, info.uniformValues,
            layer.id, info.bufferData.layoutVertexBuffer, info.indexBuffer, info.segments,
            layer.paint, zoom, info.programConfiguration, info.dynamicBuffers);
        if (opacityMul !== 1.0) info.uniformValues['u_opacity_multiplier'] = 1.0;
    };

    renderFrcCoverageSecondPass(painter, tiles, fadeFactor,
        (info, _frc, stencilMode) => drawAt(info, stencilMode, 1.0),
        (info, _frc, stencilMode) => drawAt(info, stencilMode, fadeFactor));
}

interface LineCoverageTileInfo {
    coord: OverscaledTileID;
    bucket: LineBucket;
    uniformValues: UniformValues<UniformBindings>;
    programConfiguration: ProgramConfiguration;
    program: Program<UniformBindings>;
    depthMode: Readonly<DepthMode>;
    colorMode: Readonly<ColorMode>;
    frcMask: number;
}

/// Outside-full + inside-faded second pass for partial-coverage line tiles. Per-FRC-level
/// segments are looked up from `bucket.hdExt.frcData.frcPerLevel`. Mirrors C++
/// `render_line_layer` second pass.
export function drawLineFrcCoverageSecondPass(
    painter: Painter,
    layer: LineStyleLayer,
    tiles: LineCoverageTileInfo[],
): void {
    if (tiles.length === 0) return;
    const gl = painter.context.gl;
    const fadeFactor = frcCoverageFadeFactor(painter);
    const zoom = painter.transform.zoom;

    const drawAt = (info: LineCoverageTileInfo, frc: number, stencilMode: Readonly<StencilMode>, opacityMul: number) => {
        const frcData = info.bucket.hdExt && info.bucket.hdExt.frcData;
        const segs = frcData && frcData.frcPerLevel.get(frc);
        if (!segs || segs.segments.length === 0) return;
        if (opacityMul !== 1.0) info.uniformValues['u_opacity_multiplier'] = opacityMul;
        info.program.draw(painter, gl.TRIANGLES, info.depthMode,
            stencilMode, info.colorMode, CullFaceMode.disabled, info.uniformValues,
            layer.id, info.bucket.layoutVertexBuffer, info.bucket.indexBuffer, segs,
            layer.paint, zoom, info.programConfiguration,
            [info.bucket.layoutVertexBuffer2, info.bucket.patternVertexBuffer, info.bucket.zOffsetVertexBuffer, info.bucket.elevationIdColVertexBuffer, info.bucket.elevationGroundScaleVertexBuffer]);
        if (opacityMul !== 1.0) info.uniformValues['u_opacity_multiplier'] = 1.0;
    };

    renderFrcCoverageSecondPass(painter, tiles, fadeFactor,
        (info, frc, stencilMode) => drawAt(info, frc, stencilMode, 1.0),
        (info, frc, stencilMode) => drawAt(info, frc, stencilMode, fadeFactor));
}

/// Outcome of `drawFillFrcCoverageFirstPass` — instructs core whether to
/// skip the default draw and/or skip the tile entirely.
///   'drawn': HD performed per-level draws → core skips default draw.
///   'deferred': HD pushed the tile to the second-pass collector → core skips default draw.
///   'skip': structure tile is fully covered → core skips draw without falling through.
///   'fallthrough': FRC not applicable → core does its default draw.
export type FillFrcFirstPassResult = 'drawn' | 'deferred' | 'skip' | 'fallthrough';

export interface FillFrcCoverageFirstPassParams {
    painter: Painter;
    layer: FillStyleLayer;
    bucket: FillBucket;
    coord: OverscaledTileID;
    elevatedGeometry: boolean;
    program: Program<UniformBindings>;
    programConfiguration: ProgramConfiguration;
    uniformValues: UniformValues<UniformBindings>;
    drawMode: DrawMode;
    depthMode: Readonly<DepthMode>;
    stencilMode: Readonly<StencilMode>;
    colorMode: Readonly<ColorMode>;
    bufferData: FillBufferData | ElevatedFillBufferData;
    indexBuffer: IndexBuffer;
    segments: SegmentVector;
    dynamicBuffers: VertexBuffer[];
    polygonCoverageTiles: FillCoverageTileInfo[];
}

/// First-pass FRC coverage handling for fill (road / structure source layers).
/// Owns: snapshot lookup, polygon-geometry probe, structure skip/defer routing, road
/// per-FRC-level dispatch. See `FillFrcFirstPassResult` for the contract with core.
export function drawFillFrcCoverageFirstPass(p: FillFrcCoverageFirstPassParams): FillFrcFirstPassResult {
    const {painter, bucket, coord, elevatedGeometry} = p;
    const isRoadLayer = bucket.sourceLayerName === 'road';
    const isStructureLayer = bucket.sourceLayerName === 'structure';
    if (!isRoadLayer && !isStructureLayer) return 'fallthrough';
    if (!painter.frcCoverageSnapshot || elevatedGeometry) return 'fallthrough';
    const coverageTile = painter.frcCoverageSnapshot.getTileOrParent(coord.canonical);
    if (!coverageTile || coverageTile.frcMask === 0) return 'fallthrough';

    const frcData = bucket.hdExt && bucket.hdExt.frcData;
    const hasFrcData = !!frcData && !frcData.empty();
    const hasPolygonGeometry = polygonsHaveGeometry(coverageTile.polygons);

    if (isStructureLayer && !hasPolygonGeometry) {
        // Full-tile structure coverage — skip entirely.
        return 'skip';
    }
    if (isStructureLayer && hasPolygonGeometry) {
        // Partial polygon coverage — defer to outside/inside second pass.
        p.polygonCoverageTiles.push({
            coord: p.coord, bufferData: p.bufferData, program: p.program,
            programConfiguration: p.programConfiguration, uniformValues: p.uniformValues,
            depthMode: p.depthMode, dynamicBuffers: p.dynamicBuffers,
            indexBuffer: p.indexBuffer, segments: p.segments,
            frcMask: coverageTile.frcMask,
        });
        return 'deferred';
    }
    if (isRoadLayer && hasFrcData && frcData) {
        const mask = coverageTile.frcMask;
        const zoom = painter.transform.zoom;
        for (const [level, levelSegs] of frcData.frcPerLevel) {
            if ((mask & (1 << level)) !== 0) continue;
            if (levelSegs.segments.length === 0) continue;
            p.program.draw(painter, p.drawMode, p.depthMode,
                p.stencilMode, p.colorMode, CullFaceMode.disabled, p.uniformValues,
                p.layer.id, p.bufferData.layoutVertexBuffer, p.indexBuffer, levelSegs,
                p.layer.paint, zoom, p.programConfiguration, p.dynamicBuffers);
        }
        if (frcData.frcNonRoadSegments.segments.length > 0) {
            p.program.draw(painter, p.drawMode, p.depthMode,
                p.stencilMode, p.colorMode, CullFaceMode.disabled, p.uniformValues,
                p.layer.id, p.bufferData.layoutVertexBuffer, p.indexBuffer, frcData.frcNonRoadSegments,
                p.layer.paint, zoom, p.programConfiguration, p.dynamicBuffers);
        }
        return 'drawn';
    }
    return 'fallthrough';
}

/// Per-tile FRC state computed in `drawLineFrcCoverageFirstPass`. Carried by core so
/// it can pass into per-renderLine-call dispatch (`drawLineFrcRenderLine`) and the
/// post-renderLine fade pass (`drawLineFrcFadePass`). Treated as opaque by core.
export interface LineFrcCoverageContext {
    coverageTile: FrcCoverageTile;
    frcMask: number;
    active: boolean;            // true when zoom is at/above fade range start (per-level dispatch)
    hasPolygonGeometry: boolean; // true when partial coverage — disables fade pass; deferred to second pass
}

/// Detect FRC coverage state for a line tile and (when partial coverage applies)
/// register it for the second-pass collector. Returns `null` when FRC is not
/// applicable (snapshot empty, elevated geometry, no bucket frcData, or
/// coverageTile mask is 0). Returns a context for per-renderLine dispatch otherwise.
export function drawLineFrcCoverageDetect(
    painter: Painter,
    bucket: LineBucket,
    coord: OverscaledTileID,
    elevated: boolean,
    uniformValues: UniformValues<UniformBindings>,
    programConfiguration: ProgramConfiguration,
    program: Program<UniformBindings>,
    depthMode: Readonly<DepthMode>,
    colorMode: Readonly<ColorMode>,
    polygonCoverageTiles: LineCoverageTileInfo[],
): LineFrcCoverageContext | null {
    const frcData = bucket.hdExt && bucket.hdExt.frcData;
    if (!frcData || frcData.frcPerLevel.size === 0) return null;
    if (!painter.frcCoverageSnapshot || elevated) return null;
    const coverageTile = painter.frcCoverageSnapshot.getTileOrParent(coord.canonical);
    if (!coverageTile || coverageTile.frcMask === 0) return null;

    const hasPolygonGeometry = polygonsHaveGeometry(coverageTile.polygons);
    const fadeRange = painter.frcCoverageFadeRange;
    const zoom = painter.transform.zoom;
    // Coverage active only at or above fade range start zoom. Matches C++ frcActive.
    const active = fadeRange != null && zoom >= fadeRange[0];

    if (hasPolygonGeometry && active) {
        let hasAnyCovered = false;
        for (const frcLevel of frcData.frcPerLevel.keys()) {
            if ((coverageTile.frcMask & (1 << frcLevel)) !== 0) { hasAnyCovered = true; break; }
        }
        if (hasAnyCovered) {
            polygonCoverageTiles.push({
                coord, bucket,
                uniformValues, programConfiguration, program, depthMode, colorMode,
                frcMask: coverageTile.frcMask,
            });
        }
    }
    return {coverageTile, frcMask: coverageTile.frcMask, active, hasPolygonGeometry};
}

/// FRC-aware per-level dispatch for line render. Called by core's `renderLine` closure
/// in place of the default `drawWithSegments(stencilMode, bucket.segments)` when the
/// detect call returned an active context. Zero-alloc — iterates `frcPerLevel` directly.
export function drawLineFrcRenderLine(
    bucket: LineBucket,
    ctx: LineFrcCoverageContext,
    stencilMode: Readonly<StencilMode>,
    drawWithSegments: (stencilMode: Readonly<StencilMode>, segs: SegmentVector | undefined, opacityMultiplier?: number) => void,
): void {
    const frcData = bucket.hdExt && bucket.hdExt.frcData;
    if (!frcData) return;
    const mask = ctx.frcMask;
    for (const [level, segs] of frcData.frcPerLevel) {
        if ((mask & (1 << level)) !== 0) continue;
        drawWithSegments(stencilMode, segs);
    }
    const nonRoad = frcData.frcNonRoadSegments;
    if (nonRoad.segments.length > 0) drawWithSegments(stencilMode, nonRoad);
}

/// Render covered FRC segments at faded opacity for full-tile coverage (Case A).
/// Called by core AFTER the renderLine paths complete. No-op when partial polygon
/// coverage (handled by second pass) or fade range absent.
export function drawLineFrcFadePass(
    painter: Painter,
    bucket: LineBucket,
    coord: OverscaledTileID,
    ctx: LineFrcCoverageContext,
    elevated: boolean,
    stencilMode3D: Readonly<StencilMode>,
    drawWithSegments: (stencilMode: Readonly<StencilMode>, segs: SegmentVector | undefined, opacityMultiplier?: number) => void,
): void {
    if (ctx.hasPolygonGeometry) return; // handled by second pass
    const frcData = bucket.hdExt && bucket.hdExt.frcData;
    if (!frcData || !painter.frcCoverageFadeRange) return;
    const [fadeStart, fadeEnd] = painter.frcCoverageFadeRange;
    if (fadeStart >= fadeEnd) return;
    const zoom = painter.transform.zoom;
    const fadeFactor = 1.0 - Math.max(0, Math.min(1, (zoom - fadeStart) / (fadeEnd - fadeStart)));
    if (fadeFactor <= 0) return;
    const fadeStencil = elevated ? stencilMode3D : painter.stencilModeForClipping(coord);
    const mask = ctx.frcMask;
    for (const [level, segs] of frcData.frcPerLevel) {
        if ((mask & (1 << level)) === 0) continue;
        drawWithSegments(fadeStencil, segs, fadeFactor);
    }
}
