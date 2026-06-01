import Color from '../style-spec/util/color';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues,
} from './program/fill_program';
import {HD} from '../../modules/hd_main';
import StencilMode from '../gl/stencil_mode';
import browser from '../util/browser';
import {calculateGroundShadowFactor} from '../../3d-style/render/shadow_utils';

import type ColorMode from '../gl/color_mode';
import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillStyleLayer from '../style/style_layer/fill_style_layer';
import type FillBucket from '../data/bucket/fill_bucket';
import type {OverscaledTileID} from '../source/tile_id';
import type {DynamicDefinesType} from './program/program_uniforms';
import type VertexBuffer from '../gl/vertex_buffer';
import type {ElevationType} from '../../3d-style/elevation/elevation_constants';
import type {DrawMode} from './program';
import type {UniformValues} from './uniform_binding';
import type SegmentVector from '../data/segment';
import type IndexBuffer from '../gl/index_buffer';
import type ElevatedFillBufferData from '../../3d-style/data/bucket/elevated_fill_buffer_data';
import type FillBufferData from '../data/bucket/fill_buffer_data';
import type Program from './program';
import type ProgramConfiguration from '../data/program_configuration';
import type {
    FillUniformsType,
    FillPatternUniformsType,
} from './program/fill_program';

export default drawFill;

// Exported so the HD-side render functions (drawElevatedStructures,
// drawElevatedFillShadows) that live in 3d-style/render/draw_elevated_fill.ts can
// accept the same params shape dispatched from `drawFill`.
export interface DrawFillParams {
    painter: Painter;
    sourceCache: SourceCache;
    layer: FillStyleLayer;
    coords: Array<OverscaledTileID>;
    colorMode: ColorMode;
    elevationType: ElevationType;
    terrainEnabled: boolean;
    pass: 'opaque' | 'translucent' | 'shadow';
}

function drawFill(painter: Painter, sourceCache: SourceCache, layer: FillStyleLayer, coords: Array<OverscaledTileID>) {
    const color = layer.paint.get('fill-color');
    const opacity = layer.paint.get('fill-opacity');

    if (opacity.constantOr(1) === 0) {
        return;
    }

    const emissiveStrength = layer.paint.get('fill-emissive-strength');

    const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);

    const pattern = layer.paint.get('fill-pattern');
    const pass = painter.opaquePassEnabledForLayer() &&
        (!pattern.constantOr(1) &&
        color.constantOr(Color.transparent).a === 1 &&
        opacity.constantOr(0) === 1) ? 'opaque' : 'translucent';

    let elevationType: ElevationType = 'none';

    if (layer.layout.get('fill-elevation-reference') !== 'none') {
        elevationType = 'road';
    } else if (layer.paint.get('fill-z-offset').constantOr(1.0) !== 0.0) {
        elevationType = 'offset';
    }

    const terrainEnabled = !!(painter.terrain && painter.terrain.enabled);

    const drawFillParams: DrawFillParams = {
        painter, sourceCache, layer, coords, colorMode, elevationType, terrainEnabled, pass
    };

    if (painter.renderPass === 'shadow') {
        if (painter.shadowRenderer && elevationType === 'road' && !terrainEnabled && HD.drawElevatedFillShadows) {
            HD.drawElevatedFillShadows(drawFillParams);
        }
        return;
    }

    const mrt = painter.emissiveMode === 'mrt-fallback';

    // Draw offset elevation
    if (elevationType === 'offset') {
        drawFillTiles(drawFillParams, false, mrt, painter.stencilModeFor3D());
        return;
    }

    // Draw non-elevated polygons
    drawFillTiles(drawFillParams, false, mrt);

    if (elevationType === 'road') {
        const roadElevationActive = !terrainEnabled && painter.renderPass === 'translucent';

        if (roadElevationActive && HD.drawDepthPrepass) {
            // Render road geometries to the depth buffer in a separate step using a custom shader.
            HD.drawDepthPrepass(painter, sourceCache, layer, coords, 'geometry');
        }

        // Draw elevated polygons
        drawFillTiles(drawFillParams, true, mrt, StencilMode.disabled);

        if (roadElevationActive && HD.drawElevatedStructures) {
            HD.drawElevatedStructures(drawFillParams);
        }
    }
}

function drawFillTiles(params: DrawFillParams, elevatedGeometry: boolean, multipleRenderTargets: boolean, stencilModeOverride?: StencilMode) {
    const {painter, sourceCache, layer, coords, colorMode, elevationType, terrainEnabled, pass} = params;
    const gl = painter.context.gl;

    const patternProperty = layer.paint.get('fill-pattern');
    const patternTransition = layer.paint.get('fill-pattern-cross-fade');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const constantPattern = patternProperty.constantOr(null);

    let activeElevationType = elevationType;
    if (elevationType === 'road' && (!elevatedGeometry || terrainEnabled)) {
        activeElevationType = 'none';
    }

    const renderElevatedRoads = activeElevationType === 'road';
    const shadowRenderer = params.painter.shadowRenderer;
    const renderWithShadows = renderElevatedRoads && !!shadowRenderer && shadowRenderer.enabled;
    const depthModeFor3D = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);
    let groundShadowFactor: [number, number, number] = [0, 0, 0];
    if (renderWithShadows) {
        const directionalLight = painter.style.directionalLight;
        const ambientLight = painter.style.ambientLight;
        if (directionalLight && ambientLight) {
            groundShadowFactor = calculateGroundShadowFactor(painter.style, directionalLight, ambientLight);
        }
    }

    const image = patternProperty && patternProperty.constantOr(1);
    const isDraping = painter.terrain && painter.terrain.renderingToTexture;

    const draw = (depthMode: DepthMode, isOutline: boolean) => {
        let programName: 'fillPattern' | 'fill' | 'fillOutlinePattern' | 'fillOutline';
        let uniformValues: UniformValues<FillUniformsType | FillPatternUniformsType>;

        let drawMode: DrawMode;
        let indexBuffer: IndexBuffer;
        let segments: SegmentVector | null;
        if (!isOutline) {
            programName = image ? 'fillPattern' : 'fill';
            drawMode = gl.TRIANGLES;
        } else {
            programName = image && !layer.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline';
            drawMode = gl.LINES;
        }

        // Collected tiles for partial-coverage structure fill second-pass.
        // Mirrors the line-layer pattern (draw_line.ts): tile's first-pass draw is
        // skipped and replaced by outside-polygon (full opacity) + inside-polygon
        // (faded opacity) draws after the main loop.
        const polygonCoverageTiles: Array<{
            coord: OverscaledTileID;
            bufferData: FillBufferData | ElevatedFillBufferData;
            program: Program<FillUniformsType | FillPatternUniformsType>;
            programConfiguration: ProgramConfiguration;
            uniformValues: UniformValues<FillUniformsType | FillPatternUniformsType>;
            depthMode: DepthMode;
            dynamicBuffers: VertexBuffer[];
            indexBuffer: IndexBuffer;
            segments: SegmentVector;
            frcMask: number;
        }> = [];

        for (const coord of coords) {
            const tile = sourceCache.getTile(coord);
            if (image && !tile.patternsLoaded()) continue;

            const bucket = tile.getBucket(layer) as FillBucket;
            if (!bucket) continue;

            const bufferData = elevatedGeometry ? (bucket.hdExt && bucket.hdExt.elevationBufferData) : bucket.bufferData;
            if (!bufferData || bufferData.isEmpty()) continue;

            painter.prepareDrawTile();

            const programConfiguration = bufferData.programConfigurations.get(layer.id);
            const affectedByFog = painter.isTileAffectedByFog(coord);

            const dynamicDefines: DynamicDefinesType[] = [];
            const dynamicBuffers: VertexBuffer[] = [];
            if (renderElevatedRoads) {
                dynamicDefines.push('ELEVATED_ROADS');
                // `renderElevatedRoads` implies the elevated path supplied us an
                // `ElevatedFillBufferData`; cast to access its elevated vertex buffer.
                dynamicBuffers.push((bufferData as ElevatedFillBufferData).elevatedLayoutVertexBuffer);
            }
            if (renderWithShadows) {
                dynamicDefines.push('RENDER_SHADOWS', 'NORMAL_OFFSET');
            }
            if (isDraping && multipleRenderTargets) {
                dynamicDefines.push('USE_MRT1');
            }

            if (image) {
                painter.context.activeTexture.set(gl.TEXTURE0);
                if (tile.imageAtlasTexture) {
                    tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
                }
                programConfiguration.updatePaintBuffers();
            }

            let transitionableConstantPattern = false;
            if (constantPattern && tile.imageAtlas) {
                const atlas = tile.imageAtlas;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const pattern = ResolvedImage.from(constantPattern);
                const primaryPatternImage = pattern.getPrimary().scaleSelf(browser.devicePixelRatio).toString();
                const secondaryPatternImageVariant = pattern.getSecondary();
                const primaryPosTo = atlas.patternPositions.get(primaryPatternImage);
                const secondaryPosTo = secondaryPatternImageVariant ? atlas.patternPositions.get(secondaryPatternImageVariant.scaleSelf(browser.devicePixelRatio).toString()) : null;

                transitionableConstantPattern = !!primaryPosTo && !!secondaryPosTo;

                if (primaryPosTo) programConfiguration.setConstantPatternPositions(primaryPosTo, secondaryPosTo);
            }

            if (patternTransition > 0 && (transitionableConstantPattern || !!programConfiguration.getPatternTransitionVertexBuffer('fill-pattern'))) {
                dynamicDefines.push('FILL_PATTERN_TRANSITION');
            }

            const program = painter.getOrCreateProgram(programName, {config: programConfiguration, overrideFog: affectedByFog, defines: dynamicDefines});

            const tileMatrix = painter.translatePosMatrix(coord.projMatrix, tile,
                layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

            if (renderWithShadows) {
                shadowRenderer.setupShadows(tile.tileID.toUnwrapped(), program, 'vector-tile');
            }

            const emissiveStrength = layer.paint.get('fill-emissive-strength');

            if (!isOutline) {
                indexBuffer = bufferData.indexBuffer;
                segments = bufferData.triangleSegments;
                uniformValues = image ?
                    fillPatternUniformValues(tileMatrix, emissiveStrength, painter, tile, groundShadowFactor, patternTransition) :
                    fillUniformValues(tileMatrix, emissiveStrength, groundShadowFactor);
            } else {
                indexBuffer = bufferData.lineIndexBuffer;
                segments = bufferData.lineSegments;
                const drawingBufferSize: [number, number] =
                    (painter.terrain && painter.terrain.renderingToTexture) ? painter.terrain.drapeBufferSize : [gl.drawingBufferWidth, gl.drawingBufferHeight];
                uniformValues = (programName === 'fillOutlinePattern' && image) ?
                    fillOutlinePatternUniformValues(tileMatrix, emissiveStrength, painter, tile, drawingBufferSize, groundShadowFactor, patternTransition) :
                    fillOutlineUniformValues(tileMatrix, emissiveStrength, drawingBufferSize, groundShadowFactor);
            }

            painter.uploadCommonUniforms(painter.context, program, coord.toUnwrapped());

            let activeDepthMode = depthMode;
            if ((elevationType === 'road' && !terrainEnabled) || elevationType === 'offset') {
                activeDepthMode = depthModeFor3D;
            }

            if (!segments || (segments.get && segments.get().length === 0)) continue;

            const stencilMode = stencilModeOverride ? stencilModeOverride : painter.stencilModeForClipping(coord);

            // FRC coverage routing (road per-level dispatch, structure skip/defer to
            // second pass) lives in HD. When HD is not loaded the snapshot is null so
            // there is nothing to do — fall through to the default draw.
            let frcResult: 'drawn' | 'deferred' | 'skip' | 'fallthrough' = 'fallthrough';
            if (!isOutline && HD.drawFillFrcCoverageFirstPass) {
                frcResult = HD.drawFillFrcCoverageFirstPass({
                    painter, layer, bucket, coord, elevatedGeometry,
                    program, programConfiguration, uniformValues,
                    drawMode, depthMode: activeDepthMode, stencilMode, colorMode,
                    bufferData, indexBuffer, segments, dynamicBuffers,
                    polygonCoverageTiles,
                });
            }
            if (frcResult !== 'fallthrough') continue;

            program.draw(painter, drawMode, activeDepthMode,
                stencilMode, colorMode, CullFaceMode.disabled, uniformValues,
                layer.id, bufferData.layoutVertexBuffer, indexBuffer, segments,
                layer.paint, painter.transform.zoom, programConfiguration, dynamicBuffers);
        }

        // Second pass for partial-coverage structure fills: outside polygon full opacity,
        // inside polygon faded. Mirrors render_line_layer second pass.
        if (!isOutline && HD.drawFillFrcCoverageSecondPass) {
            HD.drawFillFrcCoverageSecondPass(painter, layer, polygonCoverageTiles, drawMode, colorMode);
        }
    };

    if (painter.renderPass === pass) {
        const depthMode = painter.depthModeForSublayer(1, painter.renderPass === 'opaque' ? DepthMode.ReadWrite : DepthMode.ReadOnly);
        draw(depthMode, false);
    }

    // Draw stroke
    if (activeElevationType === 'none' && painter.renderPass === 'translucent' && layer.paint.get('fill-antialias')) {
        // If we defined a different color for the fill outline, we are
        // going to ignore the bits in 0x07 and just care about the global
        // clipping mask.
        // Otherwise, we only want to drawFill the antialiased parts that are
        // *outside* the current shape. This is important in case the fill
        // or stroke color is translucent. If we wouldn't clip to outside
        // the current shape, some pixels from the outline stroke overlapped
        // the (non-antialiased) fill.
        const depthMode = painter.depthModeForSublayer(layer.getPaintProperty('fill-outline-color') ? 2 : 0, DepthMode.ReadOnly);
        draw(depthMode, true);
    }
}

