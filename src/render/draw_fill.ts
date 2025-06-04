import Color from '../style-spec/util/color';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    fillUniformValues,
    fillPatternUniformValues,
    fillOutlineUniformValues,
    fillOutlinePatternUniformValues,
    elevatedStructuresDepthUniformValues,
    elevatedStructuresUniformValues,
    elevatedStructuresDepthReconstructUniformValues,
} from './program/fill_program';
import StencilMode from '../gl/stencil_mode';
import browser from '../util/browser';
import assert from 'assert';
import ColorMode from '../gl/color_mode';
import {vec3} from 'gl-matrix';
import EXTENT from '../style-spec/data/extent';
import {altitudeFromMercatorZ} from '../geo/mercator_coordinate';
import {radToDeg, easeIn} from '../util/util';
import {OrthographicPitchTranstionValue} from '../geo/transform';
import {number as lerp} from '../style-spec/util/interpolate';
import {calculateGroundShadowFactor} from '../../3d-style/render/shadow_renderer';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillStyleLayer from '../style/style_layer/fill_style_layer';
import type FillBucket from '../data/bucket/fill_bucket';
import type {OverscaledTileID, UnwrappedTileID} from '../source/tile_id';
import type {DynamicDefinesType} from './program/program_uniforms';
import type VertexBuffer from '../gl/vertex_buffer';
import type {ElevationType} from '../../3d-style/elevation/elevation_constants';
import type Transform from '../geo/transform';
import type Program from './program';
import type {DepthPrePass} from './painter';
import type MercatorCoordinate from '../geo/mercator_coordinate';
import type {UniformValues} from './uniform_binding';
import type SegmentVector from '../data/segment';
import type ProgramConfiguration from '../data/program_configuration';
import type {
    FillUniformsType,
    FillPatternUniformsType,
    ElevatedStructuresDepthReconstructUniformsType,
} from './program/fill_program';

export default drawFill;

interface DrawFillParams {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (!pattern.constantOr((1 as any)) &&
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
        if (painter.shadowRenderer && elevationType === 'road' && !terrainEnabled) {
            drawShadows(drawFillParams);
        }
        return;
    }

    // Draw offset elevation
    if (elevationType === 'offset') {
        drawFillTiles(drawFillParams, false, painter.stencilModeFor3D());
        return;
    }

    // Draw non-elevated polygons
    drawFillTiles(drawFillParams, false);

    if (elevationType === 'road') {
        const roadElevationActive = !terrainEnabled && painter.renderPass === 'translucent';

        if (roadElevationActive) {
            // Render road geometries to the depth buffer in a separate step using a custom shader.
            drawDepthPrepass(painter, sourceCache, layer, coords, 'geometry');
        }

        // Draw elevated polygons
        drawFillTiles(drawFillParams, true, StencilMode.disabled);

        if (roadElevationActive) {
            drawElevatedStructures(drawFillParams);
        }
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
    const pitchInDegrees = radToDeg(tr.pitch);
    let bias = 0.01;

    if (tr.isOrthographic) {
        const mixValue = pitchInDegrees >= OrthographicPitchTranstionValue ? 1.0 : pitchInDegrees / OrthographicPitchTranstionValue;
        bias = lerp(0.0001, bias, easeIn(mixValue));
    }

    // The post-projection bias is originally computed for Metal, so we must compensate
    // for different depth ranges between OpenGL and Metal ([-1, 1] and [0, 1] respectively)
    return 2.0 * bias;
}

export function drawDepthPrepass(painter: Painter, sourceCache: SourceCache, layer: FillStyleLayer, coords: Array<OverscaledTileID>, pass: DepthPrePass) {
    if (!layer.layout || layer.layout.get('fill-elevation-reference') === 'none') return;
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

        const elevatedStructures = bucket.elevatedStructures;
        if (!elevatedStructures) {
            continue;
        }

        const heightRange = bucket.elevationBufferData.heightRange;
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

function drawElevatedStructures(params: DrawFillParams) {
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

            const elevatedStructures = bucket.elevatedStructures;
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
                dynamicDefines.push('RENDER_SHADOWS', 'DEPTH_TEXTURE', 'NORMAL_OFFSET');
            }
            const program = painter.getOrCreateProgram(programName, {config: programConfiguration, overrideFog: affectedByFog, defines: dynamicDefines});

            const tileMatrix = painter.translatePosMatrix(coord.projMatrix, tile,
                layer.paint.get('fill-translate'), layer.paint.get('fill-translate-anchor'));

            if (renderWithShadows) {
                shadowRenderer.setupShadows(tile.tileID.toUnwrapped(), program, 'vector-tile', tile.tileID.overscaledZ);
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

function drawFillTiles(params: DrawFillParams, elevatedGeometry: boolean, stencilModeOverride?: StencilMode) {
    const {painter, sourceCache, layer, coords, colorMode, elevationType, terrainEnabled, pass} = params;
    const gl = painter.context.gl;

    const patternProperty = layer.paint.get('fill-pattern');
    const patternTransition = layer.paint.get('fill-pattern-cross-fade');
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const image = patternProperty && patternProperty.constantOr((1 as any));

    const draw = (depthMode: DepthMode, isOutline: boolean) => {
        let programName: 'fillPattern' | 'fill' | 'fillOutlinePattern' | 'fillOutline';
        let uniformValues: UniformValues<FillUniformsType | FillPatternUniformsType>;

        let drawMode, indexBuffer, segments;
        if (!isOutline) {
            programName = image ? 'fillPattern' : 'fill';
            drawMode = gl.TRIANGLES;
        } else {
            programName = image && !layer.getPaintProperty('fill-outline-color') ? 'fillOutlinePattern' : 'fillOutline';
            drawMode = gl.LINES;
        }

        for (const coord of coords) {
            const tile = sourceCache.getTile(coord);
            if (image && !tile.patternsLoaded()) continue;

            const bucket = tile.getBucket(layer) as FillBucket;
            if (!bucket) continue;

            const bufferData = elevatedGeometry ? bucket.elevationBufferData : bucket.bufferData;
            if (bufferData.isEmpty()) continue;

            painter.prepareDrawTile();

            const programConfiguration = bufferData.programConfigurations.get(layer.id);
            const affectedByFog = painter.isTileAffectedByFog(coord);

            const dynamicDefines: DynamicDefinesType[] = [];
            const dynamicBuffers: VertexBuffer[] = [];
            if (renderElevatedRoads) {
                dynamicDefines.push('ELEVATED_ROADS');
                dynamicBuffers.push(bufferData.elevatedLayoutVertexBuffer);
            }
            if (renderWithShadows) {
                dynamicDefines.push('RENDER_SHADOWS', 'DEPTH_TEXTURE', 'NORMAL_OFFSET');
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
                shadowRenderer.setupShadows(tile.tileID.toUnwrapped(), program, 'vector-tile', tile.tileID.overscaledZ);
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

            program.draw(painter, drawMode, activeDepthMode,
                stencilModeOverride ? stencilModeOverride : painter.stencilModeForClipping(coord), colorMode, CullFaceMode.disabled, uniformValues,
                layer.id, bufferData.layoutVertexBuffer, indexBuffer, segments,
                layer.paint, painter.transform.zoom, programConfiguration, dynamicBuffers);
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

function drawShadows(params: DrawFillParams) {
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

        const elevatedStructures = bucket.elevatedStructures;
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

        const uniformValues = elevatedStructuresDepthUniformValues(tileMatrix, 0.001);

        program.draw(painter, gl.TRIANGLES, shadowRenderer.getShadowPassDepthMode(),
            StencilMode.disabled, shadowRenderer.getShadowPassColorMode(), CullFaceMode.disabled, uniformValues,
            layer.id, elevatedStructures.vertexBuffer, elevatedStructures.indexBuffer, elevatedStructures.shadowCasterSegments,
            layer.paint, painter.transform.zoom, programConfiguration);
    }
}
