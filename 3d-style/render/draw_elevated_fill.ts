import assert from '../../src/style-spec/util/assert';
import {vec3} from 'gl-matrix';
import DepthMode from '../../src/gl/depth_mode';
import CullFaceMode from '../../src/gl/cull_face_mode';
import StencilMode from '../../src/gl/stencil_mode';
import ColorMode from '../../src/gl/color_mode';
import EXTENT from '../../src/style-spec/data/extent';
import {altitudeFromMercatorZ} from '../../src/geo/mercator_coordinate';
import {easeIn} from '../../src/util/util';
import {OrthographicPitchTranstionValue} from '../../src/geo/transform';
import {number as lerp} from '../../src/style-spec/util/interpolate';
import {calculateGroundShadowFactor} from './shadow_utils';
import {
    elevatedStructuresDepthUniformValues,
    elevatedStructuresUniformValues,
    elevatedStructuresDepthReconstructUniformValues,
} from './program/elevated_structures_program';

import type Painter from '../../src/render/painter';
import type Program from '../../src/render/program';
import type SourceCache from '../../src/source/source_cache';
import type FillStyleLayer from '../../src/style/style_layer/fill_style_layer';
import type FillBucket from '../../src/data/bucket/fill_bucket';
import type ProgramConfiguration from '../../src/data/program_configuration';
import type SegmentVector from '../../src/data/segment';
import type Transform from '../../src/geo/transform';
import type MercatorCoordinate from '../../src/geo/mercator_coordinate';
import type {OverscaledTileID, UnwrappedTileID} from '../../src/source/tile_id';
import type {DepthPrePass} from '../../src/render/painter';
import type {DrawFillParams} from '../../src/render/draw_fill';
import type {DynamicDefinesType} from '../../src/render/program/program_uniforms';
import type {UniformValues} from '../../src/render/uniform_binding';
import type {ElevatedStructuresDepthReconstructUniformsType} from './program/elevated_structures_program';

/**
 * Renders the 3D bridge/tunnel geometry produced by `ElevatedStructures`. Core dispatches
 * to this from `drawFill` via the `HD.drawElevatedStructures` hook — lives here so the
 * concrete elevated geometry program and its uniform helpers don't pull the
 * `ElevatedStructures` class into the core bundle. Core continues to own the fill-layer
 * draw entry point and the non-elevated fill path.
 *
 * @private
 */
export function drawElevatedStructures(params: DrawFillParams) {
    const {painter, sourceCache, layer, coords, colorMode} = params;
    const gl = painter.context.gl;

    const programName = 'elevatedStructures';
    const shadowRenderer = params.painter.shadowRenderer;
    const renderWithShadows = !!shadowRenderer && shadowRenderer.enabled;
    const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);
    let groundShadowFactor: [number, number, number] = [0, 0, 0];
    if (renderWithShadows) {
        const directionalLight = painter.style.directionalLight;
        const ambientLight = painter.style.ambientLight;
        if (directionalLight && ambientLight) {
            groundShadowFactor = calculateGroundShadowFactor(painter.style, directionalLight, ambientLight);
        }
    }

    const draw = (drawBridges: boolean) => {
        for (const coord of coords) {
            const tile = sourceCache.getTile(coord);
            const bucket = tile.getBucket(layer) as FillBucket;
            if (!bucket) continue;

            const elevatedStructures = bucket.hdExt ? bucket.hdExt.elevatedStructures : undefined;
            if (!elevatedStructures) continue;

            let renderableSegments: SegmentVector;
            let programConfiguration: ProgramConfiguration;
            if (drawBridges) {
                renderableSegments = elevatedStructures.renderableBridgeSegments;
                programConfiguration = elevatedStructures.bridgeProgramConfigurations.get(layer.id);
            } else {
                renderableSegments = elevatedStructures.renderableTunnelSegments;
                programConfiguration = elevatedStructures.tunnelProgramConfigurations.get(layer.id);
            }

            if (!renderableSegments || renderableSegments.segments[0].primitiveLength === 0) continue;

            assert(elevatedStructures.vertexBuffer && elevatedStructures.vertexBufferNormal && elevatedStructures.indexBuffer);

            programConfiguration.updatePaintBuffers();

            painter.prepareDrawTile();

            const affectedByFog = painter.isTileAffectedByFog(coord);

            const dynamicDefines: DynamicDefinesType[] = [];
            if (renderWithShadows) {
                dynamicDefines.push('RENDER_SHADOWS', 'NORMAL_OFFSET');
            }
            const program = painter.getOrCreateProgram(programName, {config: programConfiguration, overrideFog: affectedByFog, defines: dynamicDefines});

            const tileMatrix = painter.translatePosMatrix(coord.projMatrix, tile,
                layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

            if (renderWithShadows) {
                shadowRenderer.setupShadows(tile.tileID.toUnwrapped(), program, 'vector-tile');
            }

            const uniformValues = elevatedStructuresUniformValues(tileMatrix, groundShadowFactor);

            painter.uploadCommonUniforms(painter.context, program, coord.toUnwrapped());

            program.draw(painter, gl.TRIANGLES, depthMode,
                StencilMode.disabled, colorMode, CullFaceMode.backCCW, uniformValues,
                layer.id, elevatedStructures.vertexBuffer, elevatedStructures.indexBuffer, renderableSegments,
                layer.paint, painter.transform.zoom, programConfiguration, [elevatedStructures.vertexBufferNormal]);
        }
    };

    // Draw bridge structures
    draw(true);
    // Draw tunnel structures
    draw(false);
}

/**
 * Renders the shadow-pass depth for elevated structures. Core dispatches to this from
 * `drawFill` during `painter.renderPass === 'shadow'` via `HD.drawElevatedFillShadows`.
 *
 * @private
 */
export function drawElevatedFillShadows(params: DrawFillParams) {
    assert(!params.terrainEnabled);
    assert(params.painter.renderPass === 'shadow');
    assert(params.painter.shadowRenderer);

    const {painter, sourceCache, layer, coords} = params;
    const gl = painter.context.gl;

    const shadowRenderer = params.painter.shadowRenderer;
    const programName = 'elevatedStructuresDepth';

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer) as FillBucket;
        if (!bucket) continue;

        const elevatedStructures = bucket.hdExt ? bucket.hdExt.elevatedStructures : undefined;
        if (!elevatedStructures) {
            continue;
        }
        if (!elevatedStructures.shadowCasterSegments || elevatedStructures.shadowCasterSegments.segments[0].primitiveLength === 0) {
            continue;
        }

        assert(elevatedStructures.vertexBuffer && elevatedStructures.indexBuffer);

        painter.prepareDrawTile();

        const programConfiguration = bucket.bufferData.programConfigurations.get(layer.id);
        const affectedByFog = painter.isTileAffectedByFog(coord);

        const program = painter.getOrCreateProgram(programName, {config: programConfiguration, overrideFog: affectedByFog});

        const tileMatrix = shadowRenderer.calculateShadowPassMatrixFromTile(tile.tileID.toUnwrapped());

        painter.uploadCommonUniforms(painter.context, program, coord.toUnwrapped());

        const uniformValues = elevatedStructuresDepthUniformValues(tileMatrix, 0.0);

        program.draw(painter, gl.TRIANGLES, shadowRenderer.getShadowPassDepthMode(),
            StencilMode.disabled, ColorMode.disabled, CullFaceMode.disabled, uniformValues, layer.id,
            elevatedStructures.vertexBuffer, elevatedStructures.indexBuffer, elevatedStructures.shadowCasterSegments,
            layer.paint, painter.transform.zoom, programConfiguration);
    }
}

function computeCameraPositionInTile(id: UnwrappedTileID, cameraMercPos: MercatorCoordinate): vec3 {
    const tiles = 1 << id.canonical.z;

    const x = (cameraMercPos.x * tiles - id.canonical.x - id.wrap * tiles) * EXTENT;
    const y = (cameraMercPos.y * tiles - id.canonical.y) * EXTENT;
    const z = altitudeFromMercatorZ(cameraMercPos.z, cameraMercPos.y);

    return vec3.fromValues(x, y, z);
}

function computeDepthBias(tr: Transform): number {
    let bias = 0.01;

    if (tr.isOrthographic) {
        const mixValue = tr.pitch >= OrthographicPitchTranstionValue ? 1.0 : tr.pitch / OrthographicPitchTranstionValue;
        bias = lerp(0.0001, bias, easeIn(mixValue));
    }

    // The post-projection bias is originally computed for Metal, so we must compensate
    // for different depth ranges between OpenGL and Metal ([-1, 1] and [0, 1] respectively)
    return 2.0 * bias;
}

/**
 * Renders the elevated-road depth pre-pass (and its initialize/reset subpasses). Core
 * dispatches to this via `HD.drawDepthPrepass` — lives here alongside `drawGroundShadowMask`
 * and the `elevatedStructuresDepthReconstruct` shader so the reconstruction program
 * only ships with the HD bundle.
 *
 * @private
 */
export function drawDepthPrepass(painter: Painter, sourceCache: SourceCache | undefined, layer: FillStyleLayer, coords: Array<OverscaledTileID>, pass: DepthPrePass) {
    if (!sourceCache) return;
    if (!layer.layout || layer.layout.get('fill-elevation-reference') === 'none' || layer.paint.get('fill-opacity').constantOr(1) === 0) return;

    const gl = painter.context.gl;

    assert(!(painter.terrain && painter.terrain.enabled));

    // Perform a separate depth rendering pass for elevated road structues in order to:
    //  1. Support rendering of underground polygons. Ground plane (z=0) has to be included
    //     in the depth buffer for ground occlusion to work with tunnels
    //  2. Support stacking of multiple elevatated layers which is necessary to avoid z-fighting
    //
    // The depth prepass for HD roads involves depth value reconstruction for affected pixels as
    // the depth buffer might not contain valid occlusion especially for underground geometries
    // prior to rendering. All layers contributing to the HD road network are gathered togther
    // and used to construct the final depth information in few separate passes.

    // Step 1 (Initialize): Render underground geometries by projecting them towards the camera to the ground level (z=0).
    // Step 2 (Reset):      Carve "see-through" holes to the ground by lifting undergound polygons (excluding tunnels)
    //                      to the ground plane (z=0) and setting depth value to maximum.
    // Step 3 (Geometry):   Render road geometries to the depth buffer
    const depthModeFor3D = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const depthModeReset = new DepthMode(painter.context.gl.GREATER, DepthMode.ReadWrite, painter.depthRangeFor3D);
    const depthBias = computeDepthBias(painter.transform);
    const cameraMercPos = painter.transform.getFreeCameraOptions().position;
    const programName = 'elevatedStructuresDepthReconstruct';
    const depthReconstructProgram = painter.getOrCreateProgram(programName, {defines: ['DEPTH_RECONSTRUCTION']});
    const depthGeometryProgram = painter.getOrCreateProgram(programName);

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer) as FillBucket;
        if (!bucket) continue;

        if (!bucket.hdExt) continue;
        const elevatedStructures = bucket.hdExt.elevatedStructures;
        const elevationBufferData = bucket.hdExt.elevationBufferData;
        if (!elevatedStructures || !elevatedStructures.depthSegments || !elevationBufferData) {
            continue;
        }

        const heightRange = elevationBufferData.heightRange;
        const unwrappedTileID = coord.toUnwrapped();
        const cameraTilePos = computeCameraPositionInTile(unwrappedTileID, cameraMercPos);
        const tileMatrix = painter.translatePosMatrix(coord.projMatrix, tile,
            layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

        let uniformValues: UniformValues<ElevatedStructuresDepthReconstructUniformsType>;
        let depthMode: DepthMode;
        let segments: SegmentVector;
        let program: Program<ElevatedStructuresDepthReconstructUniformsType>;

        if (pass === 'initialize') {
            // Depth reconstruction is required only for underground models. Use a slight margin
            // to include surface models that might have some outlier vertices below the ground plane.
            const heightMargin = 1.0;
            if (!heightRange || heightRange.min >= heightMargin || elevatedStructures.depthSegments.segments[0].primitiveLength === 0) continue;
            uniformValues = elevatedStructuresDepthReconstructUniformValues(tileMatrix, cameraTilePos, depthBias, 1.0, 0.0);
            depthMode = depthModeFor3D;
            segments = elevatedStructures.depthSegments;
            program = depthReconstructProgram;
        } else if (pass === 'reset') {
            // Carve holes for underground polygons only
            if (!heightRange || heightRange.min >= 0.0 || elevatedStructures.maskSegments.segments[0].primitiveLength === 0) continue;
            uniformValues = elevatedStructuresDepthReconstructUniformValues(tileMatrix, cameraTilePos, 0.0, 0.0, 1.0);
            depthMode = depthModeReset;
            segments = elevatedStructures.maskSegments;
            program = depthReconstructProgram;
        } else if (pass === 'geometry') {
            if (elevatedStructures.depthSegments.segments[0].primitiveLength === 0) continue;
            uniformValues = elevatedStructuresDepthReconstructUniformValues(tileMatrix, cameraTilePos, depthBias, 1.0, 0.0);
            depthMode = depthModeFor3D;
            segments = elevatedStructures.depthSegments;
            program = depthGeometryProgram;
        }

        assert(uniformValues && depthMode && segments && program);
        assert(elevatedStructures.vertexBuffer && elevatedStructures.indexBuffer);

        program.draw(painter, gl.TRIANGLES, depthMode,
            StencilMode.disabled, ColorMode.disabled, CullFaceMode.disabled, uniformValues,
            layer.id, elevatedStructures.vertexBuffer, elevatedStructures.indexBuffer, segments,
            layer.paint, painter.transform.zoom);
    }
}

/**
 * Stencil-writes the elevated-road depth reconstruction to tag ground pixels that need
 * shadow-masking. Core dispatches to this via `HD.drawGroundShadowMask`.
 *
 * @private
 */
export function drawGroundShadowMask(painter: Painter, sourceCache: SourceCache | undefined, layer: FillStyleLayer, coords: Array<OverscaledTileID>) {
    if (!sourceCache) return;
    if (!layer.layout || layer.layout.get('fill-elevation-reference') === 'none' || layer.paint.get('fill-opacity').constantOr(1) === 0) return;

    assert(!(painter.terrain && painter.terrain.enabled));

    const gl = painter.context.gl;
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);
    const stencilMode = new StencilMode({func: gl.ALWAYS, mask: 0xFF}, 0xFF, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
    const cameraMercPos = painter.transform.getFreeCameraOptions().position;
    const program = painter.getOrCreateProgram('elevatedStructuresDepthReconstruct');

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer) as FillBucket;
        if (!bucket) continue;

        const elevatedStructures = bucket.hdExt ? bucket.hdExt.elevatedStructures : undefined;
        if (!elevatedStructures || !elevatedStructures.depthSegments || elevatedStructures.depthSegments.segments[0].primitiveLength === 0) {
            continue;
        }

        const unwrappedTileID = coord.toUnwrapped();
        const cameraTilePos = computeCameraPositionInTile(unwrappedTileID, cameraMercPos);
        const tileMatrix = painter.translatePosMatrix(coord.projMatrix, tile,
            layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

        const uniformValues = elevatedStructuresDepthReconstructUniformValues(tileMatrix, cameraTilePos, 0.0, 1.0, 0.0);
        program.draw(painter, gl.TRIANGLES, depthMode,
            stencilMode, ColorMode.disabled, CullFaceMode.disabled, uniformValues,
            layer.id, elevatedStructures.vertexBuffer, elevatedStructures.indexBuffer, elevatedStructures.depthSegments,
            layer.paint, painter.transform.zoom);
    }
}

